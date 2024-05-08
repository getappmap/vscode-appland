import * as vscode from 'vscode';
import fetch from 'node-fetch';
import semverCompare from 'semver/functions/compare';
import semverValid from 'semver/functions/valid';

const MIN_VERSIONS_JSON_URL =
  'https://raw.githubusercontent.com/getappmap/vscode-appland/develop/.github/min-versions.json';

async function fetchMinVersions(url: string) {
  try {
    const response = await fetch(url);
    return await response.json();
  } catch (e) {
    /* Do nothing if there is no min versions json. */
  }
}

export type MinVersions = {
  vsCode?: string;
  extension?: string;
};

export async function checkVersions(
  context: vscode.ExtensionContext,
  minVersions?: MinVersions,
  minVersionsJsonUrl: string = MIN_VERSIONS_JSON_URL
): Promise<void> {
  if (minVersions == undefined) minVersions = await fetchMinVersions(minVersionsJsonUrl);
  if (minVersions == undefined) return;

  const vsCodeIsOld =
    minVersions.vsCode &&
    semverValid(minVersions.vsCode, true) &&
    semverCompare(minVersions.vsCode, vscode.version, true) == 1;
  const extensionIsOld =
    minVersions.extension &&
    semverValid(minVersions.extension, true) &&
    semverCompare(minVersions.extension, context.extension.packageJSON.version, true) == 1;

  const clauses: string[] = [];
  if (vsCodeIsOld) clauses.push(`VSCode to v${minVersions.vsCode} or higher`);
  if (extensionIsOld) clauses.push(`AppMap extension to v${minVersions.extension} or higher`);
  if (clauses.length > 0) {
    const choice = await vscode.window.showWarningMessage(
      `Update Required: Please update ${clauses.join(' and ')}.`,
      'Update Now'
    );
    if (choice == 'Update Now') {
      if (vsCodeIsOld) vscode.commands.executeCommand('update.checkForUpdate');
      else vscode.commands.executeCommand('workbench.extensions.action.checkForUpdates');
    }
  }
}
