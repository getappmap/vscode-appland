import { PathLike } from 'fs';

export default interface VersionControlProperties {
  isIgnored(path: PathLike): Promise<boolean>;
  isTracked(path: PathLike): Promise<boolean>;
  repositoryId(path: PathLike): Promise<string>;
}
