/**
 * The main interface for requesting telemetry data. A new instance of this class should be created for each unique
 * telemetry event. Some results will be cached between data providers, while others may be globally cached for the
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

import { getRecords } from '../util';
import TelemetryDataProvider from './telemetryDataProvider';

export default class TelemetryResolver<DataType extends Record<string, unknown>> {
  constructor(private readonly data: DataType) {}

  /**
   * Requests any number of telemetry providers to resolve thier value, returning a JSON object containing the data
   * ready to be sent out with an event.
   */
  public async resolve<ValueType>(
    ...providers: Array<TelemetryDataProvider<Record<string, unknown>, ValueType>>
  ): Promise<Record<string, ValueType>> {
    const entries = await Promise.all(
      providers.map(async (provider) => [provider.id, await provider.getValue(this.data)])
    );

    return entries.reduce((memo, [providerId, resolvedValue]) => {
      if (typeof resolvedValue === 'object') {
        const flattenedObject = getRecords(resolvedValue, providerId);
        Object.entries(flattenedObject).forEach(([key, value]) => {
          memo[key] = value;
        });
      } else {
        memo[providerId] = resolvedValue;
      }
      return memo;
    }, {});
  }
}
