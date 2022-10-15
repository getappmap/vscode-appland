import ValueCache from './ValueCache';

/** Convert a function into a memoized form.
 * WeakMap is used to keep the memoized inputs so as not to prevent GC.
 */
export default function // eslint-disable-next-line @typescript-eslint/ban-types
memoize<T extends object, U>(fn: (x: T) => U): (x: T) => U {
  const cache = new ValueCache<T, U>();
  return (x) => cache.getOrStore(x, () => fn(x));
}
