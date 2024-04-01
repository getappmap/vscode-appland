export default interface DownloadUrlResolver {
  getDownloadUrl(version: string): Promise<string | undefined>;
}
