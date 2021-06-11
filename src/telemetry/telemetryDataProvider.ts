import { PathLike } from 'fs';

export type TelemetryContext = {
  rootDirectory: PathLike;
  filePath?: PathLike | undefined;
};

export default class TelemetryDataProvider<T> {
  public readonly id;
  private readonly valueCallback;

  constructor(id: string, valueCallback: (context: TelemetryContext) => Promise<T>) {
    this.id = id;
    this.valueCallback = valueCallback;
  }

  async getValue(context: TelemetryContext): Promise<T> {
    return await this.valueCallback(context);
  }
}
