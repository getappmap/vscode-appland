import * as vscode from 'vscode';
import ClassMapIndex from '../services/classMapIndex';
import { CodeObjectEntry } from '../lib/CodeObjectEntry';

export default async function openCodeObjectInAppMap(
  context: vscode.ExtensionContext,
  classMapIndex: ClassMapIndex
): Promise<void> {
  const command = vscode.commands.registerCommand('appmap.openCodeObjectInAppMap', async (fqid) => {
    if (!fqid) {
      const collectFqids = (fqids: string[], codeObject: CodeObjectEntry) => {
        fqids.push(codeObject.fqid);
        codeObject.children.forEach(collectFqids.bind(null, fqids));
      };
      const fqids = [];
      (await classMapIndex.classMap()).forEach((codeObject) => collectFqids(fqids, codeObject));
      const options: vscode.QuickPickOptions = {
        canPickMany: false,
        placeHolder: 'Choose code object to open',
      };
      fqid = await vscode.window.showQuickPick(fqids.sort(), options);
      if (!fqid) {
        return false;
      }
    }

    const codeObject = await classMapIndex.lookupCodeObject(fqid);
    if (!codeObject) {
      vscode.window.showInformationMessage(`Could not find code object ${fqid}`);
      return;
    }

    if (codeObject.appMapFiles.length === 0) {
      console.warn(`No AppMaps for ${fqid}`);
      return;
    }

    let appMapFileName: string;
    if (codeObject.appMapFiles.length === 1) {
      appMapFileName = codeObject.appMapFiles[0];
    } else {
      const appMapMetadata = await codeObject.appMapMetadata();
      const appMapsByName = {};
      Object.keys(appMapMetadata).forEach(
        (fileName) => (appMapsByName[appMapMetadata[fileName].name] = fileName)
      );
      const options: vscode.QuickPickOptions = {
        canPickMany: false,
        placeHolder: 'Choose AppMap to open',
      };
      const appMapName = await vscode.window.showQuickPick(
        Object.keys(appMapsByName).sort(),
        options
      );

      if (!appMapName) {
        return false;
      }

      appMapFileName = appMapsByName[appMapName];
    }

    const state = {
      currentView: 'viewComponent',
      selectedObject: codeObject.fqid,
    } as any;
    const uri = vscode.Uri.parse(`file://${appMapFileName}#${JSON.stringify(state)}`);
    vscode.commands.executeCommand('vscode.open', uri);
  });
  context.subscriptions.push(command);
}
