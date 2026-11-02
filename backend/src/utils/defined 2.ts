/** Same as `T` but with `undefined` taken out of every property's type. */
export type DefinedOnly<T> = { [K in keyof T]?: Exclude<T[K], undefined> };

/**
 * Leaves out undefined values; Mongo should not store them.
 *
 * @param obj object whose properties may be `undefined`.
 * @returns a copy of `obj` without the `undefined` properties.
 */
export function definedOnly<T extends object>(obj: T): DefinedOnly<T> {
  return Object.fromEntries(Object.entries(obj).filter(([_k, v]) => v !== undefined)) as DefinedOnly<T>;
}
