import { PathLike } from 'fs';
import ProjectConfiguration from './projectConfiguration';
import ProjectConfigurationRuby from './projectConfigurationRuby';

const PROJECT_CONFIGURATIONS = {
  ruby: () => new ProjectConfigurationRuby(),
};

export default class TelemetryContext {
  public rootDirectory: PathLike;
  public project?: ProjectConfiguration;
  public filePath?: PathLike | undefined;

  constructor(rootDirectory: PathLike, language: string, filePath?: PathLike | undefined) {
    this.rootDirectory = rootDirectory;
    this.filePath = filePath;

    const projectFactory = PROJECT_CONFIGURATIONS[language];
    if (projectFactory) {
      this.project = projectFactory();
    }
  }
}
