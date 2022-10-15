/** Convert a function into a memoized form.
 * WeakMap is used to keep the memoized inputs so as not to prevent GC.
 */
export default function // eslint-disable-next-line @typescript-eslint/ban-types
memoize<T extends object, U>(fn: (x: T) => U): (x: T) => U {
  const cache = new WeakMap<T, U>();
  return (x) => {
    let result = cache.get(x);
    if (result === undefined) {
      result = fn(x);
      cache.set(x, result);
    }
    return result;
  };
}
