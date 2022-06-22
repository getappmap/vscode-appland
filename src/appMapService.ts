import { AppMapsService } from './appMapsService';
import { ClassMapService } from './classMapService';
import { FindingsService } from './findingsService';
import { AppMapConfigWatcher } from './services/appMapConfigWatcher';
import { AppmapUptodateService } from './services/appmapUptodateService';
import Command from './services/command';
import { SourceFileWatcher } from './services/sourceFileWatcher';
import { WorkspaceServices } from './services/workspaceServices';

export type Invocation = {
  command: Command;
  messages: string[];
  exitCode?: number;
};

export interface AppMapProcessService {
  invocations: Invocation[];
}

export default interface AppMapService {
  localAppMaps: AppMapsService;
  autoIndexService: AppMapProcessService;
  autoScanService: AppMapProcessService;
  configWatcher: AppMapConfigWatcher;
  sourceFileWatcher?: SourceFileWatcher;
  uptodate?: AppmapUptodateService;
  workspaceServices: WorkspaceServices;
  findings?: FindingsService;
  classMap?: ClassMapService;
}
