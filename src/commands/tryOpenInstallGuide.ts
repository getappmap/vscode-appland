import * as vscode from 'vscode';
import semver from 'semver';
import SignInManager from '../services/signInManager';
import ExtensionState from '../configuration/extensionState';

export default function tryOpenInstallGuide(extensionState: ExtensionState): vscode.Disposable {
  return vscode.commands.registerCommand('appmap.tryOpenInstallGuide', async () => {
    const firstVersionInstalled = semver.coerce(extensionState.firstVersionInstalled);
    if (firstVersionInstalled && semver.gte(firstVersionInstalled, '0.15.0')) {
      // Logic within this block will only be executed if the extension was installed after we began tracking the
      // time of installation. We will use this to determine whether or not our UX improvements are effective, without
      // before rolling them out to our existing user base.

      if (!extensionState.hasViewedInstallGuide && !SignInManager.shouldShowSignIn()) {
        extensionState.hasViewedInstallGuide = true;
        await vscode.commands.executeCommand('appmap.openInstallGuide', 'project-picker');
        return true;
      }
    }
    return false;
  });
}
