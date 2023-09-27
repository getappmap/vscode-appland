import * as vscode from 'vscode';
import LineInfoIndex, { LineInfo } from '../services/lineInfoIndex';
import assert from 'assert';
import AppMapCollection from '../services/appmapCollection';
import { promptForAppMap } from '../lib/promptForAppMap';
import { debug } from 'console';
import { readFile, writeFile } from 'fs/promises';
import { AppMap, AppMapFilter, CodeObject, buildAppMap } from '@appland/models';
import buildOpenAIApi from '../lib/buildOpenAIApi';
import { join } from 'path';
import { FormatType, Specification, buildDiagram, format } from '@appland/sequence-diagram';
import { randomUUID } from 'crypto';
import { Completion, Question } from '../lib/ask';
import selectedCode from '../lib/ask/selectedCode';
import contextAppMap from '../lib/ask/contextAppMap';

class LineInfoQuickPickItem implements vscode.QuickPickItem {
  constructor(public lineInfo: LineInfo) {}

  get label(): string {
    return [
      `line ${this.lineInfo.line}`,
      this.lineInfo.codeObjects?.map((co) => co.fqid).join(', '),
    ].join(': ');
  }
}

export default function register(
  context: vscode.ExtensionContext,
  lineInfoIndex: LineInfoIndex,
  appmapCollection: AppMapCollection
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.ask', async () => {
      const { activeTextEditor } = vscode.window;
      if (!activeTextEditor) return;

      const selection = selectedCode(activeTextEditor);
      if (!selection) return;

      const documentUri = activeTextEditor.document.uri;
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
      if (!workspaceFolder) return;

      const lineInfo = (await lineInfoIndex.lineInfo(documentUri)).filter(
        (line) => line.codeObjects
      );
      if (lineInfo.length === 0) {
        vscode.window.showErrorMessage(
          `I couldn't find any AppMaps related to ${documentUri.path}`
        );
        return;
      }

      const lineCodePrompt =
        selection.text.split('\n').length === 0
          ? selection.text
          : [selection.text.split('\n')[0], '...'].join('');
      const question = await vscode.window.showInputBox({
        placeHolder: `Ask a question about: ${lineCodePrompt}`,
        value: 'How does this code work?',
      });
      if (!question) return;

      const distanceFromSelection = (item: LineInfoQuickPickItem): number =>
        Math.min(
          Math.abs(item.lineInfo.line - selection.startLine),
          Math.abs(item.lineInfo.line - selection.endLine)
        );

      const lineInfoItems = lineInfo.map((info) => new LineInfoQuickPickItem(info));
      const lineDistance = lineInfoItems.map(distanceFromSelection);
      const preferredDistance = lineDistance.sort()[0];

      const choiceItems: vscode.QuickPickItem[] = [
        ...lineInfoItems.filter(
          (lineInfo) => distanceFromSelection(lineInfo) === preferredDistance
        ),
        { label: '---' },
        ...lineInfoItems.filter(
          (lineInfo) => distanceFromSelection(lineInfo) !== preferredDistance
        ),
      ];

      const lineAbout = await vscode.window.showQuickPick(choiceItems, {
        placeHolder: `Verify the function that you want to ask about`,
      });
      if (!lineAbout) return;
      if (!(lineAbout instanceof LineInfoQuickPickItem)) return;

      const codeObjectEntry = ((lineAbout as LineInfoQuickPickItem).lineInfo.codeObjects || [])[0];
      assert(codeObjectEntry);

      if (codeObjectEntry.appMapFiles.length === 0) {
        console.warn(`No AppMaps for ${codeObjectEntry.fqid}`);
        return;
      }

      let appMapFileName: string;
      if (codeObjectEntry.appMapFiles.length === 1) {
        appMapFileName = codeObjectEntry.appMapFiles[0];
      } else {
        const appmapFiles = new Set(Object.keys(await codeObjectEntry.appMapMetadata()));
        const appmaps = appmapCollection
          .allAppMaps()
          .filter((appmap) => appmapFiles.has(appmap.descriptor.resourceUri.fsPath));

        const selectedAppMap = await promptForAppMap(appmaps);
        if (!selectedAppMap) return;

        appMapFileName = selectedAppMap.fsPath;
      }

      const q = new Question(selection.text, question);

      const appmapUri = vscode.Uri.file(appMapFileName);
      {
        const data = await readFile(appmapUri.fsPath, 'utf-8');
        const appmap = buildAppMap().source(data).build();

        let codeObject: CodeObject | undefined;
        appmap.classMap.visit((co) => {
          if (co.fqid === codeObjectEntry.fqid) codeObject = co;
        });
        if (!codeObject) {
          vscode.window.showInformationMessage(
            `Could not find code object ${codeObjectEntry.fqid} in the AppMap. Maybe it's out of date?`
          );
          return;
        }
        q.codeObject = codeObject;

        const { events } = appmap;
        let filterAppMap: AppMap;
        {
          const codeObjectEvents = events.filter(
            (event) => event.codeObject.fqid === codeObjectEntry.fqid
          );
          q.returnValues = [
            ...new Set(
              codeObjectEvents
                .map((e) => {
                  return e.returnValue
                    ? [e.returnValue.class, e.returnValue.value].join(': ')
                    : undefined;
                })
                .filter(Boolean)
            ),
          ] as string[];
          filterAppMap = contextAppMap(appmap, codeObjectEvents);

          q.scopeCodeObjects = [...new Set(appmap.rootEvents().map((e) => e.codeObject))];
        }

        {
          const filterAppMapData = JSON.stringify(filterAppMap, null, 2);
          let appmapName = ['ask_appmap', randomUUID()].join('-'); // question.replace(/[^a-zA-Z0-9]/g, '-'); KEG: Can result in a too-long file name.
          if (appmapName.endsWith('-')) appmapName = appmapName.slice(0, -1);
          const filePath = join(workspaceFolder?.uri.fsPath, `${appmapName}.appmap.json`);
          await writeFile(filePath, filterAppMapData);
          const uri = vscode.Uri.file(filePath);
          await vscode.commands.executeCommand('vscode.openWith', uri, 'appmap.views.appMapFile');
        }

        const specification = Specification.build(filterAppMap, { loops: true });
        assert(appmapUri);
        let sequenceDiagramAppMap: AppMap;
        {
          const sequenceDiagramFilter = new AppMapFilter();
          if (appmap.metadata.language?.name !== 'java')
            sequenceDiagramFilter.declutter.hideExternalPaths.on = true;
          sequenceDiagramAppMap = sequenceDiagramFilter.filter(filterAppMap, []);
        }
        const diagram = buildDiagram(appmapUri.fsPath, sequenceDiagramAppMap, specification);
        q.sequenceDiagram = format(FormatType.PlantUML, diagram, appmapUri.fsPath).diagram;
      }

      const openAI = await buildOpenAIApi(context);
      if (!openAI) return;

      let completion: Completion | undefined;
      await vscode.window.withProgress(
        {
          title: `Thinking about your question...`,
          location: vscode.ProgressLocation.Notification,
        },
        async () => {
          try {
            completion = await q.complete(openAI);
          } catch (e) {
            debug(e);
            vscode.window.showErrorMessage(`Unable to process your question: ${e}`);
          }
        }
      );
      if (!completion) return;

      const fence = '```';
      const responseText = [
        `## ${lineCodePrompt}`,
        `### You asked`,
        `${fence}${question}${fence}`,
        `### AI response:`,
        completion.response,
        `## Prompt
<details>
<summary>Click to expand</summary>

${fence}
${completion.prompt}
${fence}
</details>`,
      ].join('\n\n');
      const newDocument = await vscode.workspace.openTextDocument({
        content: responseText,
      });
      await vscode.window.showTextDocument(newDocument);
    })
  );
}
