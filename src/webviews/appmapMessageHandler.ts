/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from 'vscode';
import viewSource from './viewSource';
import { Telemetry, DEBUG_EXCEPTION } from '../telemetry';
import FilterStore from './filterStore';
import ErrorCode from '../telemetry/definitions/errorCodes';

export default function appmapMessageHandler(
  filterStore: FilterStore,
  workspace?: vscode.WorkspaceFolder
): (message: any) => Promise<void> {
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
          try {
            const { svgString } = message;
            if (svgString) {
              const comment =
                '\n<!-- Save this SVG file with a .svg file extension ' +
                'and then open it in a web browswer to view your appmap! -->\n\n';
              const document = await vscode.workspace.openTextDocument({
                language: 'svg',
                content: comment + svgString,
              });

              vscode.window.showTextDocument(document);
            }
          } catch (e) {
            Telemetry.sendEvent(DEBUG_EXCEPTION, {
              exception: e as Error,
              errorCode: ErrorCode.ExportSvgError,
            });
          }
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
