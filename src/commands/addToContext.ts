import type { PinFileRequest } from '@appland/components';
import * as vscode from 'vscode';
import ChatSearchWebview from '../webviews/chatSearchWebview';

export default function addToContext(
  context: vscode.ExtensionContext,
  chatSearchWebview: Promise<ChatSearchWebview>
) {
  const currentWebview = async (): Promise<vscode.Webview | undefined> =>
    (await chatSearchWebview).currentWebview;

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'appmap.explorer.addToContext',
      (_item, selected: vscode.Uri[]) => {
        fetchFiles(selected);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.editor.title.addToContext', (item) => {
      fetchFiles([item]);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.addToContext', async () => {
      const webview = await currentWebview();
      if (!webview) return;

      webview.postMessage({ type: 'choose-files-to-pin' });
    })
  );

  const fetchFiles = async (uris: vscode.Uri[]) => {
    const webview = await currentWebview();
    if (!webview) return;

    const requests: PinFileRequest[] = uris.map((u) => {
      const name = u.path.split('/').slice(-1)[0];
      return {
        name,
        uri: u.toString(),
      };
    });
    webview.postMessage({
      type: 'fetch-pinned-files',
      requests,
    });
  };
}
