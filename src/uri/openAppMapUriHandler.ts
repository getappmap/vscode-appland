import * as vscode from 'vscode';
import AppMapEditorProvider from '../editor/appmapEditorProvider';
import { RequestHandler } from './uriHandler';

export default class OpenAppMapUriHandler implements RequestHandler {
  public readonly path = '/open';

  constructor(protected readonly context: vscode.ExtensionContext) {}

  handle(queryParams: URLSearchParams): void {
    if (queryParams.get('uri')) {
      vscode.commands.executeCommand(
        'vscode.open',
        vscode.Uri.parse(queryParams.get('uri') as string)
      );
    }

    if (queryParams.get('state')) {
      this.context.globalState.update(AppMapEditorProvider.INITIAL_STATE, queryParams.get('state'));
    }
  }

  dispose(): void {
    // do nothing, we have nothing to dispose
  }
}
