export default interface VersionControlProperties {
  isIgnored(path: string): boolean;
}
