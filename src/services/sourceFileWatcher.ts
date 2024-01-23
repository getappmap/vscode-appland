import * as vscode from 'vscode';
import ClassMapIndex from './classMapIndex';
import { CodeObjectEntry } from '../lib/CodeObjectEntry';

export class SourceFileWatcher implements vscode.Disposable {
  protected _onChange = new vscode.EventEmitter<vscode.Uri>();
  public onChange = this._onChange.event;

  private watcher?: vscode.FileSystemWatcher;
  private onChangedListener: vscode.Disposable;

  constructor(public classMapIndex: ClassMapIndex) {
    this.onChangedListener = classMapIndex.onChanged(() => this.setupWatcher());
  }

  dispose() {
    this._onChange.dispose();
    this.onChangedListener.dispose();
    this.watcher?.dispose();
  }

  private async setupWatcher() {
    const extensions = extensionsOfClassMap(await this.classMapIndex.classMap());
    const pattern = `**/*.{${[...extensions].sort().join(',')}}`;

    console.log(`[source-file-watcher] Watching ${pattern}`);

    this.watcher?.dispose();
    this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
    for (const event of ['onDidChange', 'onDidDelete', 'onDidCreate'] as const)
      this.watcher[event](this._onChange.fire.bind(this._onChange));
  }
}

function extensionsOfClassMap(map: readonly CodeObjectEntry[]): string[] {
  const fileExtensions = new Set<string>();
  const collectExtensions = (coe: CodeObjectEntry): void => {
    if (coe.path && coe.path.includes('.')) {
      const extension = coe.path.split('.').pop();
      if (extension) fileExtensions.add(extension);
    }
    coe.children.forEach(collectExtensions);
  };
  map.map(collectExtensions);
  return Array.from(fileExtensions);
}
