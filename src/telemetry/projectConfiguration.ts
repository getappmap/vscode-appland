import { PathLike } from 'fs';

export default interface ProjectConfiguration {
  getLanguage(): string;
  getAppMapAgentVersionLocal(): Promise<string>;
  getAppMapAgentVersionGlobal(): Promise<string>;
  isConfigurationFile(filePath: PathLike): boolean;
}
