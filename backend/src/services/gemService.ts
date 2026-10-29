import { PlacesClient } from "@googlemaps/places";
import { GemModel, type GemDoc, type GemInput } from "../models/gemModel";
import { definedOnly } from "../utils/defined";

/**
 * Google Places fields requested when looking up a place for a new Gem.
 * The Places API (New) rejects any request that has no field mask.
 */
const PLACE_FIELD_MASK = 'id,name,displayName,location,primaryType,editorialSummary,rating';

/** gRPC status codes the Places API returns when the place ID is malformed or unknown. */
const GRPC_INVALID_ARGUMENT = 3;
const GRPC_NOT_FOUND = 5;

/** Google Places place ID, e.g. `ChIJN1t_tDeuEmsRUsoyG83frY4`. */
const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]{1,255}$/;

/** Prefix of a Google Places resource name; a Gem's name is this plus the place ID. */
const PLACE_NAME_PREFIX = 'places/';

/**
 * Checks that `name` is shaped like a Google Places resource name (`places/<place ID>`).
 * Does not check that the place exists; see `GemService.addGem` for that.
 *
 * @param name value to check, usually taken straight from a request.
 * @returns `true` if `name` is a string of the form `places/<place ID>`.
 */
export function isValidGemName(name: unknown): name is string {
  return typeof name === 'string'
    && name.startsWith(PLACE_NAME_PREFIX)
    && PLACE_ID_PATTERN.test(name.slice(PLACE_NAME_PREFIX.length));
}

/**
 * Turns a place ID from a URL (e.g. `:pk` in `/gem/:pk/comments`) into a Gem name.
 * Gem names contain a slash, so URLs carry only the place ID.
 *
 * @param placeId value to convert, usually taken straight from a route parameter.
 * @returns `places/<placeId>`, or `undefined` if `placeId` is not a valid place ID.
 */
export function gemNameFromPlaceId(placeId: unknown): string | undefined {
  return typeof placeId === 'string' && PLACE_ID_PATTERN.test(placeId)
    ? PLACE_NAME_PREFIX + placeId
    : undefined;
}

/**
 * Thrown when a Gem name is malformed or does not refer to an existing Google Places place.
 * This is the client's fault (400), unlike database or Google outages (500).
 */
export class InvalidPlaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPlaceError';
  }
}

/**
 * A Google Places place, as much of it as Excavator keeps.
 */
class Place {
  /** Google Places resource name, `places/<place ID>`. */
  readonly name: string;
  private displayName?: string;
  readonly latitude: number;
  readonly longitude: number;
  /** Google Places primary type, e.g. `cafe`. */
  type?: string | undefined;
  /** Short description of the place, from Google's editorial summary. */
  description?: string | undefined;

  /**
   * @param name Google Places resource name, `places/<place ID>`.
   * @param latitude in degrees.
   * @param longitude in degrees.
   */
  constructor(name: string, latitude: number, longitude: number) {
    this.name = name;
    this.latitude = latitude;
    this.longitude = longitude;
  }

  /**
   * @returns the human-readable name, or the resource name if there is none.
   */
  getDisplayName(): string {
    return this.displayName ?? this.name;
  }

  /**
   * @param displayName human-readable name, e.g. `Mitakihara Cafe`.
   */
  setDisplayName(displayName: string): void {
    this.displayName = displayName;
  }
}

/**
 * A hidden gem: a place plus its GemScore and the inputs the score is computed from.
 */
class Gem {
  /** Same as the place's resource name, `places/<place ID>`. */
  readonly name: string;
  readonly place: Place;
  /** User ID (Google `sub`) of the user who added the Gem. */
  readonly addedBy?: string | undefined;
  protected score?: number | undefined;
  protected nicheness?: number | undefined;
  protected quality?: number | undefined;
  protected scoreTime?: number | undefined;

  /**
   * Does not validate the gem! Use `GemService.addGem` to add a validated Gem.
   *
   * @param name Gem name, same as `place.name`.
   * @param place the place this Gem is.
   * @param addedBy user ID of the user who added the Gem.
   */
  constructor(name: string, place: Place, addedBy?: string) {
    this.name = name;
    this.place = place;
    this.addedBy = addedBy;
  }

  /**
   * @returns nicheness from the nicheness API, if computed.
   */
  getNicheness(): number | undefined {
    return this.nicheness;
  }

  /**
   * @param nicheness from the nicheness API, or `undefined` to clear it.
   */
  setNicheness(nicheness: number | undefined): void {
    this.nicheness = nicheness;
  }

