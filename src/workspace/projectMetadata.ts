import { AppMapSummary } from '../analyzers';
import { DomainCounts } from '../services/projectStateService';
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
  impactDomainCounts?: DomainCounts;
  language?: Feature;
  testFramework?: Feature;
  webFramework?: Feature;
  appMaps?: Readonly<Array<AppMapSummary>>;
}
