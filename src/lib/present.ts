/**
 * Checks if a value is present, ie. not null or undefined.
 */
export default function present<T>(x: T): x is Exclude<T, null | undefined> {
  return !(x === undefined || x === null);
}
