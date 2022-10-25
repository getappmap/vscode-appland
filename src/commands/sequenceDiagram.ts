import * as vscode from 'vscode';
import * as childProcess from 'child_process';
import { AppMap, buildAppMap } from '@appland/models';
import buildSequenceDiagram from '@appland/sequence-diagram/dist/buildDiagram';
import { format as formatPlantUML } from '@appland/sequence-diagram/dist/formatter/plantUML';

import { verifyCommandOutput } from '../services/nodeDependencyProcess';
import { writeFile } from 'fs/promises';
import { readFile } from 'fs/promises';
import AppMapCollection from '../services/appmapCollection';
import { plantUMLJarPath, promptForAppMap, promptForSpecification } from '../lib/sequenceDiagram';
import { ProjectStateServiceInstance } from '../services/projectStateService';

export default async function sequenceDiagram(
  context: vscode.ExtensionContext,
  projectStates: ReadonlyArray<ProjectStateServiceInstance>,
  appmaps: AppMapCollection
): Promise<void> {
  const command = vscode.commands.registerCommand(
    'appmap.sequenceDiagram',
    async (appmapUri: vscode.Uri) => {
      const umlJar = plantUMLJarPath();
      if (!umlJar) return;

      if (!appmapUri) {
        const appmap = await promptForAppMap(projectStates, appmaps.appMaps());
        if (!appmap) return;

        appmapUri = appmap.descriptor.resourceUri;
      }

      const data = await readFile(appmapUri.fsPath, 'utf-8');
      const appmap: AppMap = buildAppMap()
        .source(data)
        .build();

      const specification = await promptForSpecification(appmap);

      vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Generating sequence diagram' },
        async () => {
          const diagram = buildSequenceDiagram(appmapUri.fsPath, appmap, specification);
          const uml = formatPlantUML(diagram, appmapUri.fsPath);
          const diagramFile = [appmapUri.fsPath, '.uml'].join('');
          await writeFile(diagramFile, uml);

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
