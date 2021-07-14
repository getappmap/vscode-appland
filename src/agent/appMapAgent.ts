import { PathLike, promises as fs } from 'fs';
import { join } from 'path';

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
  readonly program: string;
  readonly args?: string[];
  readonly environment?: NodeJS.ProcessEnv;
}

export interface StatusTestCommand {
  readonly framework: string;
  readonly command: StatusCommand;
}

export interface StatusEndpoints {
  readonly applicationUrl: string;
  readonly remoteRecordingUrl: string;
}

export interface StatusResponse {
  readonly start_command: StatusCommand; // TODO: this should be camelCased
  readonly test_commands: readonly StatusTestCommand[]; // TODO: this should be camelCased
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

  /**
   * Execute tests as reported from the status command.
   */
  test(path: PathLike): Promise<void>;
}

export abstract class AppMapAgentBase {
  protected async writeConfig(path: PathLike, config: string): Promise<InitResponse> {
    const response = JSON.parse(config) as InitResponse;
    const { filename, contents } = response.configuration;
    
    console.log(`writing config file ${filename}`);
    await fs.writeFile(join(path as string, filename), contents);

    return response;
  }
}
