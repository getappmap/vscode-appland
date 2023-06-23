import * as vscode from 'vscode';
import assert from 'assert';
import { waitForExtension } from '../util';
import { FindingsTreeDataProvider } from '../../../src/tree/findingsTreeDataProvider';

export async function waitForAnalysisTree(): Promise<FindingsTreeDataProvider> {
  const extension = await waitForExtension();
  const workspaceFolder = (vscode.workspace.workspaceFolders || [])[0];
  assert(workspaceFolder);
  return extension.trees.analysis;
}
