import { PathLike } from 'fs';
import TelemetryContext from './telemetryContext';
import TelemetryDataCache from './telemetryDataCache';

// export type TelemetryContext = {
//   rootDirectory: PathLike;
//   project: ProjectConfiguration;
//   filePath?: PathLike | undefined;
// };

export type TelemetryDataProviderOptions<T> = {
  id: string;
  performCaching?: boolean;
  value: (context: TelemetryContext) => Promise<T>;
};

export default class TelemetryDataProvider<T> {
  public readonly id;
  private readonly valueCallback;
  private readonly performCaching?;

  constructor(opts: TelemetryDataProviderOptions<T>) {
    this.id = opts.id;
    this.performCaching = opts.performCaching;
    this.valueCallback = opts.value;
  }

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
