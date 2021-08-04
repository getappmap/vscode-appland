import { PathLike } from 'fs';
import TelemetryDataCache from './telemetryDataCache';
import proxy from './proxy';

export type TelemetryDataProviderOptions<DataType, ValueType> = {
  id: string;
  cache?: boolean;
  proxyCache?: Array<keyof DataType>;
  value: (data: DataType) => Promise<ValueType>;
};

/**
 * An abstraction providing a simplified connection between a metric or property identifier and the logic needed to
 * retrieve and format its value.
 *
 * ```typescript
 * export default const projectLanguage = new TelemetryDataProvider({
 *   id: 'com.example.language',
 *   cache: true,
 *   async value(context: TelemetryContext) {
 *     return await LanguageResolver.getLanguage(context.rootDirectory);
 *   },
 * }),
 */
export default class TelemetryDataProvider<DataType extends Record<string, unknown>, ValueType> {
  public readonly id;
  private readonly valueCallback;
  private readonly cache?;
  private readonly argCache?: Array<keyof DataType>;

  constructor(opts: TelemetryDataProviderOptions<DataType, ValueType>) {
    this.id = opts.id;
    this.cache = opts.cache;
    this.valueCallback = opts.value;
  }

  /**
   * Resolve and format the value for this provider. As of now, T is guaranteed to be either a `number` (metrics) or
   * `string` (properties), meaning value types other than this must first be cast to the expected return value.
   */
  async getValue(data: DataType): Promise<ValueType> {
    // If the value is cached, return the cached value.
    if (this.cache && data.rootDirectory) {
      const cachedValue = TelemetryDataCache.getValue<ValueType>(
        this.id,
        data.rootDirectory as PathLike
      );
      if (cachedValue !== undefined) {
        return Promise.resolve(cachedValue);
      }
    }

    // Wrap argument objects which are flagged to use a proxy cache.
    let proxiedData = data;
    if (this.argCache && this.argCache.length) {
      proxiedData = Object.entries(data).reduce((acc, [key, value]) => {
        let proxiedValue = value;

        if (
          this.argCache &&
          this.argCache.includes(key) &&
          typeof value === 'object' &&
          value !== null
        ) {
          proxiedValue = proxy(value);
        } else if (proxiedValue !== undefined) {
          acc[key] = proxiedValue;
        }

        return acc;
      }, {} as Record<string, unknown>) as DataType;
    }

    // Resolve the value.
    const newValue = await this.valueCallback(proxiedData);

    // Cache the value for the lifetime of the extension if the cache option was set.
    if (this.cache && data.rootDirectory) {
      TelemetryDataCache.setValue(this.id, data.rootDirectory as PathLike, newValue);
    }

    return newValue;
  }
}
