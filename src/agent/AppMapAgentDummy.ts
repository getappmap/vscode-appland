import { PathLike, promises as fs } from 'fs';
import AppMapAgent, {
  FilesResponse,
  StatusResponse,
  InstallResult,
  InitResponse,
} from './appMapAgent';

export class ErrorUnsupportedLanguage extends Error {
  constructor(langauge: string) {
    super(`Language '${langauge}' is not supported`);
    Object.setPrototypeOf(this, ErrorUnsupportedLanguage.prototype);
  }
}

export default class AppMapAgentJavaDummy implements AppMapAgent {
  language: string;

  constructor(language: string) {
    this.language = language;
  }

  isInstalled(path: PathLike): Promise<boolean> {
    throw new ErrorUnsupportedLanguage(this.language);
  }
  install(path: PathLike): Promise<InstallResult> {
    throw new ErrorUnsupportedLanguage(this.language);
  }
  init(path: PathLike): Promise<InitResponse> {
    throw new ErrorUnsupportedLanguage(this.language);
  }
  files(path: PathLike): Promise<FilesResponse> {
    throw new ErrorUnsupportedLanguage(this.language);
  }
  status(path: PathLike): Promise<StatusResponse> {
    throw new ErrorUnsupportedLanguage(this.language);
  }
  test(path: PathLike, command: string[]): Promise<void> {
    throw new ErrorUnsupportedLanguage(this.language);
  }
}
