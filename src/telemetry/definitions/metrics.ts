import { workspace } from 'vscode';
import TelemetryDataProvider from '../telemetryDataProvider';

export const APPMAP_JSON = new TelemetryDataProvider({
  id: 'appmap.json',
  async value({ metrics }: { metrics: Record<string, number> }) {
    return metrics;
  },
});

export const NUM_WORKSPACE_FOLDERS = new TelemetryDataProvider({
  id: 'num_workspace_folders',
  async value() {
    return workspace.workspaceFolders?.length || 0;
  },
});
