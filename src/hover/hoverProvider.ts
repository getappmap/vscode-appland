import * as vscode from 'vscode';
import extensionSettings from '../configuration/extensionSettings';
import { CodeObjectEntry } from '../services/classMapIndex';
import LineInfoIndex from '../services/lineInfoIndex';

export default function registerHoverProvider(
  context: vscode.ExtensionContext,
  lineInfoIndex: LineInfoIndex
): void {
  async function provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.Hover | null> {
    const lineInfo = (await lineInfoIndex.lineInfo(document.uri)).find(
      (lineInfo) => lineInfo.line === position.line
    );
    if (!lineInfo) return null;

    const editorLines = document.getText().split('\n');
    const line = editorLines[position.line];
    const length = line.length;
    if (position.character !== length) return null;

    const contents: vscode.MarkdownString[] = [];
    if (lineInfo.codeObjects) {
      const md = new vscode.MarkdownString();
      md.isTrusted = true;
      lineInfo.codeObjects.forEach((codeObject) => {
        md.appendMarkdown(`**Open code object in AppMap**\n\n`);
        const commandUri = vscode.Uri.parse(
          `command:appmap.openCodeObjectInAppMap?${encodeURIComponent(
            JSON.stringify([codeObject.fqid])
          )}`
        );
        md.appendMarkdown(`[${codeObject.fqid}](${commandUri})\n\n`);

        if (extensionSettings.inspectEnabled()) {
          md.appendMarkdown(`**Inspect code object**\n\n`);
          let ancestor: CodeObjectEntry | undefined = codeObject;
          while (ancestor && ancestor.isInspectable) {
            md.appendMarkdown(`- `);
            const args = [ancestor.fqid];
            const commandUri = vscode.Uri.parse(
              `command:appmap.inspectCodeObject?${encodeURIComponent(JSON.stringify(args))}`
            );
            md.appendMarkdown(`[${ancestor.fqid}](${commandUri})\n`);
            ancestor = ancestor.parent;
          }
        }
      });
      contents.push(md);
    }

    return {
      contents,
    } as vscode.Hover;
  }

  const provider = vscode.languages.registerHoverProvider(
    { scheme: 'file' } as vscode.DocumentFilter,
    {
      provideHover,
    }
  );
  context.subscriptions.push(provider);
}
