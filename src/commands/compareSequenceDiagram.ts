import * as vscode from 'vscode';
import * as childProcess from 'child_process';
import { readFile, writeFile } from 'fs/promises';

import { AppMap, buildAppMap } from '@appland/models';
import buildDiagram from '@appland/sequence-diagram/dist/buildDiagram';
import diff from '@appland/sequence-diagram/dist/diff';
import buildDiffDiagram from '@appland/sequence-diagram/dist/buildDiffDiagram';
import Specification from '@appland/sequence-diagram/dist/specification';
import { Diagram } from '@appland/sequence-diagram/dist/types';
import { format as formatPlantUML } from '@appland/sequence-diagram/dist/formatter/plantUML';

import { verifyCommandOutput } from '../services/nodeDependencyProcess';
import AppMapCollection from '../services/appmapCollection';
import { plantUMLJarPath, promptForAppMap, promptForSpecification } from '../lib/sequenceDiagram';
import { tmpName } from 'tmp';
import { promisify } from 'util';
import { ProjectStateServiceInstance } from '../services/projectStateService';

export default async function compareSequenceDiagrams(
  context: vscode.ExtensionContext,
  projectStates: ReadonlyArray<ProjectStateServiceInstance>,
  appmaps: AppMapCollection
): Promise<void> {
  const command = vscode.commands.registerCommand(
    'appmap.compareSequenceDiagrams',
    async (baseAppMapUri: vscode.Uri, headAppMapUri: vscode.Uri) => {
      const umlJar = plantUMLJarPath();
      if (!umlJar) return;

      const diffDiagrams = async (): Promise<{ base: Diagram; head: Diagram } | undefined> => {
        const uris = [baseAppMapUri, headAppMapUri];
        let specification: Specification | undefined;
        const diagrams: Diagram[] = [];
        for (let index = 0; index < uris.length; index++) {
          let appmapUri = uris[index];
          if (!appmapUri) {
            const appmap = await promptForAppMap(projectStates, appmaps.appMaps());
            if (!appmap) return;

            appmapUri = appmap.descriptor.resourceUri;
          }
          const data = await readFile(appmapUri.fsPath, 'utf-8');
          const appmap: AppMap = buildAppMap()
            .source(data)
            .build();

          if (!specification) specification = await promptForSpecification(appmap);

          const diagram = buildDiagram(appmapUri.fsPath, appmap, specification);
          diagrams.push(diagram);
        }
        return { base: diagrams[0], head: diagrams[1] };
      };

      vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Generating sequence diagram' },
        async () => {
          const diagrams = await diffDiagrams();
          if (!diagrams) return;

          const { base, head } = diagrams;
          const diffRaw = diff(base, head, { verbose: false });
          const diffDiagram = buildDiffDiagram(diffRaw);

          const uml = formatPlantUML(diffDiagram, 'base -> head');
          const diagramFile = await promisify(tmpName)();
          await writeFile(diagramFile, uml);

          const cmd = childProcess.spawn('java', ['-jar', umlJar, '-tsvg', diagramFile]);
          await verifyCommandOutput(cmd);

          const svgFile = [diagramFile, 'svg'].join('.');
          vscode.env.openExternal(vscode.Uri.file(svgFile));
        }
      );

      context.subscriptions.push(command);
    }
  );
}
