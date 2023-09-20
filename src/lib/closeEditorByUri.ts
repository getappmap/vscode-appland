import * as vscode from 'vscode';

export default async function closeEditorByUri(file: vscode.Uri): Promise<void> {
  const tabs: vscode.Tab[] = vscode.window.tabGroups.all.map((tg) => tg.tabs).flat();
  const index = tabs.findIndex(
    (tab) =>
      (tab.input instanceof vscode.TabInputCustom ||
        tab.input instanceof vscode.TabInputText ||
        tab.input instanceof vscode.TabInputNotebook) &&
      tab.input.uri.path === file.path
  );

  if (index !== -1) {
    await vscode.window.tabGroups.close(tabs[index]);
  }
}
