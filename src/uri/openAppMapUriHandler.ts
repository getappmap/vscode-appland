import * as vscode from 'vscode';
import { RequestHandler } from './uriHandler';

export default class OpenAppMapUriHandler implements RequestHandler {
  public readonly path = '/open';

  constructor(protected readonly context: vscode.ExtensionContext) {}

  handle(queryParams: URLSearchParams): void {

    const uriString = queryParams.get('uri');
    if (!uriString) return;

    const state = queryParams.get('state');
    const uri = vscode.Uri.file(uriString);
    vscode.commands.executeCommand('appmap.open', uri, state);
  }

  dispose(): void {
    // do nothing, we have nothing to dispose
  }
}
