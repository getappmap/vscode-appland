import { PathLike } from 'fs';
import TelemetryDataProvider from './telemetryDataProvider';
import TelemetryContext from './telemetryContext';
import LanguageResolver from '../languageResolver';

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
export default class TelemetryResolver {
  private rootDir: PathLike;
  private filePath?: PathLike | undefined;

  constructor(rootDir: PathLike, filePath?: PathLike | undefined) {
    this.rootDir = rootDir;
    this.filePath = filePath;
  }

  /**
   * Requests any number of telemetry providers to resolve thier value, returning a JSON object containing the data
   * ready to be sent out with an event.
   */
  public async resolve<T>(
    ...providers: Array<TelemetryDataProvider<T>>
  ): Promise<Record<string, T>> {
    const language = await LanguageResolver.getLanguage(this.rootDir);
    const context = new TelemetryContext(this.rootDir, language, this.filePath);
    const entries = await Promise.all(
      providers.map(async (provider) => [provider.id, await provider.getValue(context)])
    );

    return entries.reduce((memo, [k, v]) => {
      memo[k] = v;
      return memo;
    }, {});
  }
}
