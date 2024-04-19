import * as vscode from 'vscode';
import RpcProcessService from './rpcProcessService';
import AppMapCollection from './appmapCollection';
import { CodeSelection } from '../commands/quickSearch';

export type ChatSearchData = {
  appmapRpcPort: number | undefined;
  codeSelection?: CodeSelection;
  apiKey: string | undefined;
  apiUrl: string;
  mostRecentAppMaps: Array<{ [key: string]: unknown }>;
  appmapYmlPresent: boolean;
};

export type LatestAppMap = {
  name: string | undefined;
  recordingMethod: string | undefined;
  createdAt: string;
  path: string;
};

export default class ChatSearchDataService {
  private _onAppMapsUpdated = new vscode.EventEmitter<LatestAppMap[]>();

  constructor(private rpcService: RpcProcessService, private appmaps: AppMapCollection) {
    appmaps.onUpdated(() => this._onAppMapsUpdated.fire(this.latestAppMaps()));
  }

  onAppMapsUpdated(listener: (appmaps: LatestAppMap[]) => void): vscode.Disposable {
    return this._onAppMapsUpdated.event(listener);
  }

  get appmapRpcPort(): number | undefined {
    return this.rpcService.port();
  }

  async codeSelection(): Promise<CodeSelection | undefined> {
    const activeEditor = vscode.window.activeTextEditor;
    const selection = activeEditor?.selection;
    if (selection) {
      const text = activeEditor.document.getText(selection);
      if (text) {
        return {
          path: activeEditor.document.fileName,
          lineStart: selection.start.line,
          lineEnd: selection.end.line,
          code: text,
          language: activeEditor.document.languageId,
        };
      }
    }
  }

  public latestAppMaps(count = 10): LatestAppMap[] {
    return this.appmaps
      .allAppMaps()
      .sort((a, b) => b.descriptor.timestamp - a.descriptor.timestamp)
      .slice(0, count)
      .map((appmap) => ({
        name: appmap.descriptor.metadata?.name,
        recordingMethod: appmap.descriptor.metadata?.recorder?.type,
        createdAt: new Date(appmap.descriptor.timestamp).toISOString(),
        path: appmap.descriptor.resourceUri.fsPath,
      }));
  }
}
