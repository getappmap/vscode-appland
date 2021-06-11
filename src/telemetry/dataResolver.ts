import TelemetryDataProvider, { TelemetryContext } from './telemetryDataProvider';

export default class TelemetryResolver {
  private context: TelemetryContext;

  constructor(context: TelemetryContext) {
    this.context = context;
  }

  public async resolve<T>(providers: Array<TelemetryDataProvider<T>>): Promise<Record<string, T>> {
    const entries = await Promise.all(
      providers.map(async (provider) => [provider.id, await provider.getValue(this.context)])
    );

    return entries.reduce((memo, [k, v]) => {
      memo[k] = v;
      return memo;
    }, {});
  }
}

/*

const telemetry = new TelemetryResolver({ rootDir: workspaceUri.fsPath });
return telemetry.resolve({
  PROPERTIES.PROJECT.AGENT_VERSION_GLOBAL,
  PROPERTIES.PROJECT.AGENT_VERSION_PROJECT,
  PROPERTIES.PROJECT.IS_CONFIG_PRESENT,
  PROPERTIES.PROJECT.LANGUAGE,
});

*/
