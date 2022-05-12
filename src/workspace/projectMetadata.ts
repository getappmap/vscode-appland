import Feature from './feature';

export default interface ProjectMetadata {
  name: string;
  path: string;
  score?: number;
  agentInstalled?: boolean;
  appMapsRecorded?: boolean;
  analysisPerformed?: boolean;
  numFindings?: number;
  language?: Feature;
  testFramework?: Feature;
  webFramework?: Feature;
}
