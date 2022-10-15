/**
 * Return a new array by removing duplicate values.
 * If a transform is provided, the elements are compared on the results of that function.
 */
export default function uniq<T, U>(array: ReadonlyArray<T>, xform?: (x: T) => U): T[] {
  if (xform) {
    const map = new Map<U, T>(array.map((x) => [xform(x), x]));
    return [...map.values()];
  } else return [...new Set<T>(array)];
}
