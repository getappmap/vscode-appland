/**
 * Return a new array by removing duplicate values.
 * If a transform is provided, the elements are compared on the results of that function.
 * If sort is not false, the elements are sorted (perhaps on the transform result);
 * sort be a comparator or true for the default.
 */
export default function uniq<T>(
  array: ReadonlyArray<T>,
  xform?: undefined,
  sort?: boolean | ((a: T, b: T) => number)
): T[];
export default function uniq<T, U>(
  array: ReadonlyArray<T>,
  xform: (x: T) => U,
  sort?: boolean | ((a: U, b: U) => number)
): T[];
export default function uniq<T, U = T>(
  array: ReadonlyArray<T>,
  xform?: (x: T) => U,
  sort: boolean | ((a: U, b: U) => number) = false
): T[] {
  if (xform) {
    const map = new Map<U, T>(array.map((x) => [xform(x), x]));
    if (!sort) return [...map.values()];

    const keys = [...map.keys()];
    if (typeof sort === 'function') keys.sort(sort);
    else keys.sort();
    return keys.map((k) => map.get(k) as T); // we know the elements exist
  } else {
    const elems = [...new Set<T>(array)];
    if (typeof sort === 'function') {
      // the uniq<T> signature ensures this cast is valid
      elems.sort(sort as unknown as (a: T, b: T) => number);
    } else if (sort) elems.sort();
    return elems;
  }
}
