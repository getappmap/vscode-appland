import { PathLike, promises as fs } from 'fs';
import AppMapAgent, {
  FilesResponse,
  StatusResponse,
  InstallResult,
  InitResponse,
} from './appMapAgent';

export default class AppMapAgentJavaDummy implements AppMapAgent {
  language: string;

  constructor(language: string) {
    this.language = language;
  }

  isInstalled(path: PathLike): Promise<boolean> {
    throw new Error('Language not supported!');
  }
  install(path: PathLike): Promise<InstallResult> {
    throw new Error('Language not supported!');
  }
  init(path: PathLike): Promise<InitResponse> {
    throw new Error('Language not supported!');
  }
  files(path: PathLike): Promise<FilesResponse> {
    throw new Error('Language not supported!');
  }
  status(path: PathLike): Promise<StatusResponse> {
    throw new Error('Language not supported!');
  }
  test(path: PathLike, command: string[]): Promise<void> {
    throw new Error('Language not supported!');
  }
}
