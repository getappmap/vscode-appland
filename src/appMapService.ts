import { AppMapsService } from './appMapsService';
import AppMapServerAuthenticationProvider from './authentication/appmapServerAuthenticationProvider';
import { ClassMapService } from './classMapService';
import CommandRegistry from './commands/commandRegistry';
import ExtensionState from './configuration/extensionState';
import AppMapEditorProvider from './editor/appmapEditorProvider';
import AnalysisManager from './services/analysisManager';
import { AppmapConfigManager } from './services/appmapConfigManager';
import { AppMapRecommenderService } from './services/appmapRecommenderService';
import { AppmapUptodateService } from './services/appmapUptodateService';
import Command from './services/command';
import { NodeProcessService } from './services/nodeProcessService';
import ProjectStateService from './services/projectStateService';
import { RunConfigService } from './services/runConfigService';
import SignInManager from './services/signInManager';
import { SourceFileWatcher } from './services/sourceFileWatcher';
import { WorkspaceServices } from './services/workspaceServices';
import { AppMapTreeDataProvider } from './tree/appMapTreeDataProvider';
import { ClassMapTreeDataProvider } from './tree/classMapTreeDataProvider';
import { FindingsTreeDataProvider } from './tree/findingsTreeDataProvider';
import ChatSearchWebview from './webviews/chatSearchWebview';

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
  codeObjects: ClassMapTreeDataProvider;
};

export default interface AppMapService {
  analysisManager: typeof AnalysisManager;
  editorProvider: AppMapEditorProvider;
  chatSearchWebview: Promise<ChatSearchWebview>;
  localAppMaps: AppMapsService;
  autoIndexService: AppMapProcessService;
  autoScanService: AppMapProcessService;
  signInManager: typeof SignInManager;
  sourceFileWatcher?: SourceFileWatcher;
  uptodate?: AppmapUptodateService;
  workspaceServices: WorkspaceServices;
  classMap?: ClassMapService;
  processService: NodeProcessService;
  extensionState: ExtensionState;
  projectState: ProjectStateService;
  trees: AppMapTreeDataProviders;
  appmapServerAuthenticationProvider: AppMapServerAuthenticationProvider;
  recommender: AppMapRecommenderService;
  configManager: AppmapConfigManager;
  runConfigService: RunConfigService;
  commandRegistry: typeof CommandRegistry;
}
