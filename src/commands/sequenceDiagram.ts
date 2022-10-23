import * as vscode from 'vscode';
import * as childProcess from 'child_process';
import { AppMap, buildAppMap, CodeObject } from '@appland/models';
import buildSequenceDiagram from '@appland/sequence-diagram/dist/buildDiagram';
import { format as formatPlantUML } from '@appland/sequence-diagram/dist/formatter/plantUML';

import { verifyCommandOutput } from '../services/nodeDependencyProcess';
import ExtensionSettings from '../configuration/extensionSettings';
import Specification from '@appland/sequence-diagram/dist/specification';
import Priority from '@appland/sequence-diagram/dist/priority';
import { writeFile } from 'fs/promises';
import { readFile } from 'fs/promises';
import AppMapCollection from '../services/appmapCollection';
import assert from 'assert';

// TODO: Augment or replace these with filters that the user has applied in the AppMap diagram.
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

type AppMapQuickPickItem = vscode.QuickPickItem & {
  resourceUri: vscode.Uri;
};

export default async function sequenceDiagram(
  context: vscode.ExtensionContext,
  appmaps: AppMapCollection
): Promise<void> {
  const command = vscode.commands.registerCommand(
    'appmap.sequenceDiagram',
    async (appmapUri: vscode.Uri) => {
      const plantUMLJarPath = ExtensionSettings.plantUMLJarPath;
      if (!plantUMLJarPath) {
        vscode.window.showErrorMessage(
          `Setting "AppMap : Plant UML Jar Path" is required to generate sequence diagrams`
        );
        return;
      }

      if (!appmapUri) {
        const items = appmaps
          .appMaps()
          .filter((appmap) => appmap.descriptor.metadata?.name)
          .map(
            (appmap) =>
              ({
                resourceUri: appmap.descriptor.resourceUri,
                label: appmap.descriptor.metadata?.name,
              } as AppMapQuickPickItem)
          );
        const appmap = await vscode.window.showQuickPick<AppMapQuickPickItem>(items);
        if (!appmap) return;

        appmapUri = appmap.resourceUri;
      }

      const data = await readFile(appmapUri.fsPath, 'utf-8');
      const appmap: AppMap = buildAppMap()
        .source(data)
        .build();

      const language = appmap.metadata.language?.name || 'unknownLanguage';
      const suggestedIgnorePackages = IGNORE_PACKAGES[language] || [];

      const ignorePackagesText = await vscode.window.showInputBox({
        title: 'Enter packages to exclude from the diagram',
        value: ExtensionSettings.getSequenceDiagramSetting(
          language,
          'ignorePackages',
          suggestedIgnorePackages.join(' ')
        ),
      });

      ExtensionSettings.setSequenceDiagramSetting(
        'ignorePackages',
        language,
        ignorePackagesText || ''
      );

      const ignorePackages = (ignorePackagesText
        ? ignorePackagesText.split(/\s+/)
        : suggestedIgnorePackages
      ).map((pkg) => ['package', pkg].join(':'));

      const expandPackagesText = await vscode.window.showInputBox({
        title: 'Enter packages to expand into classes',
        value: ExtensionSettings.getSequenceDiagramSetting(language, 'expandPackages', ''),
      });

      ExtensionSettings.setSequenceDiagramSetting(
        'expandPackages',
        language,
        expandPackagesText || ''
      );

      const expandPackages = (expandPackagesText
        ? expandPackagesText.split(/\s+/)
        : []
      ).map((pkg) => ['package', pkg].join(':'));

      // Include HTTP, all packages, and the database
      const includedCodeObjectIds = new Set<string>();
      includedCodeObjectIds.add('http:HTTP server requests');
      includedCodeObjectIds.add('database:Database');

      const packageNames: string[] = [];
      const requiredCodeObjectIds = new Set<string>();
      const classesForPackage = new Map<string, string[]>();
      appmap.classMap.visit((co: CodeObject) => {
        if (co.type === 'package' && !ignorePackages.includes(co.fqid)) {
          packageNames.push(co.fqid);
        }
        if (co.type === 'class') {
          let pkg = co.packageObject;
          while (pkg) {
            let classes: string[] | undefined = classesForPackage.get(pkg.fqid);
            if (!classes) {
              classes = [];
              classesForPackage.set(pkg.fqid, classes);
            }
            classes.push(co.fqid);
            pkg = pkg.parent;
          }
        }
      });

      packageNames
        .filter((pkg) => expandPackages.includes(pkg))
        .forEach((pkg) => {
          const classes = classesForPackage.get(pkg);
          assert(classes);
          classes.forEach((cls) => requiredCodeObjectIds.add(cls));
        });
      packageNames
        .filter((pkg) => !expandPackages.includes(pkg))
        .forEach((pkg) => requiredCodeObjectIds.add(pkg));

      const priority = new Priority();
      priority.enrollPattern('http:%r{.*}');
      priority.expandPattern('http:%r{.*}', ['http:HTTP server requests']);

      priority.enrollPattern('package:%r{.*}');
      priority.expandPattern('package:%r{.*}', packageNames);

      priority.enrollPattern('database:%r{.*}');
      priority.expandPattern('database:%r{.*}', ['database:Database']);

      for (const coid of requiredCodeObjectIds) {
        includedCodeObjectIds.add(coid);
      }
      const specification = new Specification(
        priority,
        includedCodeObjectIds,
        requiredCodeObjectIds
      );

      vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Generating sequence diagram' },
        async () => {
          const diagram = buildSequenceDiagram(appmapUri.fsPath, appmap, specification);
          const uml = formatPlantUML(diagram, appmapUri.fsPath);
          const diagramFile = [appmapUri.fsPath, '.uml'].join('');
          await writeFile(diagramFile, uml);

          const cmd = childProcess.spawn('java', ['-jar', plantUMLJarPath, '-tsvg', diagramFile]);
          await verifyCommandOutput(cmd);

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