  /**
   * @returns review quality from Google Places (its 1.0–5.0 rating), if known.
   */
  getQuality(): number | undefined {
    return this.quality;
  }

  /**
   * @param quality review quality from Google Places, or `undefined` to clear it.
   */
  setQuality(quality: number | undefined): void {
    this.quality = quality;
  }

  /**
   * @returns the GemScore, if computed.
   */
  getScore(): number | undefined {
    return this.score;
  }

  /**
   * @returns when the GemScore was last computed, in ms since epoch.
   */
  getScoreTime(): number | undefined {
    return this.scoreTime;
  }

  /**
   * @param newScore the new GemScore, or `undefined` to clear it.
   * @param scoreTime when it was computed, in ms since epoch. Defaults to now.
   */
  setScore(newScore: number | undefined, scoreTime: number | undefined = Date.now()): void {
    this.score = newScore;
    this.scoreTime = scoreTime;
  }
}

/** A place looked up on Google Places, with the extra data a new Gem needs. */
interface PlaceLookup {
  place: Place;
  /** Google's 1.0–5.0 rating, if the place has one. */
  rating: number | undefined;
}

/**
 * Gets, validates and adds Gems.
 */
class GemService {
  private repo: GemRepo = new GemRepo();
  private gpClient: PlacesClient = new PlacesClient();

  /**
   * Looks up a place on Google Places.
   *
   * @param name Google Places resource name, `places/<place ID>`.
   * @returns the place (with display name, primary type and description when Google has them) and its rating.
   * @throws `InvalidPlaceError` if Google has no such place, or returns it without a name or location.
   * @throws the Places client's error for anything else (network, quota, credentials).
   */
  private async getPlace(name: string): Promise<PlaceLookup> {
    let res;
    try {
      res = await this.gpClient.getPlace(
        { name },
        { otherArgs: { headers: { 'X-Goog-FieldMask': PLACE_FIELD_MASK } } },
      );
    } catch (err) {
      const code = (err as { code?: unknown } | null)?.code;
      if (code === GRPC_NOT_FOUND || code === GRPC_INVALID_ARGUMENT) {
        throw new InvalidPlaceError('No such place.');
      }
      throw err;
    }

    const gPlace = res[0];
    const latitude = gPlace.location?.latitude;
    const longitude = gPlace.location?.longitude;

    if (
      !gPlace.name
      || typeof latitude !== 'number' || !Number.isFinite(latitude)
      || typeof longitude !== 'number' || !Number.isFinite(longitude)
    ) {
      throw new InvalidPlaceError('Invalid response from Google Map.');
    }

    const place = new Place(gPlace.name, latitude, longitude);
    if (gPlace.displayName?.text) {
      place.setDisplayName(gPlace.displayName.text);
    }
    place.type = gPlace.primaryType || undefined;
    place.description = gPlace.editorialSummary?.text || undefined;

    // Unset ratings can come back as 0; real ratings are 1.0–5.0.
    const rating = typeof gPlace.rating === 'number' && gPlace.rating > 0 ? gPlace.rating : undefined;

    return { place, rating };
  }

  /**
   * Makes a valid Gem from its Google Places place, or rejects.
   * The Gem is not scored and not stored.
   *
   * @param name Google Places resource name, `places/<place ID>`.
   * @param addedBy user ID of the user who is adding the Gem.
   * @returns the new Gem, with `quality` set from the Google rating.
   * @throws `InvalidPlaceError` if `name` is malformed or not a real place.
   * @constructs `Gem`
   */
  private async newGem(name: string, addedBy: string): Promise<Gem> {
    if (!isValidGemName(name)) {
      throw new InvalidPlaceError('Invalid place name.');
    }

    const { place, rating } = await this.getPlace(name);

    const gem = new Gem(name, place, addedBy);
    gem.setQuality(rating);

    return gem;
  }

  /**
   * Gets a stored Gem.
   *
   * @param name Gem name, `places/<place ID>`.
   * @returns the Gem, or `undefined` if there is none (or `name` is malformed, in which case the DB is not queried).
   */
  async getGem(name: string): Promise<Gem | undefined> {
    if (!isValidGemName(name)) {
      return undefined;
    }

    return this.repo.get(name);
  }

  /**
   * Checks whether a Gem is stored, without loading it.
   *
   * @param name Gem name, `places/<place ID>`.
   * @returns `true` if the Gem exists; `false` if not or if `name` is malformed (the DB is then not queried).
   */
  async hasGem(name: string): Promise<boolean> {
    if (!isValidGemName(name)) {
      return false;
    }

    return this.repo.has(name);
  }

