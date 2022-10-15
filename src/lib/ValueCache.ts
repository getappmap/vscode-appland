/**
 * A WeakMap with an extra getOrStore method, useful for example for caching computed properties.
 *
 * @example
 *    const sizes = new ValueCache<Widget, number>();
 *
 *    class Widget {
 *      get size(): number {
 *        return sizes.getOrStore(this, () => {
 *          return expensiveComputation(this);
 *        });
 *      }
 *    }
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export default class ValueCache<T extends object, U> extends WeakMap<T, U> {
  /**
   * Returns the specified element from the map, calling fn to compute it first if missing.
   */
  getOrStore(x: T, fn: () => U): U {
    if (!this.has(x)) this.set(x, fn());
    return this.get(x) as U;
  }
}
