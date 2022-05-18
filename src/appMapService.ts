import { AppMapsService } from './appMapsService';
import { ClassMapService } from './classMapService';
import { FindingsService } from './findingsService';

export default interface AppMapService {
  localAppMaps: AppMapsService;
  findings?: FindingsService;
  classMap?: ClassMapService;
}
