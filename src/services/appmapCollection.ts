import { Event, WorkspaceFolder } from 'vscode';
import AppMapLoader from './appmapLoader';

export default interface AppMapCollection {
  readonly onUpdated: Event<WorkspaceFolder | undefined>;

  /**
   * Lists all known AppMaps.
   */
  allAppMaps(): AppMapLoader[];

  /**
   * Lists all AppMaps that match any active filter.
   */
  appMaps(): AppMapLoader[];

  allAppMapsForWorkspaceFolder(workspaceFolder: WorkspaceFolder): AppMapLoader[];
}
