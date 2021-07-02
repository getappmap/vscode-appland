import { PathLike } from 'fs';

export interface ConfigMetadata {
  readonly app?: string;
  readonly valid: boolean;
  readonly present: boolean;
}

export interface ProjectMetadata {
  readonly agentVersion: string;
  readonly language: string;
  readonly remoteRecordingCapable?: boolean;
  readonly integrationTests?: boolean;
}

export interface StatusProperties {
  readonly config: ConfigMetadata;
  readonly project: ProjectMetadata;
}

export interface StatusCommand {
  readonly workingDirectory?: PathLike;
  readonly directory?: PathLike;
  readonly command: string;
}

export interface StatusEndpoints {
  readonly applicationUrl: string;
  readonly remoteRecordingUrl: string;
}

export interface StatusResponse {
  readonly commands: Array<StatusCommand>;
  readonly endpoints: StatusEndpoints;
  readonly properties: StatusProperties;
}

export interface FilesResponse {
  readonly configuration: Array<PathLike>;
  readonly testDirectories: Array<PathLike>;
  readonly integrationTestPaths: Array<PathLike>;
  readonly appmapDirectory: Array<PathLike>;
}

export interface InitResponse {
  readonly configuration: {
    filename: string;
    contents: string;
  };
}

export type InstallResult = 'none' | 'upgraded' | 'installed';

export default interface AppMapAgent {
  /**
   * The language that this agent provides support for. This should match a language identifier defined in
   * languageResolver.ts under the LANGUAGES array.
   */
  readonly language: string;

  isInstalled(path: PathLike): Promise<boolean>;
  /**
   * Install the agent CLI using the latest version.
   */
  install(path: PathLike): Promise<InstallResult>;

  /**
   * Execute the AppMap CLI init command.
   */
  init(path: PathLike): Promise<InitResponse>;

  /**
   * Execute the AppMap CLI files command.
   */
  files(path: PathLike): Promise<FilesResponse>;

  /**
   * Execute the AppMap CLI status command.
   */
  status(path: PathLike): Promise<StatusResponse>;
}
