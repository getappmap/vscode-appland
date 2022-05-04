import * as vscode from 'vscode';
const watchers: Record<string, vscode.Disposable> = {};

type HandlerFunction = (uri: vscode.Uri) => void;
type Handler = {
  onCreate: HandlerFunction;
  onChange: HandlerFunction;
  onDelete: HandlerFunction;
};

export default function appmapWatcher(context: vscode.ExtensionContext, handler: Handler): void {
  const config = vscode.workspace.getConfiguration('files');
  const values = config.get('watcherExclude') as string[] | undefined;
  // Proxy {**/.git/objects/**: true, **/.git/subtree-cache/**: true, **/node_modules/*/**: true, **/.hg/store/**: true}
  if (values && Object.keys(values).some((path) => path.split(/[\\/]/).includes('appmap'))) {
    vscode.window
      .showErrorMessage(
        `The 'appmap' folder is excluded from the VSCode file watcher. Please update the setting 'Files: Watcher Exclude' (files.watcherExclude) and remove any paths which include 'appmap'.`,
        'Open Settings'
      )
      .then(() => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'files.watcherExclude');
      });
  }

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
