import * as vscode from 'vscode';
import * as childProcess from 'child_process';
import { readFile, writeFile } from 'fs/promises';

import { AppMap, buildAppMap } from '@appland/models';

import { verifyCommandOutput } from '../services/nodeDependencyProcess';
import AppMapCollection from '../services/appmapCollection';
import { plantUMLJarPath, promptForSpecification } from '../lib/sequenceDiagram';
import { promptForAppMap } from '../lib/promptForAppMap';
import { tmpName } from 'tmp';
import { promisify } from 'util';
import {
  buildDiagram,
  buildDiffDiagram,
  Diagram,
  diff,
  format,
  FormatType,
  Specification,
} from '@appland/sequence-diagram';

export default async function compareSequenceDiagrams(
  context: vscode.ExtensionContext,
  appmaps: AppMapCollection
): Promise<void> {
  const command = vscode.commands.registerCommand(
    'appmap.compareSequenceDiagrams',
    async (baseAppMapUri: vscode.Uri, headAppMapUri: vscode.Uri) => {
      const umlJar = await plantUMLJarPath();
      if (!umlJar) return;

      const diffDiagrams = async (): Promise<{ base: Diagram; head: Diagram } | undefined> => {
        const uris = [baseAppMapUri, headAppMapUri];
        let specification: Specification | undefined;
        const diagrams: Diagram[] = [];
        const excludeAppMaps: vscode.Uri[] = [];
        for (let index = 0; index < uris.length; index++) {
          let appmapUri: vscode.Uri | undefined = uris[index];
          if (!appmapUri) {
            appmapUri = await promptForAppMap(appmaps.appMaps(), excludeAppMaps);
            if (!appmapUri) return;

            excludeAppMaps.push(appmapUri);
          }
          if (!appmapUri) return;

          const data = await readFile(appmapUri.fsPath, 'utf-8');
          const appmap: AppMap = buildAppMap().source(data).build();

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

          const uml = format(FormatType.PlantUML, diffDiagram, 'base -> head');
          const diagramFile = await promisify(tmpName)();
          await writeFile(diagramFile, uml.diagram);

          const cmd = childProcess.spawn('java', ['-jar', umlJar, '-tsvg', diagramFile]);
          try {
            await verifyCommandOutput(cmd);
          } catch {
            vscode.window.showInformationMessage(
              'No sequence diagram diff is available for these AppMaps. Try changing the diagram configuration.'
            );
            return;
          }

          const svgFile = [diagramFile, 'svg'].join('.');
          vscode.env.openExternal(vscode.Uri.file(svgFile));
        }
      );

      context.subscriptions.push(command);
    }
  );
}
