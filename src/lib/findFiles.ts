import * as vscode from 'vscode';

/* Find files taking files.watcherExclude into account. */
export function findFiles(include: vscode.GlobPattern): Thenable<vscode.Uri[]> {
  return vscode.workspace.findFiles(include, getExcludes());
}

function getExcludes(): vscode.GlobPattern | undefined {
  const excludes = vscode.workspace
    .getConfiguration('files')
    .get<Record<string, boolean>>('watcherExclude');
  if (!excludes) return;
  const paths = Object.entries(excludes)
    .filter(([, enabled]) => enabled)
    .map(([path]) => path);

  const result = `{${paths.join(',')}}`;
  return result;
}
