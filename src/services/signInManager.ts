import * as vscode from 'vscode';
import * as semver from 'semver';
import { AUTHN_PROVIDER_NAME, getApiKey } from '../authentication';
import ExtensionState from '../configuration/extensionState';

export default class SignInManager {
  private static contextKeyShowSignInWebview = 'appMap.showSignIn';
  private static signedIn: boolean;
  private static firstInstalledVersion: semver.SemVer | null;
  private static versionCutOff = '0.66.2';

  public static async register(extensionState: ExtensionState): Promise<void> {
    this.firstInstalledVersion = semver.coerce(extensionState.firstVersionInstalled);
    await this.updateSignInState();

    vscode.authentication.onDidChangeSessions((e) => {
      if (e.provider.id !== AUTHN_PROVIDER_NAME) return;

      setTimeout(this.updateSignInState.bind(this), 0);
    });
  }

  public static async signIn(): Promise<void> {
    if (this.signedIn) return;

    this.signedIn = !!(await getApiKey(true));
    this.updateSignInState();
  }

  private static async isUserAuthenticated(): Promise<boolean> {
    return !!(await getApiKey(false));
  }

  private static shouldShowSignIn(): boolean {
    if (!this.firstInstalledVersion) return false;

    const meetsVersionRequirement = semver.gt(this.firstInstalledVersion, this.versionCutOff);
    return !!(meetsVersionRequirement && !this.signedIn);
  }

  private static async updateSignInState(): Promise<void> {
    this.signedIn = await this.isUserAuthenticated();

    await vscode.commands.executeCommand(
      'setContext',
      this.contextKeyShowSignInWebview,
      this.shouldShowSignIn()
    );
  }
}
