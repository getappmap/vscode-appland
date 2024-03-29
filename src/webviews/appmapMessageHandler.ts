/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from 'vscode';
import viewSource from './viewSource';
import { Telemetry } from '../telemetry';
import FilterStore from './filterStore';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';

type AppMapExport = {
  metadata?: {
    name: string;
  };
};

export default function appmapMessageHandler(
  filterStore: FilterStore,
  workspace?: vscode.WorkspaceFolder
): (message: any) => Promise<void> {
  const exportSVG = async (svgString?: string) => {
    if (!svgString) return;

    const comment =
      '\n<!-- Save this SVG file with a .svg file extension ' +
      'and then open it in a web browswer to view your appmap! -->\n\n';
    const document = await vscode.workspace.openTextDocument({
      language: 'svg',
      content: comment + svgString,
    });

    vscode.window.showTextDocument(document);
  };

  const exportJSON = async (appmapData?: AppMapExport) => {
    if (!appmapData) return;

    const appmapName = appmapData.metadata?.name || randomBytes(16).toString('hex');
    const appmapFileName = [
      appmapName.replaceAll(/[^a-zA-Z0-9\-_ ]/g, '_').replaceAll(/_+/g, '_'),
      '.appmap.json',
    ].join('');

    const tempDir = tmpdir();
    const tempFilePath = join(tempDir, appmapFileName);
    await writeFile(tempFilePath, JSON.stringify(appmapData, null, 2));
    const { remoteName } = vscode.env;
    const command = remoteName === 'wsl' ? 'remote-wsl.revealInExplorer' : 'revealFileInOS';
    vscode.commands.executeCommand(command, vscode.Uri.file(tempFilePath));
  };

  return async (message: any) => {
    switch (message.command) {
      case 'viewSource':
        viewSource(message.text, workspace);
        break;
      case 'reportError':
        Telemetry.reportWebviewError(message.error);
        break;
      case 'appmapOpenUrl':
        vscode.env.openExternal(message.url);
        break;
      case 'appmapStateResult':
        // Putting this directly on the clipboard is not what we always want;
        // although it is what appmap.getAppmapState wants.
        vscode.env.clipboard.writeText(message.state);
        vscode.window.setStatusBarMessage('AppMap state was copied to clipboard', 5000);
        break;
      case 'exportSVG':
        {
          const { svgString } = message;
          exportSVG(svgString);
        }
        break;
      case 'exportJSON':
        {
          const { appmapData } = message;
          exportJSON(appmapData);
        }
        break;
      case 'saveFilter': {
        const { filter } = message;
        if (!filter) break;

        filterStore.saveFilter(filter);
        break;
      }
      case 'deleteFilter': {
        const { filter } = message;
        if (!filter) break;

        filterStore.deleteFilter(filter);
        break;
      }
      case 'defaultFilter': {
        const { filter } = message;
        if (!filter) break;

        filterStore.defaultFilter(filter);
        break;
      }
    }
  };
}
