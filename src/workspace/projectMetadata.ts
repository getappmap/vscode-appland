import { AppMapSummary } from '../analyzers';
import Feature from './feature';

export default interface ProjectMetadata {
  name: string;
  path: string;
  score?: number;
  hasNode: boolean;
  agentInstalled?: boolean;
  appMapsRecorded?: boolean;
  analysisPerformed?: boolean;
  appMapOpened?: boolean;
  numFindings?: number;
  language?: Feature;
  testFramework?: Feature;
  webFramework?: Feature;
  appMaps?: Readonly<Array<AppMapSummary>>;
}
