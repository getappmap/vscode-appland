import * as vscode from 'vscode';
import * as semver from 'semver';
import { AUTHN_PROVIDER_NAME, getApiKey } from '../authentication';
import ExtensionState from '../configuration/extensionState';
import { DEBUG_EXCEPTION, Telemetry } from '../telemetry';
import ErrorCode from '../telemetry/definitions/errorCodes';

export default class SignInManager {
  private static contextKeyShowSignInWebview = 'appMap.showSignIn';
  private static signedIn: boolean;
  private static firstInstalledVersion: semver.SemVer | null;
  private static versionCutOff = '0.66.2';

  public static async register(extensionState: ExtensionState): Promise<void> {
    this.firstInstalledVersion = semver.coerce(extensionState.firstVersionInstalled);
    await this.updateSignInState();

    if (!extensionState.hasSeenWalkthrough()) {
      vscode.commands.executeCommand(
        'workbench.action.openWalkthrough',
        'appland.appmap#navie.walkthrough'
      );
      extensionState.setSeenWalkthrough();
    }

    vscode.authentication.onDidChangeSessions((e) => {
      if (e.provider.id !== AUTHN_PROVIDER_NAME) return;

      setTimeout(() => this.updateSignInState(), 0);
    });
  }

  public static async signIn(ssoTarget?: string): Promise<void> {
    if (this.signedIn) return;

    try {
      this.signedIn = !!(await getApiKey(true, ssoTarget));
      await this.updateSignInState();
    } catch (e) {
      Telemetry.sendEvent(DEBUG_EXCEPTION, {
        exception: e as Error,
        errorCode: ErrorCode.SidebarSignInFailure,
      });
      throw e;
    }
  }

  private static async isUserAuthenticated(): Promise<boolean> {
    return !!(await getApiKey(false));
  }

  public static shouldShowSignIn(): boolean {
    if (!this.firstInstalledVersion) return false;

    const meetsVersionRequirement = semver.gt(this.firstInstalledVersion, this.versionCutOff);
    return !!(meetsVersionRequirement && !this.signedIn);
  }

  public static async updateSignInState(): Promise<void> {
    this.signedIn = await this.isUserAuthenticated();

    await vscode.commands.executeCommand(
      'setContext',
      this.contextKeyShowSignInWebview,
      this.shouldShowSignIn()
    );
  }
}
