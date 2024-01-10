import * as vscode from 'vscode';
import AppMapEditorProvider from '../editor/appmapEditorProvider';
import ChatSearchWebview from '../webviews/chatSearchWebview';

export default function appmapState(
  context: vscode.ExtensionContext,
  appmapEditorProvider: AppMapEditorProvider,
  chatSearchWebview: ChatSearchWebview
) {
  const currentWebview = (): vscode.Webview | undefined =>
    appmapEditorProvider.currentWebview || chatSearchWebview.currentWebview;

  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.getAppmapState', () => {
      const webview = currentWebview();
      if (!webview) return;

      webview.postMessage({
        type: 'requestAppmapState',
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.setAppmapState', async () => {
      const webview = currentWebview();
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
