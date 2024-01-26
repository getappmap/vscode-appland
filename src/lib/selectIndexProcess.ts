import * as vscode from 'vscode';
import IndexProcessWatcher from '../services/indexProcessWatcher';
import { NodeProcessService } from '../services/nodeProcessService';
import { workspaceServices } from '../services/workspaceServices';

export type IndexProcess = {
  configFolder: string;
  rpcPort: number;
};

export enum ReasonCode {
  NoIndexProcessWatchers = 1,
  NoReadyIndexProcessWatchers = 2,
  NoSelectionMade = 3,
}

export function readyProcessWatchers(
  workspace?: vscode.WorkspaceFolder
): IndexProcessWatcher[] | undefined {
  const nodeProcessService = workspaceServices().getService(NodeProcessService);
  if (!nodeProcessService) {
    console.warn('No node process service found');
    return;
  }

  const nodeProcessServices = workspaceServices().getServiceInstances(nodeProcessService);
  if (nodeProcessServices.length === 0) {
    console.log('No node process services found');
    return;
  }

  const indexProcessWatchers = nodeProcessServices
    .filter((service) => workspace === undefined || service.folder === workspace)
    .flatMap(
      (service) =>
        service.processes.filter((process) => process.id === 'index') as IndexProcessWatcher[]
    );

  return indexProcessWatchers;
}

export default async function selectIndexProcess(
  workspace?: vscode.WorkspaceFolder
): Promise<IndexProcess | ReasonCode | undefined> {
  const indexProcessWatchers = readyProcessWatchers(workspace);
  if (!indexProcessWatchers) {
    console.warn(`No index process watchers found for ${workspace?.name || 'your workspace'}`);
    return;
  }

  if (indexProcessWatchers.length === 0) {
    console.log('No index process watchers found');
    return ReasonCode.NoIndexProcessWatchers;
  }

  const readyIndexProcessWatchers = indexProcessWatchers.filter((watcher) =>
    watcher.isRpcAvailable()
  );
  if (readyIndexProcessWatchers.length === 0) {
    console.log('No ready index process watchers found');
    return ReasonCode.NoReadyIndexProcessWatchers;
  }

  let selectedWatcher: IndexProcessWatcher | undefined;
  if (readyIndexProcessWatchers.length === 1) {
    selectedWatcher = readyIndexProcessWatchers[0];
  } else {
    const pickResult = await vscode.window.showQuickPick(
      readyIndexProcessWatchers.map((watcher) => ({
        label: watcher.configFolder,
        watcher,
      })),
      {
        placeHolder: 'Select a project directory for your question',
      }
    );
    if (!pickResult) return ReasonCode.NoSelectionMade;

    selectedWatcher = pickResult.watcher;
  }

  if (!selectedWatcher.rpcPort) {
    console.warn(`No RPC port available on index process watcher ${selectedWatcher.configFolder}`);
    return;
  }

  return {
    configFolder: selectedWatcher.configFolder,
    rpcPort: selectedWatcher.rpcPort,
  };
}
