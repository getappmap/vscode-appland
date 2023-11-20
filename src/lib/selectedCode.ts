import * as vscode from 'vscode';

export type Selection = {
  startLine: number;
  endLine: number;
  text: string;
};

export default function selectedCode(textEditor?: vscode.TextEditor): Selection | undefined {
  if (!textEditor) return;

  const { selection } = textEditor;
  if (!selection) return;

  const startLine = selection.anchor.line;
  const endLine = selection.active.line;
  let selectedCode = textEditor.document.getText(selection).trim();
  if (selectedCode === '') selectedCode = textEditor.document.lineAt(startLine).text.trim();
  return { startLine, endLine, text: selectedCode };
}
