import { resolve } from 'path';
import * as vscode from 'vscode';
import { AppmapUptodateService, fileLocationsToFilePaths } from '../services/appmapUptodateService';
import { touch } from '../lib/touch';

const TEST_NAMES = 'File names';
const TEST_NAMES_LINES = 'File names and line numbers';

async function obtainOutOfDateTestLocations(
  uptodateService: AppmapUptodateService
): Promise<{ workspace: vscode.WorkspaceFolder; testLocations: string[] } | undefined> {
  async function selectWorkspace(): Promise<vscode.WorkspaceFolder | undefined> {
    if (vscode.workspace.workspaceFolders?.length === 0) return;

    if (vscode.workspace.workspaceFolders?.length === 1) {
      return vscode.workspace.workspaceFolders[0];
    } else {
      return await vscode.window.showWorkspaceFolderPick();
    }
  }

  const workspace = await selectWorkspace();
  if (!workspace) return;

  const testLocations = await uptodateService.outOfDateTestLocations(workspace);
  if (testLocations.length === 0) {
    vscode.window.showInformationMessage(`AppMap: No test are out of date in ${workspace.name}`);
    return;
  }

  return { workspace, testLocations };
}

export default async function outOfDateTests(
  context: vscode.ExtensionContext,
  uptodateService: AppmapUptodateService
): Promise<void> {
  statusBarItem(context, uptodateService);
  touchOutOfDateTestFiles(context, uptodateService);
  copyOutOfDateTestsToClipboard(context, uptodateService);
}

async function statusBarItem(
  context: vscode.ExtensionContext,
  uptodateService: AppmapUptodateService
): Promise<void> {
  const statusBarItem = vscode.window.createStatusBarItem('appmap.outOfDateTests');
  statusBarItem.name = 'Out of date tests';
  uptodateService.onUpdated(async () => {
    const count = (await uptodateService.outOfDateTestLocations()).length;
    if (count > 0) {
      statusBarItem.text = `${count} AppMaps are out of date`;
      statusBarItem.command = {
        title: 'Open AppMaps View',
        command: 'appmap.view.focusAppMap',
      };
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  });

  context.subscriptions.push(statusBarItem);
}

async function touchOutOfDateTestFiles(
  context: vscode.ExtensionContext,
  uptodateService: AppmapUptodateService
): Promise<void> {
  async function perform() {
    const outOfDate = await obtainOutOfDateTestLocations(uptodateService);
    if (!outOfDate) return;

    const touchedFiles = new Set<string>();
    await Promise.all(
      outOfDate.testLocations.map((location) => {
        const filePath = resolve(outOfDate.workspace.uri.fsPath, location.split(':')[0]);
        if (touchedFiles.has(filePath)) return;

        touchedFiles.add(filePath);
        return touch(filePath);
      })
    );

    vscode.window.showInformationMessage(
      `AppMap: Touched ${touchedFiles.size} out-of-date test files.`
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.touchOutOfDateTestFiles', perform)
  );
}

async function copyOutOfDateTestsToClipboard(
  context: vscode.ExtensionContext,
  uptodateService: AppmapUptodateService
): Promise<void> {
  async function perform() {
    const outOfDate = await obtainOutOfDateTestLocations(uptodateService);
    if (!outOfDate) return;

    const copyToClipboard = (transformFn?: (fileLocations: string[]) => string[]) => {
      return async (): Promise<number> => {
        const clipboardOutput = transformFn
          ? transformFn(outOfDate.testLocations)
          : outOfDate.testLocations;
        vscode.env.clipboard.writeText(clipboardOutput.join(' '));
        return clipboardOutput.length;
      };
    };

    vscode.window
      .showInformationMessage(
        `${fileLocationsToFilePaths(outOfDate.testLocations).length} test files are out of date`,
        {
          modal: false,
        },
        { title: TEST_NAMES_LINES, action: copyToClipboard() },
        { title: TEST_NAMES, action: copyToClipboard(fileLocationsToFilePaths) }
      )
      .then(async (selection) => {
        if (!selection) return;

        return selection.action();
      })
      .then((copiedCount?: number) => {
        if (copiedCount !== undefined) {
          vscode.window.showInformationMessage(`Copied ${copiedCount} tests to clipboard`);
        }
      });
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.copyOutOfDateTestsToClipboard', perform)
  );
}
