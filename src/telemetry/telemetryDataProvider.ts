import TelemetryContext from './telemetryContext';
import TelemetryDataCache from './telemetryDataCache';

export type TelemetryDataProviderOptions<T> = {
  id: string;
  performCaching?: boolean;
  value: (context: TelemetryContext) => Promise<T>;
};

/**
 * An abstraction providing a simplified connection between a metric or property identifier and the logic needed to
 * retrieve and format its value.
 *
 * ```typescript
 * export default const projectLanguage = new TelemetryDataProvider({
 *   id: 'com.example.language',
 *   performCaching: true,
 *   async value(context: TelemetryContext) {
 *     return await LanguageResolver.getLanguage(context.rootDirectory);
 *   },
 * }),
 */
export default class TelemetryDataProvider<T> {
  public readonly id;
  private readonly valueCallback;
  private readonly performCaching?;

  constructor(opts: TelemetryDataProviderOptions<T>) {
    this.id = opts.id;
    this.performCaching = opts.performCaching;
    this.valueCallback = opts.value;
  }

  /**
   * Resolve and format the value for this provider. As of now, T is guaranteed to be either a `number` (metrics) or
   * `string` (properties), meaning value types other than this must first be cast to the expected return value.
   */
  async getValue(context: TelemetryContext): Promise<T> {
    if (this.performCaching) {
      const cachedValue = TelemetryDataCache.getValue<T>(this.id, context.rootDirectory);
      if (cachedValue !== undefined) {
        return Promise.resolve(cachedValue);
      }
    }

    const newValue = await this.valueCallback(context);

    if (this.performCaching) {
      TelemetryDataCache.setValue(this.id, context.rootDirectory, newValue);
    }

    return newValue;
  }
}
