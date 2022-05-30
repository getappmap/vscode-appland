import * as vscode from 'vscode';
import { AppmapUptodateService } from '../services/appmapUptodateService';

export async function runOutOfDateTests(
  context: vscode.ExtensionContext,
  uptodateService: AppmapUptodateService
): Promise<void> {
  async function perform() {
    const outOfDateTestFiles = await uptodateService.outOfDateTestFileUris();
    outOfDateTestFiles.forEach((testUri) => {
      console.log(
        `[appmap.runOutOfDateTests] Invoking test-explorer.run-file with ${testUri.fsPath}`
      );
      const result = vscode.commands.executeCommand('test-explorer.run-file', testUri.fsPath);
      console.log(result);
    });
  }

  context.subscriptions.push(vscode.commands.registerCommand('appmap.runOutOfDateTests', perform));
}

export async function copyOutOfDateTestsToClipboard(
  context: vscode.ExtensionContext,
  uptodateService: AppmapUptodateService
): Promise<void> {
  async function perform() {
    const outOfDateTestFiles = await uptodateService.outOfDateTestFileUris();
    let outOfDateFilePaths: string[];
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length === 1) {
      outOfDateFilePaths = outOfDateTestFiles.map((testUri) =>
        testUri.fsPath.slice(folders[0].uri.fsPath.length + 1)
      );
    } else {
      outOfDateFilePaths = outOfDateTestFiles.map((testUri) => testUri.fsPath);
    }

    vscode.env.clipboard.writeText(outOfDateFilePaths.join(' '));
    vscode.window.setStatusBarMessage(
      `${outOfDateFilePaths.length} test file names were copied to the clipboard`,
      5000
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.copyOutOfDateTestsToClipboard', perform)
  );
}
