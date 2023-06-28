import * as vscode from 'vscode';
import LineInfoIndex, { LineInfo } from '../services/lineInfoIndex';
import assert from 'assert';
import AppMapCollection from '../services/appmapCollection';
import ClassMapIndex from '../services/classMapIndex';
import { promptForAppMap } from '../lib/promptForAppMap';
import { debug } from 'console';
import { readFile, writeFile } from 'fs/promises';
import {
  AppMap,
  AppMapFilter,
  CodeObject,
  Event,
  EventNavigator,
  buildAppMap,
} from '@appland/models';
import buildOpenAIApi from '../lib/buildOpenAIApi';
import ask from '../lib/ask';
import { isAbsolute, join } from 'path';
import { fileExists } from '../util';
import { FormatType, Specification, buildDiagram, format } from '@appland/sequence-diagram';

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
  classMapIndex: ClassMapIndex,
  appmapCollection: AppMapCollection
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.ask', async () => {
      const { activeTextEditor } = vscode.window;
      if (!activeTextEditor) return;

      const { selection } = activeTextEditor;
      if (!selection) return;

      const startLine = selection.anchor.line;
      const endLine = selection.active.line;
      let selectedCode = activeTextEditor.document.getText(selection).trim();
      if (selectedCode === '')
        selectedCode = activeTextEditor.document.lineAt(startLine).text.trim();

      const documentUri = activeTextEditor.document.uri;
      const lineInfo = (await lineInfoIndex.lineInfo(documentUri)).filter(
        (line) => line.codeObjects
      );
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
      if (!workspaceFolder) return;

      const lineCodePrompt =
        selectedCode.split('\n').length === 0
          ? selectedCode
          : [selectedCode.split('\n')[0], '...'].join('');
      const question = await vscode.window.showInputBox({
        placeHolder: `Ask a question about: ${lineCodePrompt}`,
        value: 'How does this code work?',
      });
      if (!question) return;

      const distanceFromSelection = (item: LineInfoQuickPickItem): number =>
        Math.min(Math.abs(item.lineInfo.line - startLine), Math.abs(item.lineInfo.line - endLine));

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

      const appmapUri = vscode.Uri.file(appMapFileName);
      let codeObject: CodeObject | undefined;
      let scopeCodeObjects: CodeObject[];
      let returnValues: string[];
      let functions: string[];
      let sequenceDiagram: string;
      {
        const data = await readFile(appmapUri.fsPath, 'utf-8');
        const appmap = buildAppMap().source(data).build();

        appmap.classMap.visit((co) => {
          if (co.fqid === codeObjectEntry.fqid) codeObject = co;
        });
        if (!codeObject) {
          vscode.window.showInformationMessage(
            `Could not find code object ${codeObjectEntry.fqid} in the AppMap. Maybe it's out of date?`
          );
          return;
        }

        const { events } = appmap;
        let filterAppMap: AppMap;
        {
          const codeObjectEvents = events.filter(
            (event) => event.codeObject.fqid === codeObjectEntry.fqid
          );
          returnValues = [
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
          const roots: Event[] = [];
          const filterEvents: Event[] = [...codeObjectEvents];
          for (const event of codeObjectEvents) {
            for (const ancestor of new EventNavigator(event).ancestors()) {
              filterEvents.push(ancestor.event);
              if (ancestor.event.httpServerRequest) {
                roots.push(ancestor.event);
                break;
              }
              if (!ancestor.event.parent) roots.push(ancestor.event);
            }
            for (const child of event.children) {
              filterEvents.push(child);
              for (const child2 of child.children) {
                filterEvents.push(child2);
                for (const child3 of child2.children) {
                  filterEvents.push(child3);
                  for (const child4 of child3.children) filterEvents.push(child4);
                }
              }
            }
          }
          for (const root of roots) {
            for (const child of root.children) {
              filterEvents.push(child);
              for (const child2 of child.children) {
                filterEvents.push(child2);
                for (const child3 of child2.children) {
                  filterEvents.push(child3);
                  for (const child4 of child3.children) filterEvents.push(child4);
                }
              }
            }
          }

          scopeCodeObjects = [...new Set(roots.map((e) => e.codeObject))];
          // const relatedCodeObjects = [...new Set(filterEvents.map((e) => e.codeObject))];
          // KEG: I want to avoid sending too much source code to the AI, as it places undue priority
          // on the source code rather than the code flow.
          functions = [];
          for (const co of [codeObject] /* relatedCodeObjects */) {
            const codeObjectEntry = await classMapIndex.lookupCodeObject(co.fqid);
            if (!codeObjectEntry) continue;
            if (!codeObjectEntry.path || !codeObjectEntry?.lineNo) continue;

            let { path } = codeObjectEntry;
            const { lineNo } = codeObjectEntry;
            if (!isAbsolute(path)) path = join(codeObjectEntry.folder.uri.fsPath, path);
            if (!(await fileExists(path))) continue;
            if (!path.startsWith(codeObjectEntry.folder.uri.fsPath)) continue;
            if (
              path.slice(codeObjectEntry.folder.uri.fsPath.length).startsWith('/node_modules/') ||
              path.slice(codeObjectEntry.folder.uri.fsPath.length).startsWith('/vendor/')
            )
              continue;

            const code = (await readFile(path, 'utf-8')).split('\n');
            // Sort lineInfo by distance from codeObject
            const distanceFromCodeObject = (lineInfo: LineInfo) => lineInfo.line - lineNo;
            const nextLineInfo = lineInfo
              .sort((a, b) => distanceFromCodeObject(a) - distanceFromCodeObject(b))
              .filter((li) => distanceFromCodeObject(li) > 0)
              .sort()[0];
            const lastLine = nextLineInfo ? nextLineInfo.line : codeObjectEntry.lineNo + 10;
            const codeLines = code.slice(codeObjectEntry.lineNo - 1, lastLine - 1);
            functions.push([codeObjectEntry.fqid, ...codeLines].join('\n'));
          }

          const eventIds = new Set(filterEvents.map((e) => e.id));
          filterAppMap = buildAppMap({
            events: events.filter((e) => eventIds.has(e.callEvent.id)),
            classMap: appmap.classMap.roots.map((c) => ({ ...c.data })),
            metadata: appmap.metadata,
          }).build();

          const filterAppMapData = JSON.stringify(filterAppMap, null, 2);
          let appmapName = question.replace(/[^a-zA-Z0-9]/g, '-');
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
        sequenceDiagram = format(FormatType.PlantUML, diagram, appmapUri.fsPath).diagram;
      }

      const openAI = await buildOpenAIApi(context);
      if (!openAI) return;

      await vscode.window.withProgress(
        {
          title: `Thinking about your question...`,
          location: vscode.ProgressLocation.Notification,
        },
        async () => {
          assert(codeObject);

          try {
            await ask(
              question,
              selectedCode,
              codeObject,
              returnValues,
              scopeCodeObjects,
              functions,
              sequenceDiagram,
              openAI
            );
          } catch (e) {
            debug((e as any).toString());
            vscode.window.showErrorMessage(`Unable to process your question: ${e}`);
          }
        }
      );
    })
  );
}
