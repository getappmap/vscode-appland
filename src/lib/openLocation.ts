import * as vscode from 'vscode';

import { parseLocation } from '../util';

export default async function openLocation(location: string, directory?: string) {
  const result = await parseLocation(location, directory);

  if (result instanceof vscode.Uri) {
    await vscode.commands.executeCommand('vscode.open', result);
  } else {
    if (result.uri.fsPath.endsWith('.appmap.json')) {
      // Open an AppMap
      // The range will actually be an event id
      // This means we'll need to add 1 to the (zero-based) line number
      const viewState = {
        currentView: 'viewSequence',
        selectedObject: `event:${result.range.start.line + 1}`,
      };
      await vscode.commands.executeCommand(
        'vscode.open',
        result.uri.with({ fragment: JSON.stringify(viewState) })
      );
    } else {
      // Open a text document
      const document = await vscode.workspace.openTextDocument(result.uri);
      const editor = await vscode.window.showTextDocument(document, {
        selection: result.range,
      });

      editor.revealRange(result.range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    }
  }
}
