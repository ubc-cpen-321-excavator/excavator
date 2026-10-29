/** A point on Earth, in degrees. */
export interface LatLng {
  latitude: number;
  longitude: number;
}

/** A map viewport, in degrees. Must not cross the antimeridian (west < east). */
export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Mean Earth radius, in metres. */
const EARTH_RADIUS_M = 6_371_000;

/** A plain decimal number, e.g. `49.26` or `-123.25`; no exponents, spaces or hex. */
const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;

/**
 * Reads a number from a query parameter or JSON field.
 *
 * @param value a finite number, or a string holding a plain decimal number.
 * @returns the number, or `undefined` for anything else (incl. arrays from repeated query params).
 */
export function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string' && DECIMAL_PATTERN.test(value)) {
    return Number(value);
  }
  return undefined;
}

/**
 * Reads a whole number in a range from a query parameter, with a default when it is absent.
 *
 * @param value the raw value; `undefined` means "use the default".
 * @param fallback returned when `value` is `undefined`.
 * @param min smallest accepted value.
 * @param max largest accepted value.
 * @returns the integer, the default, or `undefined` if `value` is present but not an integer in range.
 */
export function toIntInRange(value: unknown, fallback: number, min: number, max: number): number | undefined {
  if (value === undefined) {
    return fallback;
  }

  const n = toNumber(value);
  return n !== undefined && Number.isInteger(n) && n >= min && n <= max ? n : undefined;
}

/**
 * Reads a point from two raw values.
 *
 * @param latitude raw latitude, -90 to 90.
 * @param longitude raw longitude, -180 to 180.
 * @returns the point, or `undefined` if either value is missing, not a number, or out of range.
 */
export function toLatLng(latitude: unknown, longitude: unknown): LatLng | undefined {
  const lat = toNumber(latitude);
  const lng = toNumber(longitude);

  if (lat === undefined || lng === undefined || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return undefined;
  }

  return { latitude: lat, longitude: lng };
}

/**
 * Reads a map viewport from four raw values.
 *
 * @returns the bounds, or `undefined` if a value is invalid, south >= north, or west >= east
 *          (viewports crossing the antimeridian are not supported).
 */
export function toBounds(south: unknown, west: unknown, north: unknown, east: unknown): Bounds | undefined {
  const sw = toLatLng(south, west);
  const ne = toLatLng(north, east);

  if (!sw || !ne || sw.latitude >= ne.latitude || sw.longitude >= ne.longitude) {
    return undefined;
  }

  return { south: sw.latitude, west: sw.longitude, north: ne.latitude, east: ne.longitude };
}

/**
 * Great-circle distance between two points (haversine formula).
 *
 * @returns the distance in metres.
 */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number): number => deg * Math.PI / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}
