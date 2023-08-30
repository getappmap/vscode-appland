import { AppMap } from '@appland/models';
import { Specification } from '@appland/sequence-diagram';
import { join } from 'path';
import * as vscode from 'vscode';

import ExtensionSettings from '../configuration/extensionSettings';
import { fileExists } from '../util';

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
    jarPath = join(__dirname, 'plantuml-1.2022.8.jar');
  }
  if (!(await fileExists(jarPath))) {
    vscode.window.showErrorMessage(
      `PlantUML JAR file ${jarPath}, as specified by "AppMap : Plant UML Jar Path", does not exist`
    );
    return;
  }
  return jarPath;
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
