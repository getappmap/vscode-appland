import { AppMapSummary } from '../analyzers';
<<<<<<< HEAD
import { SampleCodeObjects } from '../services/projectStateService';
=======
import { FindingsDomainCounts } from '../services/projectStateService';
>>>>>>> 937d3c6 (feat: send findings domain counts to frontend webview)
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
  appMapOpened?: boolean;
  numFindings?: number;
  language?: Feature;
  testFramework?: Feature;
  webFramework?: Feature;
  appMaps?: Readonly<Array<AppMapSummary>>;
<<<<<<< HEAD
  sampleCodeObjects?: SampleCodeObjects;
=======
  findingsDomainCounts?: FindingsDomainCounts;
>>>>>>> 937d3c6 (feat: send findings domain counts to frontend webview)
}
