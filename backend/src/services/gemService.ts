import { PlacesClient } from "@googlemaps/places";
import { env } from "../config/env";
import { nonEmpty } from "../utils/defined";
import { distanceMeters, type Bounds, type LatLng } from "../utils/geo";
import { Gem, MAX_PLACE_TYPES, isValidGemName, isValidPlaceType, type PlaceCandidate } from "./gem";
import {
  GemExistsError,
  InvalidPlaceError,
  InvalidPlaceTypeError,
  NoSuchGemError,
  PlacesUnavailableError,
  TooFarError,
} from "./gemErrors";
import { GemRepo } from "./gemRepo";
import {
  GRPC_INVALID_ARGUMENT,
  NEARBY_FIELD_MASK,
  NEARBY_MAX_RESULTS,
  PHOTO_FIELD_MASK,
  PHOTO_SEARCH_FIELD_MASK,
  PHOTO_SEARCH_RADIUS_M,
  PLACE_FIELD_MASK,
  candidateFromGoogle,
  firstPhotoName,
  isNoSuchPlaceError,
  lookupFromGoogle,
  type PlaceLookup,
} from "./googlePlaces";

// Gems are split over a few files; everything other components use is re-exported from here.
export {
  Gem,
  MAX_PLACE_TYPES,
  Place,
  gemNameFromPlaceId,
  isValidGemName,
  isValidPlaceType,
  parsePlaceTypes,
  type PlaceCandidate,
} from "./gem";
export {
  GemExistsError,
  InvalidPlaceError,
  InvalidPlaceTypeError,
  NoSuchGemError,
  PlacesUnavailableError,
  TooFarError,
} from "./gemErrors";

/** Default and largest width of a Gem photo, in pixels (Google allows up to 4800). */
export const GEM_PHOTO_WIDTH_DEFAULT_PX = 800;
export const GEM_PHOTO_WIDTH_MAX_PX = 4800;

/**
 * How close a user must be to a place to add it as a Gem, in metres.
 * Nearby search uses the same radius, so it only lists places the user can add.
 */
export const MAX_ADD_DISTANCE_M = 200;

/** Default and largest number of Gems returned by one list query. */
export const GEM_LIST_DEFAULT = 20;
export const GEM_LIST_MAX = 50;

