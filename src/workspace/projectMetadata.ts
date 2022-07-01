import { AppMapSummary } from '../analyzers';
import Feature from './feature';

export interface DomainCounts {
  total: number;
  security: number;
  performance: number;
  maintainability: number;
  stability: number;
}

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
