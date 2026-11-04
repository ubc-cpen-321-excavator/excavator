import { PlacesClient, type protos } from "@googlemaps/places";
import { env } from "../config/env";
import { GemModel, type GemDoc, type GemInput } from "../models/gemModel";
import { definedOnly, nonEmpty, orUndefined } from "../utils/defined";
import { computeGemScore } from "../utils/gemScore";
import { distanceMeters, type Bounds, type LatLng } from "../utils/geo";

/**
 * Google Places fields requested when looking up a place for a new Gem.
 * The Places API (New) rejects any request that has no field mask.
 */
const PLACE_FIELD_MASK = 'id,name,displayName,location,primaryType,editorialSummary,rating,userRatingCount';

/** Google Places fields requested for each nearby place. */
const NEARBY_FIELD_MASK = 'places.name,places.displayName,places.location,places.primaryType,places.formattedAddress';

/**
 * How close a user must be to a place to add it as a Gem, in metres.
 * Nearby search uses the same radius, so it only lists places the user can add.
 */
export const MAX_ADD_DISTANCE_M = 200;

/** Most places Google returns for one nearby search. */
const NEARBY_MAX_RESULTS = 20;

/** Default and largest number of Gems returned by one list query. */
export const GEM_LIST_DEFAULT = 20;
export const GEM_LIST_MAX = 50;

/** Default and largest radius of a nearby-Gems query, in metres. */
export const GEM_NEARBY_RADIUS_DEFAULT_M = 5_000;
export const GEM_NEARBY_RADIUS_MAX_M = 50_000;

/** Google Places type, e.g. `cafe`, `hiking_area`. */
const PLACE_TYPE_PATTERN = /^[a-z_]{1,50}$/;

/** Most place types one nearby search can filter by; Google Places allows up to 50 `includedTypes`. */
export const MAX_PLACE_TYPES = 50;

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
 * Checks that `type` is shaped like a Google Places type. Google may still not know it.
 *
 * @param type value to check, usually taken straight from a request.
 * @returns `true` if it is lowercase letters and underscores, 1–50 characters.
 */
export function isValidPlaceType(type: unknown): type is string {
  return typeof type === 'string' && PLACE_TYPE_PATTERN.test(type);
}

/**
 * Reads the place types to filter a nearby search by, from the `type` query parameter. Several types
 * can be given comma-separated (`type=cafe,park`), as a repeated parameter (`type=cafe&type=park`),
 * or both. Spaces around each type are ignored and duplicates are dropped.
 *
 * @param value the `type` query parameter: missing, a string, or an array of strings.
 * @returns the types (`[]` if the parameter is missing, meaning no filter), or `undefined` if any
 *   type is empty or malformed, or there are more than `MAX_PLACE_TYPES`.
 */
export function parsePlaceTypes(value: unknown): string[] | undefined {
  if (value === undefined) {
    return [];
  }

  const parts = Array.isArray(value) ? value : [value];
  if (!parts.every(part => typeof part === 'string')) {
    return undefined;
  }

  const types = [...new Set(parts.flatMap(part => part.split(',').map(type => type.trim())))];
  return types.length <= MAX_PLACE_TYPES && types.every(isValidPlaceType) ? types : undefined;
}

/** Thrown when a user adds a place further than `MAX_ADD_DISTANCE_M` from them. The client's fault (422). */
export class TooFarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TooFarError';
  }
}

/** Thrown when something is read or added for a Gem that is not stored, e.g. its comments. The client's fault (404). */
export class NoSuchGemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoSuchGemError';
  }
}

/** Thrown when adding a Gem that already exists (409). */
export class GemExistsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GemExistsError';
  }
}

/**
 * Thrown when Google Places fails for a reason other than a bad request: network, quota,
 * credentials or an outage. Not the client's fault and not ours (502). The Places error is the `cause`.
 */
export class PlacesUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'PlacesUnavailableError';
  }
}

/** MongoDB's error code for a unique index violation. */
const MONGO_DUPLICATE_KEY = 11000;

/** Thrown when Google rejects a place type in a nearby search. The client's fault (400). */
export class InvalidPlaceTypeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPlaceTypeError';
  }
}

