import { AppMap, CodeObject } from '@appland/models';
import Priority from '@appland/sequence-diagram/dist/priority';
import Specification from '@appland/sequence-diagram/dist/specification';
import assert from 'assert';
import { basename } from 'path';
import * as vscode from 'vscode';

import ExtensionSettings from '../configuration/extensionSettings';
import AppMapLoader from '../services/appmapLoader';
import { ProjectStateServiceInstance } from '../services/projectStateService';
import { getWorkspaceFolderFromPath, timeAgo } from '../util';
import { lookupAppMapDir } from './appmapDir';

export const PACKAGES_TITLE = 'Enter packages to exclude from the diagram';

export const EXPAND_PACKAGES_TITLE = 'Enter packages to expand into classes';

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

export function plantUMLJarPath(): string | undefined {
  const result = ExtensionSettings.plantUMLJarPath;
  if (!result) {
    vscode.window.showErrorMessage(
      `Setting "AppMap : Plant UML Jar Path" is required to generate sequence diagrams`
    );
    return;
  }
  return result;
}

export type AppMapQuickPickItem = vscode.QuickPickItem & {
  resourceUri: vscode.Uri;
};

export async function promptForAppMap(
  projectStates: ReadonlyArray<ProjectStateServiceInstance>,
  appmaps: AppMapLoader[],
  exclude: vscode.Uri[] = []
): Promise<vscode.Uri | undefined> {
  const now = Date.now();
  const items = (
    await Promise.all(
      appmaps
        .filter((appmap) => appmap.descriptor.metadata?.name)
        .filter((appmap) => !exclude.includes(appmap.descriptor.resourceUri))
        .map(async (appmap) => {
          assert(appmap.descriptor.metadata?.name);
          let path = appmap.descriptor.resourceUri.fsPath;
          const projectFolder = getWorkspaceFolderFromPath(projectStates, path);
          const label = [appmap.descriptor.metadata?.name];
          if (projectFolder) {
            path = path.slice(projectFolder.uri.fsPath.length + 1);

            const detectedAppMapDir = await lookupAppMapDir(projectFolder.uri.fsPath);

            if (detectedAppMapDir && path.startsWith(detectedAppMapDir)) {
              const filename = basename(path);
              const appmapFolder = path.slice(
                detectedAppMapDir.length + 1,
                path.length - filename.length - 1
              );
              label.unshift(`[${appmapFolder}]`);
            }
          }

          return {
            resourceUri: appmap.descriptor.resourceUri,
            label: label.join(' '),
            description: timeAgo(appmap.descriptor.timestamp, now),
            detail: path,
          } as AppMapQuickPickItem;
        })
    )
  ).sort((a, b) => a.label.localeCompare(b.label));
  const result = await vscode.window.showQuickPick<AppMapQuickPickItem>(items);
  if (!result) return;

  return result.resourceUri;
}

export async function promptForSpecification(appmap: AppMap): Promise<Specification> {
  const language = appmap.metadata.language?.name || 'unknownLanguage';
  const suggestedIgnorePackages = IGNORE_PACKAGES[language] || [];

  const ignorePackagesText = await vscode.window.showInputBox({
    title: PACKAGES_TITLE,
    value: ExtensionSettings.getSequenceDiagramSetting(
      language,
      'ignorePackages',
      suggestedIgnorePackages.join(' ')
    ),
  });

  ExtensionSettings.setSequenceDiagramSetting('ignorePackages', language, ignorePackagesText || '');

  const ignorePackages = (ignorePackagesText
    ? ignorePackagesText.split(/\s+/)
    : suggestedIgnorePackages
  ).map((pkg) => ['package', pkg].join(':'));

  const expandPackagesText = await vscode.window.showInputBox({
    title: EXPAND_PACKAGES_TITLE,
    value: ExtensionSettings.getSequenceDiagramSetting(language, 'expandPackages', ''),
  });

  ExtensionSettings.setSequenceDiagramSetting('expandPackages', language, expandPackagesText || '');

  const expandPackages = (expandPackagesText ? expandPackagesText.split(/\s+/) : []).map((pkg) =>
    ['package', pkg].join(':')
  );

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
  return new Specification(priority, includedCodeObjectIds, requiredCodeObjectIds);
}
