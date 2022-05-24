import { AppMapsService } from './appMapsService';
import { ClassMapService } from './classMapService';
import { FindingsService } from './findingsService';
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
  findings?: FindingsService;
  classMap?: ClassMapService;
}
