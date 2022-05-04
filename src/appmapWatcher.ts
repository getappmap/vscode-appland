import * as vscode from 'vscode';
const watchers: Record<string, vscode.Disposable> = {};

type HandlerFunction = (uri: vscode.Uri) => void;
type Handler = {
  onCreate: HandlerFunction;
  onChange: HandlerFunction;
  onDelete: HandlerFunction;
};

export default function appmapWatcher(context: vscode.ExtensionContext, handler: Handler): void {
  const watchFolder = (folder: vscode.WorkspaceFolder) => {
    const appmapPattern = new vscode.RelativePattern(folder, `**/*.appmap.json`);
    const watcher = vscode.workspace.createFileSystemWatcher(appmapPattern);
    watcher.onDidChange(handler.onChange.bind(handler));
    watcher.onDidCreate(handler.onCreate.bind(handler));
    watcher.onDidDelete(handler.onDelete.bind(handler));
    watchers[folder.uri.toString()] = watcher;
    context.subscriptions.push(watcher);
  };

  const unwatchFolder = (folder: vscode.WorkspaceFolder) => {
    const watcher = watchers[folder.uri.toString()];
    if (watcher) watcher.dispose();
  };

  vscode.workspace.onDidChangeWorkspaceFolders((e) => {
    e.added.forEach((folder) => {
      watchFolder(folder);
    });
    e.removed.forEach((folder) => {
      unwatchFolder(folder);
    });
  });

  (vscode.workspace.workspaceFolders || []).forEach(watchFolder);
}
