import { PathLike } from 'fs';

/**
 * Provides a simple in-memory caching mechanism, useful for storing data that should only persist for the lifetime of
 * the current session. Caches are keyed by directory, allowing a multi-directory workspace to maintain its own data
 * for each directory.
 */
export default class TelemetryDataCache {
  private static CACHE = {};

  public static setValue<T>(id: string, rootDir: PathLike | undefined, value: T): void {
    let workspace = this.CACHE[rootDir as string];
    if (!workspace) {
      workspace = {};
      this.CACHE[rootDir as string] = workspace;
    }

    workspace[id] = value;
  }

  public static getValue<T>(id: string, rootDir?: PathLike): T | undefined {
    const workspace = this.CACHE[rootDir as string];
    if (!workspace) {
      return undefined;
    }

    return workspace[id];
  }
}
