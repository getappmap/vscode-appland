import { PathLike } from 'fs';
import Cli, { StatusResponse } from '../agent/appMapAgent';
import LanguageResolver from '../languageResolver';

/**
 * Provides access to information about the current project.
 */
export default class TelemetryContext {
  public readonly rootDirectory: PathLike;
  public readonly language: string;
  public readonly filePath?: PathLike | undefined;

  private readonly agent?: Cli;
  private statusResponse?: StatusResponse;

  constructor(rootDirectory: PathLike, language: string, filePath?: PathLike | undefined) {
    this.rootDirectory = rootDirectory;
    this.filePath = filePath;
    this.language = language;
    this.agent = LanguageResolver.getAgentForLanguage(language);
  }

  /**
   * Query the AppMap agent for the project status if it's available. Subsequent calls to this method within the same
   * context will use a cached value.
   */
  public async getStatus(): Promise<StatusResponse | undefined> {
    if (!this.statusResponse && this.agent) {
      // Cache the response for this context - we don't want to continuously exec if we can avoid it.
      this.statusResponse = await this.agent.status(this.rootDirectory);
    }

    return this.statusResponse;
  }
}
