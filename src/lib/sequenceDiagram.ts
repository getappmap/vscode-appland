import { AppMap } from '@appland/models';
import { Specification } from '@appland/sequence-diagram';
import assert from 'assert';
import { basename, join } from 'path';
import * as vscode from 'vscode';

import ExtensionSettings from '../configuration/extensionSettings';
import AppMapLoader from '../services/appmapLoader';
import { ProjectStateServiceInstance } from '../services/projectStateService';
import { fileExists, getWorkspaceFolderFromPath, timeAgo } from '../util';
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

export async function plantUMLJarPath(): Promise<string | undefined> {
  let jarPath = ExtensionSettings.plantUMLJarPath();
  if (!jarPath) {
    jarPath = join(__dirname, 'ext', 'plantuml-1.2022.8.jar');
  }
  if (!(await fileExists(jarPath))) {
    vscode.window.showErrorMessage(
      `PlantUML JAR file ${jarPath}, as specified by "AppMap : Plant UML Jar Path", does not exist`
    );
    return;
  }
  return jarPath;
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
    value: suggestedIgnorePackages.join(' '),
  });

  const ignorePackages = (ignorePackagesText || '')
    .split(/\s+/)
    .map((pkg) => ['package', pkg].join(':'));

  const expandPackagesText = await vscode.window.showInputBox({
    title: EXPAND_PACKAGES_TITLE,
    value: '',
  });

  const expandPackages = (expandPackagesText || '')
    .split(/\s+/)
    .map((pkg) => ['package', pkg].join(':'));

  return Specification.build(appmap, {
    exclude: ignorePackages,
    expand: expandPackages,
  });
}