/**
 * Thrown when a Gem name is malformed or does not refer to an existing Google Places place.
 * This is the client's fault (422), unlike database or Google outages (500/502).
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
  protected reviewCount?: number | undefined;
  protected ratingCount?: number | undefined;
  protected ratingAverage?: number | undefined;
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
   * @returns number of Google reviews, if known.
   */
  getReviewCount(): number | undefined {
    return this.reviewCount;
  }

  /**
   * @param reviewCount number of Google reviews, or `undefined` to clear it.
   */
  setReviewCount(reviewCount: number | undefined): void {
    this.reviewCount = reviewCount;
  }

  /**
   * @returns how many Excavator users rated the Gem, if any did.
   */
  getRatingCount(): number | undefined {
    return this.ratingCount;
  }

  /**
   * @returns the average of the Excavator users' ratings, 1–5, if any.
   */
  getRatingAverage(): number | undefined {
    return this.ratingAverage;
  }

  /**
   * @param count number of Excavator users' ratings; 0 or `undefined` clears both values.
   * @param average their average, 1–5.
   */
  setAppRatings(count: number | undefined, average: number | undefined): void {
    const hasRatings = count !== undefined && count > 0 && average !== undefined;
    this.ratingCount = hasRatings ? count : undefined;
    this.ratingAverage = hasRatings ? average : undefined;
  }

  /**
   * Computes the GemScore from the Google rating (`quality`) and review count and the Excavator
   * ratings, and sets it with its nicheness. See `utils/gemScore.ts` for the formula.
   */
  rescore(): void {
    const { score, nicheness } = computeGemScore({
      rating: this.quality,
      reviewCount: this.reviewCount,
      appRating: this.ratingAverage,
      appRatingCount: this.ratingCount,
    });
    this.setNicheness(nicheness);
    this.setScore(score);
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
  /** Number of Google reviews, if Google gave one. */
  reviewCount: number | undefined;
}

/** A place near the user that they could add as a Gem. Returned by `GET /place/nearby`. */
export interface PlaceCandidate {
  /** Google Places resource name, `places/<place ID>`; what `POST /gem` takes. */
  name: string;
  displayName: string;
  type?: string | undefined;
  address?: string | undefined;
  latitude: number;
  longitude: number;
  /** From the search point, in metres, rounded. */
  distance: number;
  /** `true` if the place is already a Gem. */
  isGem: boolean;
}

/** A place as the Google Places client returns it. */
type GooglePlace = protos.google.maps.places.v1.IPlace;

/**
 * @param value a number from Google, which may be unset. Checked here, so any value is accepted.
 * @returns `value` if it is a number above 0, else `undefined` (unset ratings can come back as 0).
 */
function positiveOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && value > 0 ? value : undefined;
}

/**
 * @param gPlace a place from Google Places.
 * @returns its location, or `undefined` if Google left it out or it is not finite.
 */
function locationFromGoogle(gPlace: GooglePlace): LatLng | undefined {
  const latitude = gPlace.location?.latitude;
  const longitude = gPlace.location?.longitude;
  if (typeof latitude !== 'number' || !Number.isFinite(latitude)
    || typeof longitude !== 'number' || !Number.isFinite(longitude)) {
    return undefined;
  }

  return { latitude, longitude };
}

/**
 * Maps a place looked up on Google Places to our `Place` and its Google rating.
 *
 * @param gPlace the place from Google Places.
 * @returns the place (with display name, primary type and description when Google has them) and its rating.
 * @throws `InvalidPlaceError` if Google returned it without a name or location.
 */
function lookupFromGoogle(gPlace: GooglePlace): PlaceLookup {
  const location = locationFromGoogle(gPlace);
  const name = nonEmpty(gPlace.name);
  if (name === undefined || location === undefined) {
    throw new InvalidPlaceError('Invalid response from Google Map.');
  }

  const place = new Place(name, location.latitude, location.longitude);
  const displayName = nonEmpty(gPlace.displayName?.text);
  if (displayName !== undefined) {
    place.setDisplayName(displayName);
  }
  place.type = nonEmpty(gPlace.primaryType);
  place.description = nonEmpty(gPlace.editorialSummary?.text);

  return {
    place,
    rating: positiveOrUndefined(gPlace.rating),
    reviewCount: positiveOrUndefined(gPlace.userRatingCount),
  };
}

/**
 * Maps a place from a nearby search to a candidate the user could add.
 *
 * @param gPlace the place from Google Places.
 * @param from where the user is, to measure the distance from.
 * @returns the candidate, or `undefined` if the place has no valid name or location.
 */
