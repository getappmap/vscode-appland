import { join } from 'path';
import * as vscode from 'vscode';
import LineInfoIndex from '../services/lineInfoIndex';

class DecorationProvider {
  iconDecorationType: vscode.TextEditorDecorationType;
  textDecorationType: vscode.TextEditorDecorationType;

  constructor(context: vscode.ExtensionContext, private lineInfoIndex: LineInfoIndex) {
    const contentIconPath = join(__dirname, '../images/appmap_icon_12_12.png');
    this.iconDecorationType = vscode.window.createTextEditorDecorationType({
      after: {
        contentIconPath,
        margin: '0 0 -4px 2px',
      },
    });
    this.textDecorationType = vscode.window.createTextEditorDecorationType({
      after: {
        contentText: 'AppMap',
        color: 'rgba(255, 8, 171, 0.5)',
      },
    });
    context.subscriptions.push(this.iconDecorationType);
    context.subscriptions.push(this.textDecorationType);

    lineInfoIndex.onChanged(() => {
      if (vscode.window.activeTextEditor) this.decorate(vscode.window.activeTextEditor);
    });
    vscode.window.onDidChangeActiveTextEditor(
      async (editor) => {
        if (editor) {
          this.decorate(editor);
        }
      },
      null,
      context.subscriptions
    );
    if (vscode.window.activeTextEditor) this.decorate(vscode.window.activeTextEditor);
  }

  async decorate(editor: vscode.TextEditor): Promise<void> {
    const lineInfo = await this.lineInfoIndex.lineInfo(editor.document.uri);
    const editorLines = editor.document.getText().split('\n');
    const decorations = lineInfo
      .map((lineInfo) => {
        const range = new vscode.Range(
          new vscode.Position(lineInfo.line - 1, editorLines[lineInfo.line - 1].length),
          new vscode.Position(lineInfo.line - 1, editorLines[lineInfo.line - 1].length)
        );
        return { range };
      })
      .filter(Boolean) as vscode.DecorationOptions[];

    editor.setDecorations(this.iconDecorationType, decorations);
    editor.setDecorations(this.textDecorationType, decorations);
  }
}

export default function registerDecorationProvider(
  context: vscode.ExtensionContext,
  lineInfoIndex: LineInfoIndex
): void {
  new DecorationProvider(context, lineInfoIndex);
}
