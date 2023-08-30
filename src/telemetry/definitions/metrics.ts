import { workspace } from 'vscode';
import TelemetryDataProvider from '../telemetryDataProvider';

export const NUM_WORKSPACE_FOLDERS = new TelemetryDataProvider({
  id: 'num_workspace_folders',
  async value() {
    return workspace.workspaceFolders?.length || 0;
  },
});
