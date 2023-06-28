import * as vscode from 'vscode';
import ClassMapIndex from '../services/classMapIndex';
import { CodeObjectEntry } from '../lib/CodeObjectEntry';
import { CLICK_CODE_OBJECT, Telemetry } from '../telemetry';
import { promptForAppMap } from '../lib/promptForAppMap';
import AppMapCollection from '../services/appmapCollection';

export default function openCodeObjectInAppMap(
  context: vscode.ExtensionContext,
  appmapCollection: AppMapCollection,
  classMapIndex: ClassMapIndex
) {
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
      const appmapFiles = new Set(Object.keys(await codeObject.appMapMetadata()));
      const appmaps = appmapCollection
        .allAppMaps()
        .filter((appmap) => appmapFiles.has(appmap.descriptor.resourceUri.fsPath));

      const selectedAppMap = await promptForAppMap(appmaps);
      if (!selectedAppMap) return;

      appMapFileName = selectedAppMap.fsPath;
    }

    const state = {
      currentView: 'viewComponent',
      selectedObject: codeObject.fqid,
    };
    const uri = vscode.Uri.file(appMapFileName);
    Telemetry.sendEvent(CLICK_CODE_OBJECT);
    return vscode.commands.executeCommand(
      'vscode.open',
      uri.with({ fragment: JSON.stringify(state) })
    );
  });
  context.subscriptions.push(command);
}
