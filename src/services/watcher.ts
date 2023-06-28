import * as vscode from 'vscode';
import path from 'path';

import FileChangeHandler from './fileChangeHandler';
import { AppmapConfigManagerInstance } from './appmapConfigManager';

export default class Watcher {
  disposables: vscode.Disposable[] = [];

  constructor(
    public filePattern: string,
    public folder: vscode.WorkspaceFolder,
    public handler: FileChangeHandler,
    public configManagerInstance: AppmapConfigManagerInstance | undefined
  ) {
    configManagerInstance?.onConfigChanged(async () => {
      await this.dispose();
      await this.initialize();
    });
  }

  async initialize() {
    for (const pattern of this.watchPatterns) {
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);

      this.disposables.push(
        watcher,
        watcher.onDidChange((uri) => {
          this.handler.onChange(uri, this.folder);
        }),
        watcher.onDidCreate((uri) => {
          this.handler.onCreate(uri, this.folder);
        }),
        watcher.onDidDelete((uri) => {
          this.handler.onDelete(uri, this.folder);
        })
      );

      (await vscode.workspace.findFiles(pattern)).map((uri) =>
        this.handler.onCreate(uri, this.folder)
      );
    }
  }

  async dispose() {
    for (const pattern of this.watchPatterns) {
      (await vscode.workspace.findFiles(pattern)).map((uri) =>
        this.handler.onDelete(uri, this.folder)
      );
    }

    this.disposables.forEach((disposable) => disposable.dispose());
  }

  get watchPatterns(): vscode.RelativePattern[] {
    const workspaceConfigs =
      this.configManagerInstance &&
      this.configManagerInstance.workspaceConfig &&
      this.configManagerInstance.workspaceConfig.configs;

    const relativePatterns = ['tmp', 'build', 'target'].map((dir) => {
      return new vscode.RelativePattern(
        this.folder,
        path.join('**', dir, 'appmap', '**', this.filePattern)
      );
    });

    if (workspaceConfigs) {
      workspaceConfigs.forEach(({ configFolder, appmapDir }) => {
        const relativeAppmapDirPath = path.relative(
          this.folder.uri.fsPath,
          path.join(configFolder, appmapDir)
        );
        const pattern = path.join('**', relativeAppmapDirPath, '**', this.filePattern);

        if (!relativePatterns.some((relativePattern) => relativePattern.pattern === pattern)) {
          relativePatterns.push(new vscode.RelativePattern(this.folder, pattern));
        }
      });
    }

    return relativePatterns;
  }
}
