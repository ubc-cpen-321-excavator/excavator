/** Same as `T` but with `undefined` taken out of every property's type. */
export type DefinedOnly<T> = { [K in keyof T]?: Exclude<T[K], undefined> };

/**
 * Leaves out undefined values; Mongo should not store them.
 *
 * @param obj object whose properties may be `undefined`.
 * @returns a copy of `obj` without the `undefined` properties.
 */
export function definedOnly<T extends object>(obj: T): DefinedOnly<T> {
  return Object.fromEntries(Object.entries(obj).filter(entry => entry[1] !== undefined)) as DefinedOnly<T>;
}

/**
 * Treats an empty string like a missing one, as Google does for fields it has no value for.
 *
 * @param value a string that may be missing, `null` or empty.
 * @returns `value`, or `undefined` if it is missing, `null` or empty.
 */
export function nonEmpty(value: string | null | undefined): string | undefined {
  return value === null || value === undefined || value === '' ? undefined : value;
}

/**
 * Mongo gives back `null` for fields stored as null; our classes use `undefined` for "not set".
 *
 * @param value a stored value that may be `null`.
 * @returns `value`, or `undefined` if it is `null`.
 */
export function orUndefined<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}
