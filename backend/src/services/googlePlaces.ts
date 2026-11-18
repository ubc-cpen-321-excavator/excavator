import type { protos } from "@googlemaps/places";
import { nonEmpty } from "../utils/defined";
import { distanceMeters, type LatLng } from "../utils/geo";
import { Place, isValidGemName, type PlaceCandidate } from "./gem";
import { InvalidPlaceError } from "./gemErrors";

/**
 * What `GemService` asks Google Places for, and how Google's answers map to Excavator's types.
 * The calls to Google themselves are made by `GemService`.
 */

/**
 * Google Places fields requested when looking up a place for a new Gem.
 * The Places API (New) rejects any request that has no field mask.
 */
export const PLACE_FIELD_MASK = 'id,name,displayName,location,primaryType,editorialSummary,rating,userRatingCount,photos';

/** Google Places fields requested when looking up only a place's photos. */
export const PHOTO_FIELD_MASK = 'photos';

/** Google Places fields requested from a text search for a place's photos. */
export const PHOTO_SEARCH_FIELD_MASK = 'places.photos';

/**
 * How far from a Gem a text search for its photo looks, in metres.
 * Used for Gems whose name is not a real place ID, e.g. the seeded demo Gems.
 */
export const PHOTO_SEARCH_RADIUS_M = 500;

/** Default and largest width of a Gem photo, in pixels (Google allows up to 4800). */
export const GEM_PHOTO_WIDTH_DEFAULT_PX = 800;
export const GEM_PHOTO_WIDTH_MAX_PX = 4800;

/** Google Places fields requested for each nearby place. */
export const NEARBY_FIELD_MASK = 'places.name,places.displayName,places.location,places.primaryType,places.formattedAddress';

/** Most places Google returns for one nearby search. */
export const NEARBY_MAX_RESULTS = 20;

/** gRPC status codes the Places API returns when the place ID is malformed or unknown. */
export const GRPC_INVALID_ARGUMENT = 3;
const GRPC_NOT_FOUND = 5;

/** A place looked up on Google Places, with the extra data a new Gem needs. */
export interface PlaceLookup {
  place: Place;
  /** Google's 1.0–5.0 rating, if the place has one. */
  rating: number | undefined;
  /** Google Places resource name of the place's first photo, `places/<place ID>/photos/<photo ID>`, if it has one. */
  photoName: string | undefined;
  /** Number of Google reviews, if Google gave one. */
  reviewCount: number | undefined;
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
 * @param gPlace a place from Google Places, looked up with `photos` in the field mask.
 * @returns the resource name of its first photo, or `undefined` if it has none.
 */
export function firstPhotoName(gPlace: GooglePlace): string | undefined {
  return nonEmpty(gPlace.photos?.[0]?.name);
}

/**
 * @param err an error thrown by the Places client.
 * @returns `true` if Google rejected the request because the place or photo is malformed or unknown.
 */
export function isNoSuchPlaceError(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return code === GRPC_NOT_FOUND || code === GRPC_INVALID_ARGUMENT;
}

/**
 * Maps a place looked up on Google Places to our `Place` and its Google rating.
 *
 * @param gPlace the place from Google Places.
 * @returns the place (with display name, primary type and description when Google has them) and its rating.
 * @throws `InvalidPlaceError` if Google returned it without a name or location.
 */
export function lookupFromGoogle(gPlace: GooglePlace): PlaceLookup {
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
    photoName: firstPhotoName(gPlace),
  };
}

/**
 * Maps a place from a nearby search to a candidate the user could add.
 *
 * @param gPlace the place from Google Places.
 * @param from where the user is, to measure the distance from.
 * @returns the candidate, or `undefined` if the place has no valid name or location.
 */
export function candidateFromGoogle(gPlace: GooglePlace, from: LatLng): Omit<PlaceCandidate, 'isGem'> | undefined {
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
