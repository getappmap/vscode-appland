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
  constructor(
    readonly language: string,
    readonly projectTypes?: string,
    readonly enabled: boolean = true
  ) {}

  isInstalled(): Promise<boolean> {
    throw new ErrorUnsupportedLanguage(this.language);
  }
  install(): Promise<InstallResult> {
    throw new ErrorUnsupportedLanguage(this.language);
  }
  init(): Promise<InitResponse> {
    throw new ErrorUnsupportedLanguage(this.language);
  }
  files(): Promise<FilesResponse> {
    throw new ErrorUnsupportedLanguage(this.language);
  }
  status(): Promise<StatusResponse> {
    throw new ErrorUnsupportedLanguage(this.language);
  }
  test(): Promise<void> {
    throw new ErrorUnsupportedLanguage(this.language);
  }
}
