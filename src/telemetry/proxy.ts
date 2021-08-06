class MethodCallCache {
  private readonly cache = {};

  apply(
    methodId: string,
    method: (...args: unknown[]) => unknown,
    thisArg: unknown,
    args: unknown[]
  ) {
    let cachedResults = this.cache[methodId];
    const argKey = args.map((arg) => JSON.stringify(arg)).join(',');

    if (!cachedResults) {
      cachedResults = {};
      this.cache[methodId] = cachedResults;
    } else {
      const cachedResult = cachedResults[argKey];
      if (cachedResult) {
        return cachedResult;
      }
    }

    const result = Reflect.apply(method, thisArg, args);
    cachedResults[argKey] = result;

    return result;
  }
}

export default function proxy<T>(obj: T): T {
  const cache = new MethodCallCache();
  // eslint-disable-next-line @typescript-eslint/ban-types
  const objProxy = new Proxy((obj as unknown) as object, {
    get(target, key) {
      if (typeof target[key] === 'function') {
        return new Proxy(target[key], {
          apply(method: (...args: unknown[]) => unknown, thisArg, args) {
            return cache.apply(key as string, method, thisArg, args);
          },
        });
      }

      return target[key];
    },
  });

  return (objProxy as unknown) as T;
}
