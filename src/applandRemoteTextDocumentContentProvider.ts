import * as vscode from 'vscode';
import AppLandClient from './applandClient';

export default class AppLandRemoteTextDocumentProvider
  implements vscode.TextDocumentContentProvider {
  private api: AppLandClient;

  constructor(api: AppLandClient) {
    this.api = api;
  }

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    return await this.api.getAppMapRaw(uri);
  }
}
