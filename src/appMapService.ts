import { AppMapsService } from './appMapsService';
import { ClassMapService } from './classMapService';
import { FindingsService } from './findingsService';
import { AppmapUptodateService } from './services/appmapUptodateService';
import Command from './services/command';

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
  uptodateService?: AppmapUptodateService;
  findings?: FindingsService;
  classMap?: ClassMapService;
}
