import AppMapAgent, { StatusResponse } from '../agent/appMapAgent';
import LanguageResolver from '../languageResolver';
import { EventContext } from './telemetryResolver';

/**
 * Provides access to information about the current project.
 */
export default class TelemetryContext {
  public readonly language?: string;
  public readonly event: EventContext;

  private readonly agent?: AppMapAgent;
  private statusResponse?: StatusResponse;

  constructor(eventContext: EventContext, language?: string) {
    this.event = eventContext;
    this.language = language;

    if (this.event.rootDirectory && language) {
      this.agent = LanguageResolver.getAgentForLanguage(language);
    }
  }

  /**
   * Query the AppMap agent for the project status if it's available. Subsequent calls to this method within the same
   * context will use a cached value.
   */
  public async getStatus(): Promise<StatusResponse | undefined> {
    if (!this.statusResponse && this.agent && this.event.rootDirectory) {
      // Cache the response for this context - we don't want to continuously exec if we can avoid it.
      this.statusResponse = await this.agent.status(this.event.rootDirectory);
    }

    return this.statusResponse;
  }
}
