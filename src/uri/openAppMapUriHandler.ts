import * as vscode from 'vscode';
import { RequestHandler } from './uriHandler';

export default class OpenAppMapUriHandler implements RequestHandler {
  public readonly path = '/open';

  constructor(protected readonly context: vscode.ExtensionContext) {}

  handle(queryParams: URLSearchParams): void {
    const uri = queryParams.get('uri');
    if (!uri) return;

    const state = queryParams.get('state');
    vscode.commands.executeCommand('appmap.open', vscode.Uri.parse(uri), state);
  }

  dispose(): void {
    // do nothing, we have nothing to dispose
  }
}
