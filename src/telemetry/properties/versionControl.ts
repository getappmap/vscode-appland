import { PathLike } from 'fs';

export default interface VersionControlProperties {
  isIgnored(path: PathLike): boolean;
}
