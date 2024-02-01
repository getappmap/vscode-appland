import * as vscode from 'vscode';

/* Find files taking files.watcherExclude into account. */
export function findFiles(
  include: vscode.GlobPattern,
  excludes: vscode.GlobPattern[] = []
): Thenable<vscode.Uri[]> {
  return vscode.workspace.findFiles(include, getExcludes(excludes));
}

function getExcludes(excludes: vscode.GlobPattern[]): vscode.GlobPattern | undefined {
  const editorExcludes =
    vscode.workspace.getConfiguration('files').get<Record<string, boolean>>('watcherExclude') || [];

  if (editorExcludes.length === 0 && excludes.length === 0) return;

  const editorExcludePaths = Object.entries(editorExcludes)
    .filter(([, enabled]) => enabled)
    .map(([path]) => path);

  const workspaceExcludePaths = excludes.map((exclude) => exclude.toString());
  return `{${editorExcludePaths.concat(workspaceExcludePaths).join(',')}}`;
}
