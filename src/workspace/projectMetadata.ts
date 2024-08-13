export default interface ProjectMetadata {
  name: string;
  path: string;
  agentInstalled?: boolean;
  appMapsRecorded?: boolean;
  openedNavie?: boolean;
  analysisPerformed?: boolean;
  appMapOpened?: boolean;
  numFindings?: number;
  numHttpRequests?: number;
  numAppMaps?: number;
}