function candidateFromGoogle(gPlace: GooglePlace, from: LatLng): Omit<PlaceCandidate, 'isGem'> | undefined {
  const location = locationFromGoogle(gPlace);
  if (!isValidGemName(gPlace.name) || location === undefined) {
    return undefined;
  }

  return {
    name: gPlace.name,
    displayName: nonEmpty(gPlace.displayName?.text) ?? gPlace.name,
    type: nonEmpty(gPlace.primaryType),
    address: nonEmpty(gPlace.formattedAddress),
    latitude: location.latitude,
    longitude: location.longitude,
    distance: Math.round(distanceMeters(from, location)),
  };
}

/**
 * Gets, validates and adds Gems.
 */
class GemService {
  private repo: GemRepo = new GemRepo();
  private gpClient: PlacesClient = new PlacesClient(
    env.google_api_key ? { apiKey: env.google_api_key } : {},
  );

  /**
   * Looks up a place on Google Places.
   *
   * @param name Google Places resource name, `places/<place ID>`.
   * @returns the place (with display name, primary type and description when Google has them) and its rating.
   * @throws `InvalidPlaceError` if Google has no such place, or returns it without a name or location.
   * @throws `PlacesUnavailableError` for anything else (network, quota, credentials).
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
      throw new PlacesUnavailableError('Place lookup failed.', { cause: err });
    }

    return lookupFromGoogle(res[0]);
  }

  /**
   * Makes a valid, scored Gem from its Google Places place, or rejects. The Gem is not stored.
   *
   * @param name Google Places resource name, `places/<place ID>`.
   * @param addedBy user ID of the user who is adding the Gem.
   * @param userLocation where the user is; the place must be within `MAX_ADD_DISTANCE_M` of it.
   * @returns the new Gem, with `quality` (Google rating), `reviewCount`, nicheness and GemScore set.
   * @throws `InvalidPlaceError` if `name` is malformed or not a real place.
   * @throws `TooFarError` if the place is too far from the user.
   * @constructs `Gem`
   */
  private async newGem(name: string, addedBy: string, userLocation: LatLng): Promise<Gem> {
    if (!isValidGemName(name)) {
      throw new InvalidPlaceError('Invalid place name.');
    }

    const { place, rating, reviewCount } = await this.getPlace(name);

    if (distanceMeters(userLocation, place) > MAX_ADD_DISTANCE_M) {
      throw new TooFarError('Too far from place.');
    }

    const gem = new Gem(name, place, addedBy);
    gem.setQuality(rating);
    gem.setReviewCount(reviewCount);
    gem.rescore();

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
   * @param userLocation where the user is; the place must be within `MAX_ADD_DISTANCE_M` of it.
   * @returns the new, scored Gem.
   * @throws `GemExistsError` if a Gem with that name already exists (also when two users add it at once); nothing changes.
   * @throws `InvalidPlaceError` if `name` is malformed or not a real place; nothing is stored.
   * @throws `TooFarError` if the place is too far from the user; nothing is stored.
   * @throws `PlacesUnavailableError` if Google Places fails; nothing is stored.
   * @throws the database error for anything else.
   */
  async addGem(name: string, addedBy: string, userLocation: LatLng): Promise<Gem> {
    if (!isValidGemName(name)) {
      throw new InvalidPlaceError('Invalid place name.');
    }

    // Checked first to skip the Google lookup; the unique index in `insert` settles races.
    if (await this.repo.has(name)) {
      throw new GemExistsError('Gem already exists.');
    }

    const gem = await this.newGem(name, addedBy, userLocation);
    await this.repo.insert(gem);

    return gem;
  }

  /**
   * Recomputes and stores a Gem's GemScore from its stored inputs.
   *
   * @param name Gem name, `places/<place ID>`.
   * @returns the new GemScore, or `undefined` if there is no such Gem (nothing is stored).
   */
  async scoreGem(name: string): Promise<number | undefined> {
    const gem = await this.getGem(name);
    if (!gem) {
      return undefined;
    }

    gem.rescore();
    await this.repo.saveScore(gem);

    return gem.getScore();
  }

  /**
   * Stores a Gem's new Excavator rating totals and the GemScore they lead to.
   *
   * @param name Gem name, `places/<place ID>`.
   * @param count number of Excavator users' ratings.
   * @param average their average, 1–5.
   * @returns the rescored Gem.
   * @throws `NoSuchGemError` if there is no such Gem; nothing is stored.
   */
  async applyAppRatings(name: string, count: number, average: number | undefined): Promise<Gem> {
    const gem = await this.getGem(name);
    if (!gem) {
      throw new NoSuchGemError('No such Gem.');
    }

    gem.setAppRatings(count, average);
    gem.rescore();
    await this.repo.saveScore(gem);

    return gem;
  }

  /**
   * Gets several stored Gems at once, e.g. a user's favorites.
   *
   * @param names Gem names, `places/<place ID>`.
   * @returns the stored Gems, in the order of `names`; names with no Gem are left out.
   */
  async getGems(names: string[]): Promise<Gem[]> {
    const gems = await this.repo.getMany(names);
    const byName = new Map(gems.map(g => [g.name, g]));

    return names.flatMap(name => byName.get(name) ?? []);
  }

  /**
   * Finds places near the user that they could add as Gems, nearest first.
   * Only places within `MAX_ADD_DISTANCE_M` are listed, since only those can be added.
   *
   * @param location where the user is.
   * @param types Google Places types to limit the search to, e.g. `['cafe', 'park']`; a place
   *   matching any of them is listed. Empty or left out: all places.
   * @returns up to 20 places, each marked with whether it is already a Gem.
   * @throws `InvalidPlaceTypeError` if a type is malformed, there are more than `MAX_PLACE_TYPES`,
   *   or Google does not know one of them.
   * @throws `PlacesUnavailableError` if Google Places fails otherwise.
   * @throws the database error if stored Gems cannot be checked.
   */
  async findNearbyPlaces(location: LatLng, types: string[] = []): Promise<PlaceCandidate[]> {
    if (types.length > MAX_PLACE_TYPES || !types.every(isValidPlaceType)) {
      throw new InvalidPlaceTypeError('Invalid place type.');
    }

    let res;
    try {
      res = await this.gpClient.searchNearby(
        {
          maxResultCount: NEARBY_MAX_RESULTS,
          rankPreference: 'DISTANCE',
          locationRestriction: { circle: { center: location, radius: MAX_ADD_DISTANCE_M } },
          ...(types.length === 0 ? {} : { includedTypes: types }),
        },
        { otherArgs: { headers: { 'X-Goog-FieldMask': NEARBY_FIELD_MASK } } },
      );
    } catch (err) {
      if ((err as { code?: unknown } | null)?.code === GRPC_INVALID_ARGUMENT) {
        throw new InvalidPlaceTypeError('Unknown place type.');
      }
      throw new PlacesUnavailableError('Nearby search failed.', { cause: err });
    }

    // Leaves out anything Google returns that couldn't be added as a Gem anyway.
    const candidates = (res[0].places ?? []).flatMap(gPlace => candidateFromGoogle(gPlace, location) ?? []);

    const gems = await this.repo.namesIn(candidates.map(c => c.name));

    return candidates.map(c => ({ ...c, isGem: gems.has(c.name) }));
  }

  /**
   * @param center point to search around.
   * @param radius in metres.
   * @param limit most Gems to return.
   * @returns Gems within `radius` of `center`, nearest first.
   */
  async getNearbyGems(center: LatLng, radius: number, limit: number): Promise<Gem[]> {
    return this.repo.nearby(center, radius, limit);
  }

  /**
   * @param bounds the map viewport.
   * @param limit most Gems to return.
   * @returns Gems inside `bounds`, highest GemScore first.
   */
  async getGemsWithin(bounds: Bounds, limit: number): Promise<Gem[]> {
    return this.repo.within(bounds, limit);
  }

  /**
   * @param limit most Gems to return.
   * @returns the most recently added Gems, newest first.
   */
  async getNewestGems(limit: number): Promise<Gem[]> {
    return this.repo.newest(limit);
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
      reviewCount: gem.getReviewCount(),
      ratingCount: gem.getRatingCount(),
      ratingAverage: gem.getRatingAverage(),
      addedBy: gem.addedBy,
    }),
  };

  return doc;
}

