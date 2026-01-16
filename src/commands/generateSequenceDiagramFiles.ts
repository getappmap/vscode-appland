import * as vscode from 'vscode';
import { AppMap, buildAppMap } from '@appland/models';
import { buildDiagram, format, FormatType, Specification } from '@appland/sequence-diagram';
import { writeFile, readFile } from 'fs/promises';
import AppMapLoader from '../services/appmapLoader';

export default function registerCommand(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'appmap.generateSequenceDiagramFiles',
      async (item: AppMapLoader) => {
        if (!item) {
          vscode.window.showErrorMessage('No AppMap selected');
          return;
        }

        if (!item.descriptor || !item.descriptor.resourceUri) {
          vscode.window.showErrorMessage(
            'Invalid AppMap item: missing descriptor or resourceUri'
          );
          console.error('AppMap item:', item);
          return;
        }

        const appmapUri = item.descriptor.resourceUri;

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Generating sequence diagram',
          },
          async (progress) => {
            try {
              // Read and build AppMap
              progress.report({ message: 'Loading AppMap...' });
              const data = await readFile(appmapUri.fsPath, 'utf-8');
              const appmap: AppMap = buildAppMap().source(data).build();

              // Build specification with defaults (no prompts)
              progress.report({ message: 'Building diagram specification...' });
              const specification = Specification.build(appmap, {
                exclude: getDefaultExcludePackages(appmap),
                expand: [],
              });

              // Build diagram
              progress.report({ message: 'Generating diagram...' });
              const diagram = buildDiagram(appmapUri.fsPath, appmap, specification);

              // Generate PlantUML
              progress.report({ message: 'Formatting PlantUML...' });
              const uml = format(FormatType.PlantUML, diagram, appmapUri.fsPath);
              const umlFile = `${appmapUri.fsPath}.uml`;
              await writeFile(umlFile, uml.diagram);

              // Open file
              progress.report({ message: 'Opening file...' });
              const umlDoc = await vscode.workspace.openTextDocument(umlFile);
              await vscode.window.showTextDocument(umlDoc, { preview: false });

              vscode.window.showInformationMessage(
                `Generated sequence diagram: ${vscode.workspace.asRelativePath(umlFile)}`
              );
            } catch (error) {
              vscode.window.showErrorMessage(
                `Failed to generate sequence diagram: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          }
        );
      }
    )
  );
}

// Helper function to get default exclude packages based on language
function getDefaultExcludePackages(appmap: AppMap): string[] {
  const language = appmap.metadata.language?.name || 'unknownLanguage';

  const IGNORE_PACKAGES: Record<string, string[]> = {
    ruby: [
      'actionpack',
      'activesupport',
      'activerecord',
      'actionview',
      'json',
      'logger',
      'openssl',
      'ruby',
      'sprockets',
    ],
  };

  const packages = IGNORE_PACKAGES[language] || [];
  return packages.map((pkg) => `package:${pkg}`);
}
