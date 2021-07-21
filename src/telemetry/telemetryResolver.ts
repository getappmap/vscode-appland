import { PathLike } from 'fs';
import TelemetryDataProvider from './telemetryDataProvider';
import TelemetryContext from './telemetryContext';
import LanguageResolver from '../languageResolver';
import Milestone from '../milestones';

/**
 * The main interface for requesting telemetry data. A new instance of this class should be created for each unique
 * telemetry event. Some results will be cached between data prodivers, while others may be globally cached for the
 * entirety of the session.
 *
 * ```typescript
 * const telemetry = new TelemetryResolver(workspaceUri.fsPath);
 * return telemetry.resolve(
 *   Properties.Project.AGENT_VERSION_GLOBAL,
 *   Properties.Project.AGENT_VERSION_PROJECT,
 *   Properties.Project.IS_CONFIG_PRESENT,
 *   Properties.Project.LANGUAGE,
 * );
 * ```
 *
 * Outputs
 * ```json
 * {
 *   "appmap.project.agent_version_global": "0.40.0",
 *   "appmap.project.agent_version_project": "0.42.0",
 *   "appmap.project.is_config_present": "true",
 *   "appmap.project.language": "ruby"
 * }
 * ```
 */

/**
 * EventContext contains data that may be provided from the event sender.
 */
export interface EventContext {
  rootDirectory?: PathLike;
  milestone?: Milestone;
  file?: PathLike;
  exception?: Error;
}

export default class TelemetryResolver {
  private eventContext: EventContext;

  constructor(eventContext: EventContext) {
    this.eventContext = eventContext;
  }

  /**
   * Requests any number of telemetry providers to resolve thier value, returning a JSON object containing the data
   * ready to be sent out with an event.
   */
  public async resolve<T>(
    ...providers: Array<TelemetryDataProvider<T>>
  ): Promise<Record<string, T>> {
    const { rootDirectory } = this.eventContext;
    let language: string | undefined;
    if (rootDirectory) {
      language = await LanguageResolver.getLanguage(rootDirectory);
    }

    const context = new TelemetryContext(this.eventContext, language);
    const entries = await Promise.all(
      providers.map(async (provider) => [provider.id, await provider.getValue(context)])
    );

    return entries.reduce((memo, [k, v]) => {
      memo[k] = v;
      return memo;
    }, {});
  }
}
