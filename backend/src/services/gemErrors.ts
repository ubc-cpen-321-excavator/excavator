/**
 * Errors thrown by `GemService` and its repository. Each one says which HTTP status it maps to.
 */

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
