import * as vscode from 'vscode';
import * as childProcess from 'child_process';
import { AppMap, buildAppMap } from '@appland/models';
import { buildDiagram, format, FormatType } from '@appland/sequence-diagram';

import { verifyCommandOutput } from '../services/nodeDependencyProcess';
import { writeFile } from 'fs/promises';
import { readFile } from 'fs/promises';
import AppMapCollection from '../services/appmapCollection';
import { plantUMLJarPath, promptForAppMap, promptForSpecification } from '../lib/sequenceDiagram';
import { ProjectStateServiceInstance } from '../services/projectStateService';
import assert from 'assert';

export default async function sequenceDiagram(
  context: vscode.ExtensionContext,
  projectStates: ReadonlyArray<ProjectStateServiceInstance>,
  appmaps: AppMapCollection
): Promise<void> {
  const command = vscode.commands.registerCommand(
    'appmap.sequenceDiagram',
    async (appmapUri: vscode.Uri | undefined) => {
      const umlJar = plantUMLJarPath();
      if (!umlJar) return;

      if (!appmapUri) {
        appmapUri = await promptForAppMap(projectStates, appmaps.appMaps());
      }
      if (!appmapUri) return;

      const data = await readFile(appmapUri.fsPath, 'utf-8');
      const appmap: AppMap = buildAppMap()
        .source(data)
        .build();

      const specification = await promptForSpecification(appmap);

      vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Generating sequence diagram' },
        async () => {
          assert(appmapUri);
          const diagram = buildDiagram(appmapUri.fsPath, appmap, specification);
          const uml = format(FormatType.PlantUML, diagram, appmapUri.fsPath);
          const diagramFile = [appmapUri.fsPath, 'uml'].join('.');
          await writeFile(diagramFile, uml.diagram);

          const cmd = childProcess.spawn('java', ['-jar', umlJar, '-tsvg', diagramFile]);
          try {
            await verifyCommandOutput(cmd);
          } catch {
            vscode.window.showInformationMessage(
              'No sequence diagram is available for this AppMap. Try changing the diagram configuration.'
            );
            return;
          }

          const tokens = diagramFile.split('.');
          vscode.env.openExternal(
            vscode.Uri.file([...tokens.slice(0, tokens.length - 1), 'svg'].join('.'))
          );
        }
      );
      context.subscriptions.push(command);
    }
  );
}
