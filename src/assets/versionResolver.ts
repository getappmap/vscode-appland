export interface VersionResolver {
  getLatestVersion(): Promise<string | undefined>;
}
