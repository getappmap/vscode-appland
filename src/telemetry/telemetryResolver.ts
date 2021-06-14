import { PathLike } from 'fs';
import TelemetryDataProvider from './telemetryDataProvider';
import TelemetryContext from './telemetryContext';
import { Properties } from '../telemetry';
import TelemetryDataCache from './telemetryDataCache';
import { getDirectoryLanguage } from './properties/project';

export default class TelemetryResolver {
  private rootDir: PathLike;
  private filePath?: PathLike | undefined;

  constructor(rootDir: PathLike, filePath?: PathLike | undefined) {
    this.rootDir = rootDir;
    this.filePath = filePath;
  }

  public async resolve<T>(providers: Array<TelemetryDataProvider<T>>): Promise<Record<string, T>> {
    let language = TelemetryDataCache.getValue<string>(
      Properties.Project.LANGUAGE.id,
      this.rootDir
    );

    if (language === undefined) {
      language = await getDirectoryLanguage(this.rootDir);
      TelemetryDataCache.setValue(Properties.Project.LANGUAGE.id, this.rootDir, language);
    }

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
