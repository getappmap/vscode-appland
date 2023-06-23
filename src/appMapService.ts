import { AppMapsService } from './appMapsService';
import AppMapServerAuthenticationProvider from './authentication/appmapServerAuthenticationProvider';
import { ClassMapService } from './classMapService';
import ExtensionState from './configuration/extensionState';
import AppMapEditorProvider from './editor/appmapEditorProvider';
import { FindingsService } from './findingsService';
import { AppMapConfigWatcher } from './services/appMapConfigWatcher';
import { AppmapConfigManager } from './services/appmapConfigManager';
import { AppMapRecommenderService } from './services/appmapRecommenderService';
import { AppmapUptodateService } from './services/appmapUptodateService';
import Command from './services/command';
import { NodeProcessService } from './services/nodeProcessService';
import ProjectStateService from './services/projectStateService';
import { RunConfigService } from './services/runConfigService';
import { SourceFileWatcher } from './services/sourceFileWatcher';
import { WorkspaceServices } from './services/workspaceServices';
import { AppMapTreeDataProvider } from './tree/appMapTreeDataProvider';
import { FindingsTreeDataProvider } from './tree/findingsTreeDataProvider';

export type Invocation = {
  command: Command;
  messages: string[];
  exitCode?: number;
};

export interface AppMapProcessService {
  invocations: Invocation[];
}

export type AppMapTreeDataProviders = {
  appmaps: AppMapTreeDataProvider;
  analysis: FindingsTreeDataProvider;
};

export default interface AppMapService {
  editorProvider: AppMapEditorProvider;
  localAppMaps: AppMapsService;
  autoIndexService: AppMapProcessService;
  autoScanService: AppMapProcessService;
  configWatcher: AppMapConfigWatcher;
  sourceFileWatcher?: SourceFileWatcher;
  uptodate?: AppmapUptodateService;
  workspaceServices: WorkspaceServices;
  findings?: FindingsService;
  classMap?: ClassMapService;
  processService: NodeProcessService;
  extensionState: ExtensionState;
  projectState: ProjectStateService;
  trees: AppMapTreeDataProviders;
  appmapServerAuthenticationProvider: AppMapServerAuthenticationProvider;
  recommender: AppMapRecommenderService;
  configManager: AppmapConfigManager;
  runConfigService: RunConfigService;
}
