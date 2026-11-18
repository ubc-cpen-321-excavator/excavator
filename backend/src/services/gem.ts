import { computeGemScore } from "../utils/gemScore";

/**
 * Gem and Place, and the rules for Gem names and Google Places types.
 * Used by `GemService`, its repository and the other components that work with Gems.
 */

/** Google Places type, e.g. `cafe`, `hiking_area`. */
const PLACE_TYPE_PATTERN = /^[a-z_]{1,50}$/;

/** Most place types one nearby search can filter by; Google Places allows up to 50 `includedTypes`. */
export const MAX_PLACE_TYPES = 50;

/** Google Places place ID, e.g. `ChIJN1t_tDeuEmsRUsoyG83frY4`. */
const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]{1,255}$/;

/** Prefix of a Google Places resource name; a Gem's name is this plus the place ID. */
export const PLACE_NAME_PREFIX = 'places/';

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

/**
 * A Google Places place, as much of it as Excavator keeps.
 */
export class Place {
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
export class Gem {
  /** Same as the place's resource name, `places/<place ID>`. */
  readonly name: string;
  readonly place: Place;
  /** User ID (Google `sub`) of the user who added the Gem. */
  readonly addedBy?: string | undefined;
  /** Path of the Gem's photo on this server, `/gem/<place ID>/photo` (redirects to the image; 404 if it has none). */
  readonly photoUrl: string;
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
    this.photoUrl = `/gem/${encodeURIComponent(name.slice(PLACE_NAME_PREFIX.length))}/photo`;
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

/** A place near the user that they could add as a Gem (not a Gem yet). Returned by `GET /place/nearby`. */
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
}
