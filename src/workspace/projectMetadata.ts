import { AppMapSummary } from '../analyzers';
import { SampleCodeObjects } from '../services/projectStateService';
import { FindingsDomainCounts } from '../services/projectStateService';
import Feature from './feature';

export default interface ProjectMetadata {
  name: string;
  path: string;
  score?: number;
  hasNode: boolean;
  agentInstalled?: boolean;
  appMapsRecorded?: boolean;
  analysisPerformed?: boolean;
  investigatedFindings?: boolean;
  generatedOpenApi?: boolean;
  appMapOpened?: boolean;
  numFindings?: number;
  numHttpRequests?: number;
  numAppMaps?: number;
  language?: Feature;
  testFramework?: Feature;
  webFramework?: Feature;
  appMaps?: Readonly<Array<AppMapSummary>>;
  sampleCodeObjects?: SampleCodeObjects;
  findingsDomainCounts?: FindingsDomainCounts;
}
