import { Event, WorkspaceFolder } from 'vscode';
import AppMapLoader from './appmapLoader';

export default interface AppMapCollection {
  readonly onUpdated: Event<AppMapCollection>;

  appMaps(): AppMapLoader[];
  allAppMapsForWorkspaceFolder(workspaceFolder: WorkspaceFolder): AppMapLoader[];
}