  /**
   * Validates and adds a Gem.
   *
   * @param name of a place, which is also the Gem's name: `places/<place ID>`.
   * @param addedBy ID of user who is to add the Gem.
   * @returns `true` if the Gem was added, `false` if a Gem with that name already exists.
   * @throws `InvalidPlaceError` if `name` is malformed or not a real place; nothing is stored.
   * @throws the database or Places client error for anything else.
   */
  async addGem(name: string, addedBy: string): Promise<boolean> {
    if (!isValidGemName(name)) {
      throw new InvalidPlaceError('Invalid place name.');
    }

    if (await this.repo.has(name)) {
      return false;
    }

    const gem = await this.newGem(name, addedBy);

    return this.repo.upsert(name, gem);
  }

  /**
   * Computes and stores a Gem's GemScore.
   *
   * @param name Gem name, `places/<place ID>`.
   * @requires the `name` to be valid and such gem exists.
   */
  async scoreGem(_name: string): Promise<void> {
    // TODO score the gem.
  }
}

/**
 * Maps a Gem to the document stored in Mongo.
 *
 * @param gem the Gem to store.
 * @returns the document, with the location as GeoJSON `[longitude, latitude]` and no `undefined` fields.
 */
function toDoc(gem: Gem): GemInput {
  const place = gem.place;
  const doc: GemInput = {
    name: gem.name,
    place: {
      name: place.name,
      displayName: place.getDisplayName(),
      location: { type: 'Point', coordinates: [place.longitude, place.latitude] },
    },
    ...definedOnly({
      description: place.description,
      type: place.type,
      score: gem.getScore(),
      scoreTime: gem.getScoreTime(),
      nicheness: gem.getNicheness(),
      quality: gem.getQuality(),
      addedBy: gem.addedBy,
    }),
  };

  return doc;
}

/**
 * Maps a stored Mongo document back to a Gem.
 *
 * @param doc the stored document.
 * @returns the Gem; `null` fields become `undefined`.
 * @throws if the document has no valid `[longitude, latitude]`.
 */
function fromDoc(doc: GemDoc): Gem {
  const [longitude, latitude] = doc.place.location.coordinates;
  if (longitude === undefined || latitude === undefined) {
    throw new Error(`Invalid location for Gem.`);
  }

  const place = new Place(doc.place.name, latitude, longitude);
  if (doc.place.displayName) {
    place.setDisplayName(doc.place.displayName);
  }
  place.type = doc.type ?? undefined;
  place.description = doc.description ?? undefined;

  const gem = new Gem(doc.name, place, doc.addedBy ?? undefined);
  gem.setNicheness(doc.nicheness ?? undefined);
  gem.setQuality(doc.quality ?? undefined);
  if (doc.score !== undefined && doc.score !== null) {
    gem.setScore(doc.score, doc.scoreTime ?? Date.now());
  }

  return gem;
}

/**
 * Stores Gems in the `gems` collection. Does no validation; `GemService` does that.
 */
class GemRepo {

  /**
   * Stores a new Gem. Fails if one with the same name exists (unique index).
   *
   * @param name Gem name.
   * @param place the Gem's place.
   * @returns the stored Gem.
   */
  async create(name: string, place: Place): Promise<Gem> {
    const gem = new Gem(name, place);
    await GemModel.create(toDoc(gem));
    return gem;
  }

  /**
   * @param name Gem name.
   * @returns the stored Gem, or `undefined` if there is none.
   */
  async get(name: string): Promise<Gem | undefined> {
    const doc = await GemModel.findOne({ name }).lean<GemDoc>();
    return doc ? fromDoc(doc) : undefined;
  }

  /**
   * @param name Gem name.
   * @param place used only if the Gem has to be created.
   * @returns the stored Gem, creating it first if there is none.
   */
  async getOrCreate(name: string, place: Place): Promise<Gem> {
    return (await this.get(name)) ?? this.create(name, place);
  }

  /**
   * @param name Gem name.
   * @returns `true` if a Gem with that name is stored.
   */
  async has(name: string): Promise<boolean> {
    return (await GemModel.exists({ name })) !== null;
  }

  /**
   * Inserts the Gem, or replaces the stored one with the same name.
   *
   * @param name Gem name.
   * @param gem the Gem to store.
   * @returns `true` if the write was acknowledged.
   */
  async upsert(name: string, gem: Gem): Promise<boolean> {
    const res = await GemModel.replaceOne({ name }, toDoc(gem), { upsert: true });
    return res.acknowledged;
  }

}

export { Gem, Place };

export default GemService
