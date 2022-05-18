import { Metadata } from '@appland/models';
import { readFile } from 'fs';
import { promisify } from 'util';
import * as vscode from 'vscode';
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
      const appMapMetadata: Record<string, Metadata> = {};
      await Promise.all(
        lineInfo.codeObjects.map(async (codeObject) => {
          await Promise.all(
            codeObject.appMapFiles.map(async (file) => {
              if (appMapMetadata[file]) return;

              const metadataFileName = file.replace(/\.appmap\.json$/, '/metadata.json');
              const metadataData = await promisify(readFile)(metadataFileName);
              const metadata = JSON.parse(metadataData.toString()) as Metadata;
              appMapMetadata[file] = metadata;
            })
          );
        })
      );

      const md = new vscode.MarkdownString();
      md.isTrusted = true;
      lineInfo.codeObjects.forEach((codeObject) => {
        md.appendMarkdown(`Inspect `);
        const args = [codeObject.fqid];
        const commandUri = vscode.Uri.parse(
          `command:appmap.inspectCodeObject?${encodeURIComponent(JSON.stringify(args))}`
        );
        md.appendMarkdown(`[${codeObject.fqid.split(':')[1]}](${commandUri})`);
      });
      contents.push(md);
    }
    /*
    // This is already pretty well handled by the Problems view
    if (lineInfo.findings) {
      const md = new vscode.MarkdownString();
      md.appendMarkdown(
        `Matches findings ${lineInfo.findings?.map((finding) => finding.finding.ruleId).join(', ')}`
      );
      contents.push(md);
    }
    */

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
