import * as vscode from 'vscode';
import AppMapEditorProvider from '../editor/appmapEditorProvider';

export default function appmapState(
  context: vscode.ExtensionContext,
  appmapEditorProvider: AppMapEditorProvider
) {
  const currentWebview = async (): Promise<vscode.Webview | undefined> =>
    appmapEditorProvider.currentWebview;

  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.getAppmapState', async () => {
      const webview = await currentWebview();
      if (!webview) return;

      webview.postMessage({
        type: 'requestAppmapState',
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.setAppmapState', async () => {
      const webview = await currentWebview();
      if (!webview) return;

      const state = await vscode.window.showInputBox({
        placeHolder: 'AppMap state serialized string',
      });
      if (state) {
        webview.postMessage({
          type: 'setAppmapState',
          state: state,
        });
      }
    })
  );
}
