import { PathLike } from 'fs';

export default class TelemetryDataCache {
  private static CACHE = {};

  public static setValue<T>(id: string, rootDir: PathLike, value: T): void {
    let workspace = this.CACHE[rootDir as string];
    if (!workspace) {
      workspace = {};
      this.CACHE[rootDir as string] = workspace;
    }

    workspace[id] = value;
  }

  public static getValue<T>(id: string, rootDir: PathLike): T | undefined {
    const workspace = this.CACHE[rootDir as string];
    if (!workspace) {
      return undefined;
    }

    return workspace[id];
  }
}
