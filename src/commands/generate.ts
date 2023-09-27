import * as vscode from 'vscode';
import AppMapCollection from '../services/appmapCollection';
import selectedCode from '../lib/ask/selectedCode';
import { promptForAppMap } from '../lib/promptForAppMap';
import { CodeGen, Completion } from '../lib/ask';
import assert from 'assert';
import buildOpenAIApi from '../lib/buildOpenAIApi';
import { FormatType, Specification, buildDiagram, format } from '@appland/sequence-diagram';
import { AppMap, AppMapFilter, buildAppMap } from '@appland/models';
import contextAppMap from '../lib/ask/contextAppMap';
import { readFile, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { debug } from 'console';

export default function register(
  context: vscode.ExtensionContext,
  appmapCollection: AppMapCollection
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.generate', async () => {
      const documentUri = vscode.window.activeTextEditor?.document.uri;
      if (!documentUri) return;

      const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
      if (!workspaceFolder) return;

      const selection = selectedCode(vscode.window.activeTextEditor);
      if (!selection) return;

      const lineCodePrompt =
        selection.text.split('\n').length === 0
          ? selection.text
          : [selection.text.split('\n')[0], '...'].join('');
      const question = await vscode.window.showInputBox({
        placeHolder: `Generated code related to: ${lineCodePrompt}`,
      });
      if (!question) return;

      const appmaps = appmapCollection.allAppMaps();
      const appmapUri = await promptForAppMap(appmaps);
      if (!appmapUri) return;

      const g = new CodeGen(selection.text, question);

      {
        const appmapEntry = appmaps.find((appmap) => appmap.descriptor.resourceUri === appmapUri);
        assert(appmapEntry);

        if (appmapEntry.descriptor.metadata?.language?.name)
          g.language = appmapEntry.descriptor.metadata.language.name;
      }

      let filterAppMap: AppMap;
      {
        const data = await readFile(appmapUri.fsPath, 'utf-8');
        const appmap = buildAppMap().source(data).build();

        filterAppMap = contextAppMap(appmap, appmap.rootEvents());

        g.scopeCodeObjects = [...new Set(appmap.rootEvents().map((e) => e.codeObject))];
      }

      {
        const filterAppMapData = JSON.stringify(filterAppMap, null, 2);
        let appmapName = ['ask_appmap', randomUUID()].join('-'); // question.replace(/[^a-zA-Z0-9]/g, '-'); KEG: Can result in a too-long file name.
        if (appmapName.endsWith('-')) appmapName = appmapName.slice(0, -1);
        const filePath = join(workspaceFolder.uri.fsPath, `${appmapName}.appmap.json`);
        await writeFile(filePath, filterAppMapData);
        const uri = vscode.Uri.file(filePath);
        await vscode.commands.executeCommand('vscode.openWith', uri, 'appmap.views.appMapFile');
      }

      const specification = Specification.build(filterAppMap, { loops: true });
      assert(appmapUri);
      let sequenceDiagramAppMap: AppMap;
      {
        const sequenceDiagramFilter = new AppMapFilter();
        if (filterAppMap.metadata.language?.name !== 'java')
          sequenceDiagramFilter.declutter.hideExternalPaths.on = true;
        sequenceDiagramAppMap = sequenceDiagramFilter.filter(filterAppMap, []);
      }
      const diagram = buildDiagram(appmapUri.fsPath, sequenceDiagramAppMap, specification);
      g.sequenceDiagram = format(FormatType.PlantUML, diagram, appmapUri.fsPath).diagram;

      const openAI = await buildOpenAIApi(context);
      if (!openAI) return;

      let completion: Completion | undefined;
      await vscode.window.withProgress(
        {
          title: `Generating code...`,
          location: vscode.ProgressLocation.Notification,
        },
        async () => {
          try {
            completion = await g.complete(openAI);
          } catch (e) {
            debug((e as any).toString());
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
