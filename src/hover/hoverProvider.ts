import { Metadata } from '@appland/models';
import { readFile } from 'fs';
import { promisify } from 'util';
import * as vscode from 'vscode';
import inspectCodeObject, { InspectResult } from '../services/inspectCodeObject';
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
      (lineInfo) => lineInfo.line - 1 === position.line
    );
    if (!lineInfo) return null;

    const editorLines = document.getText().split('\n');
    const line = editorLines[position.line];
    const length = line.length;
    if (position.character !== length) return null;

    const contents: vscode.MarkdownString[] = [];
    if (lineInfo.codeObjects) {
      const appMapMetadata: Record<string, Metadata> = {};
      const codeObjectDetails: Record<string, InspectResult> = {};
      await Promise.all(
        lineInfo.codeObjects.map(async (codeObject) => {
          const inspectResult = await inspectCodeObject(codeObject.folder, codeObject.fqid);
          codeObjectDetails[codeObject.fqid] = inspectResult;
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
      lineInfo.codeObjects.forEach((codeObject) => {
        const inspectDetails = codeObjectDetails[codeObject.fqid];

        md.appendMarkdown(`**${codeObject.fqid}**\n`);
        md.appendMarkdown(`\n`);
        if (inspectDetails.httpServerRequests.length > 0) {
          md.appendMarkdown(`_HTTP server requests_\n`);
          inspectDetails.httpServerRequests.forEach((request) => {
            md.appendMarkdown(` * ${request}\n`);
          });
          md.appendMarkdown(`\n`);
        }
        if (inspectDetails.sqlQueries.length > 0) {
          md.appendMarkdown(`_SQL queries_\n`);
          inspectDetails.sqlQueries.forEach((query) => {
            md.appendMarkdown(` * ${query}\n`);
          });
          md.appendMarkdown(`\n`);
        }
        md.appendMarkdown(`_AppMaps_\n`);
        codeObject.appMapFiles.forEach((file) => {
          md.appendMarkdown(` * [${appMapMetadata[file].name}](${file})\n`);
        });
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
