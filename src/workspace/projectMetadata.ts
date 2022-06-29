import { AppMapSummary } from '../analyzers';
import Feature from './feature';

export default interface ProjectMetadata {
  name: string;
  path: string;
  score?: number;
  agentInstalled?: boolean;
  appMapsRecorded?: boolean;
  analysisPerformed?: boolean;
  appMapOpened?: boolean;
  numFindings?: number;
  numSecurity?: number;
  numPerformance?: number;
  numMaintainability?: number;
  numStability?: number;
  language?: Feature;
  testFramework?: Feature;
  webFramework?: Feature;
  appMaps?: Readonly<Array<AppMapSummary>>;
}
