import * as vscode from 'vscode';
import { RequestHandler } from './uriHandler';

export default class OpenAppMapUriHandler implements RequestHandler {
  public readonly path = '/open';

  constructor(protected readonly context: vscode.ExtensionContext) {}

  handle(queryParams: URLSearchParams): void {
    let fragment: string | undefined;

    const uriString = queryParams.get('uri');
    if (!uriString) return;

    const state = queryParams.get('state');
    const uri = vscode.Uri.file(uriString);
    if (state !== null && state !== '') fragment = JSON.stringify(state);
    vscode.commands.executeCommand('vscode.open', uri.with({ fragment }));
  }

  dispose(): void {
    // do nothing, we have nothing to dispose
  }
}