/**
 * Maps the place part of a stored Gem document back to a Place.
 *
 * @param doc the stored document.
 * @returns the Place; `null` fields become `undefined`.
 * @throws if the document has no valid `[longitude, latitude]`.
 */
function placeFromDoc(doc: GemDoc): Place {
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

  return place;
}

/**
 * Maps a stored Mongo document back to a Gem.
 *
 * @param doc the stored document.
 * @returns the Gem; `null` fields become `undefined`.
 * @throws if the document has no valid `[longitude, latitude]`.
 */
function fromDoc(doc: GemDoc): Gem {
  const gem = new Gem(doc.name, placeFromDoc(doc), orUndefined(doc.addedBy));
  gem.setNicheness(orUndefined(doc.nicheness));
  gem.setQuality(orUndefined(doc.quality));
  gem.setReviewCount(orUndefined(doc.reviewCount));
  gem.setAppRatings(orUndefined(doc.ratingCount), orUndefined(doc.ratingAverage));
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
   * Stores a new Gem, never overwriting one.
   *
   * @param gem the Gem to store.
   * @throws `GemExistsError` if a Gem with the same name is already stored (unique index).
   * @throws the database error for anything else.
   */
  async insert(gem: Gem): Promise<void> {
    try {
      await GemModel.create(toDoc(gem));
    } catch (err) {
      if ((err as { code?: unknown } | null)?.code === MONGO_DUPLICATE_KEY) {
        throw new GemExistsError('Gem already exists.');
      }
      throw err;
    }
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
   * @returns `true` if a Gem with that name is stored.
   */
  async has(name: string): Promise<boolean> {
    return (await GemModel.exists({ name })) !== null;
  }

  /**
   * @param names Gem names to look for.
   * @returns the subset of `names` that are stored Gems.
   */
  async namesIn(names: string[]): Promise<Set<string>> {
    if (names.length === 0) {
      return new Set();
    }

    const docs = await GemModel.find({ name: { $in: names } }, { name: 1 }).lean<{ name: string }[]>();
    return new Set(docs.map(d => d.name));
  }

  /**
   * @param center point to search around.
   * @param radius in metres.
   * @param limit most Gems to return.
   * @returns Gems within `radius` of `center`, nearest first (uses the 2dsphere index).
   */
  async nearby(center: LatLng, radius: number, limit: number): Promise<Gem[]> {
    const docs = await GemModel.find({
      'place.location': {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [center.longitude, center.latitude] },
          $maxDistance: radius,
        },
      },
    }).limit(limit).lean<GemDoc[]>();

    return docs.map(fromDoc);
  }

  /**
   * @param bounds the map viewport (must not cross the antimeridian).
   * @param limit most Gems to return.
   * @returns Gems inside `bounds`, highest GemScore first.
   */
  async within(bounds: Bounds, limit: number): Promise<Gem[]> {
    const { south, west, north, east } = bounds;
    const docs = await GemModel.find({
      'place.location': {
        $geoWithin: {
          $geometry: {
            type: 'Polygon',
            coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
          },
        },
      },
    }).sort({ score: -1, _id: 1 }).limit(limit).lean<GemDoc[]>();

    return docs.map(fromDoc);
  }

  /**
   * @param limit most Gems to return.
   * @returns the most recently added Gems, newest first.
   */
  async newest(limit: number): Promise<Gem[]> {
    const docs = await GemModel.find({}).sort({ createdAt: -1, _id: -1 }).limit(limit).lean<GemDoc[]>();
    return docs.map(fromDoc);
  }

  /**
   * @param names Gem names.
   * @returns the stored Gems among them, in no particular order.
   */
  async getMany(names: string[]): Promise<Gem[]> {
    if (names.length === 0) {
      return [];
    }

    const docs = await GemModel.find({ name: { $in: names } }).lean<GemDoc[]>();
    return docs.map(fromDoc);
  }

  /**
   * Stores a Gem's GemScore and the values it was computed from, leaving everything else as stored.
   * `$set` rather than a replace, so `createdAt` (used by the newest-Gems list) is kept.
   * A value that is now `undefined` (e.g. the last rating was removed) is unset.
   *
   * @param gem the rescored Gem.
   */
  async saveScore(gem: Gem): Promise<void> {
    const fields = {
      score: gem.getScore(),
      scoreTime: gem.getScoreTime(),
      nicheness: gem.getNicheness(),
      ratingCount: gem.getRatingCount(),
      ratingAverage: gem.getRatingAverage(),
    };
    const unset = Object.fromEntries(Object.entries(fields).filter(entry => entry[1] === undefined).map(entry => [entry[0], 1]));

    await GemModel.updateOne(
      { name: gem.name },
      { $set: definedOnly(fields), ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}) },
    );
  }

}

export { Gem, Place };

export default GemService