/** Default and largest radius of a nearby-Gems query, in metres. */
export const GEM_NEARBY_RADIUS_DEFAULT_M = 5_000;
export const GEM_NEARBY_RADIUS_MAX_M = 50_000;

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
      if (isNoSuchPlaceError(err)) {
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
   * @returns the new Gem, with `quality` (Google rating), `reviewCount`, nicheness and GemScore set,
   *   and the name of the place's first photo, if it has one.
   * @throws `InvalidPlaceError` if `name` is malformed or not a real place.
   * @throws `TooFarError` if the place is too far from the user.
   * @constructs `Gem`
   */
  private async newGem(name: string, addedBy: string, userLocation: LatLng): Promise<{ gem: Gem; photoName: string | undefined }> {
    if (!isValidGemName(name)) {
      throw new InvalidPlaceError('Invalid place name.');
    }

    const { place, rating, reviewCount, photoName } = await this.getPlace(name);

    if (distanceMeters(userLocation, place) > MAX_ADD_DISTANCE_M) {
      throw new TooFarError('Too far from place.');
    }

    const gem = new Gem(name, place, addedBy);
    gem.setQuality(rating);
    gem.setReviewCount(reviewCount);
    gem.rescore();

    return { gem, photoName };
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

    const { gem, photoName } = await this.newGem(name, addedBy, userLocation);
    await this.repo.insert(gem, photoName);

    return gem;
  }

  /**
   * Deletes a Gem matching the name.
   *
   * @param name
   * @throws InvalidPlaceError
   * @throws NoSuchGemError
   * @throws the database error
   */
  async deleteGem(name: string): Promise<void> {
    if (!isValidGemName(name)) {
      throw new InvalidPlaceError('Invalid place name.');
    }

    if (!await this.repo.has(name)) {
      throw new NoSuchGemError('No such Gem.');
    }

    await this.repo.delete(name);
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
   * Takes the sequence number of a rating just stored, for `applyAppRatings`. Call it after storing the
   * rating and before recounting, so a rating with a later number always has a recount that includes it.
   *
   * @param name Gem name, `places/<place ID>`.
   * @returns the sequence number.
   * @throws `NoSuchGemError` if there is no such Gem.
   */
  async nextRatingSeq(name: string): Promise<number> {
    const seq = await this.repo.nextRatingSeq(name);
    if (seq === undefined) {
      throw new NoSuchGemError('No such Gem.');
    }

    return seq;
  }

  /**
   * Stores a Gem's new Excavator rating totals and the GemScore they lead to, unless a later rating's
   * totals are already stored: those come from a later recount, which also counts this rating, so an
   * older recount never overwrites them when two users rate at once.
   *
   * @param name Gem name, `places/<place ID>`.
   * @param count number of Excavator users' ratings.
   * @param average their average, 1–5.
   * @param ratingSeq the rating's sequence number, from `nextRatingSeq`.
   * @returns the Gem as stored: rescored with these totals, or with a later rating's.
   * @throws `NoSuchGemError` if there is no such Gem; nothing is stored.
   */
  async applyAppRatings(name: string, count: number, average: number | undefined, ratingSeq: number): Promise<Gem> {
    const gem = await this.getGem(name);
    if (!gem) {
      throw new NoSuchGemError('No such Gem.');
    }

    gem.setAppRatings(count, average);
    gem.rescore();
    if (await this.repo.saveScore(gem, ratingSeq)) {
      return gem;
    }

    const current = await this.getGem(name);
    if (!current) {
      throw new NoSuchGemError('No such Gem.');
    }
    return current;
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
   * @returns up to 20 places that are not Gems yet, nearest first; places that already are Gems are left out.
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

    // Places that are already Gems can't be added again, so they aren't offered.
    const gems = await this.repo.namesIn(candidates.map(c => c.name));

    return candidates.filter(c => !gems.has(c.name));
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
   * @param near if given, only Gems within `near.radius` metres of `near.center`.
   * @returns the most recently added Gems, newest first.
   */
  async getNewestGems(limit: number, near?: { center: LatLng; radius: number }): Promise<Gem[]> {
    return this.repo.newest(limit, near);
  }

  /**
   * Gets a short-lived URL of a Gem's photo, served by Google.
   * Uses the photo name stored with the Gem; if there is none, or Google no longer knows it,
   * finds the Gem's first photo on Google Places and stores its name for next time.
   *
   * @param gem a stored Gem.
   * @param maxWidthPx largest width of the image, 1–`GEM_PHOTO_WIDTH_MAX_PX`.
   * @returns the image URL, or `undefined` if Google has no photo of the place.
   * @throws `PlacesUnavailableError` if Google Places fails.
   * @throws the database error if reading or storing the photo name fails.
   */
  async getPhotoUri(gem: Gem, maxWidthPx: number): Promise<string | undefined> {
    const stored = await this.repo.getPhotoName(gem.name);
    if (stored !== undefined) {
      const uri = await this.photoMediaUri(stored, maxWidthPx);
      if (uri !== undefined) {
        return uri;
      }
    }

    const photoName = await this.findPhotoName(gem);
    if (photoName === undefined || photoName === stored) {
      return undefined;
    }

    await this.repo.setPhotoName(gem.name, photoName);
    return this.photoMediaUri(photoName, maxWidthPx);
  }

  /**
   * Finds a Gem's first photo on Google Places. Looks the place up by name; if Google does not know
   * the name (e.g. a seeded demo Gem), searches for the Gem's display name around its location instead.
   *
   * @param gem the Gem.
   * @returns the photo's resource name, or `undefined` if Google has none.
   * @throws `PlacesUnavailableError` if Google Places fails.
   */
  private async findPhotoName(gem: Gem): Promise<string | undefined> {
    try {
      const [gPlace] = await this.gpClient.getPlace(
        { name: gem.name },
        { otherArgs: { headers: { 'X-Goog-FieldMask': PHOTO_FIELD_MASK } } },
      );
      return gPlace ? firstPhotoName(gPlace) : undefined;
    } catch (err) {
      if (!isNoSuchPlaceError(err)) {
        throw new PlacesUnavailableError('Photo lookup failed.', { cause: err });
      }
    }

    const { latitude, longitude } = gem.place;
    try {
      const [res] = await this.gpClient.searchText(
        {
          textQuery: gem.place.getDisplayName(),
          locationBias: { circle: { center: { latitude, longitude }, radius: PHOTO_SEARCH_RADIUS_M } },
          maxResultCount: 1,
        },
        { otherArgs: { headers: { 'X-Goog-FieldMask': PHOTO_SEARCH_FIELD_MASK } } },
      );
      const first = res.places?.[0];
      return first ? firstPhotoName(first) : undefined;
    } catch (err) {
      throw new PlacesUnavailableError('Photo search failed.', { cause: err });
    }
  }

  /**
   * @param photoName Google Places photo resource name.
   * @param maxWidthPx largest width of the image.
   * @returns a short-lived URL of the image, or `undefined` if Google no longer knows the photo.
   * @throws `PlacesUnavailableError` if Google Places fails.
   */
  private async photoMediaUri(photoName: string, maxWidthPx: number): Promise<string | undefined> {
    try {
      const [media] = await this.gpClient.getPhotoMedia({
        name: `${photoName}/media`,
        maxWidthPx,
        skipHttpRedirect: true,
      });
      return nonEmpty(media.photoUri);
    } catch (err) {
      if (isNoSuchPlaceError(err)) {
        return undefined;
      }
      throw new PlacesUnavailableError('Photo download failed.', { cause: err });
    }
  }
}

export default GemService
