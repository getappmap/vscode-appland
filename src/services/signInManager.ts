import * as vscode from 'vscode';
import { AUTHN_PROVIDER_NAME, getApiKey } from '../authentication';
import { DEBUG_EXCEPTION, SIDEBAR_SIGN_IN, Telemetry } from '../telemetry';
import ErrorCode from '../telemetry/definitions/errorCodes';

export default class SignInManager {
  private static contextKeyShowSignInWebview = 'appMap.showSignIn';
  public static signedIn: boolean;

  public static async register(): Promise<void> {
    await this.updateSignInState();

    vscode.authentication.onDidChangeSessions((e) => {
      if (e.provider.id !== AUTHN_PROVIDER_NAME) return;

      setTimeout(this.updateSignInState.bind(this), 0);
    });
  }

  public static async signIn(): Promise<void> {
    if (this.signedIn) return;

    try {
      this.signedIn = !!(await getApiKey(true));
      this.updateSignInState();
      if (this.signedIn) vscode.commands.executeCommand('appmap.tryOpenInstallGuide');
    } catch (e) {
      Telemetry.sendEvent(DEBUG_EXCEPTION, {
        exception: e as Error,
        errorCode: ErrorCode.SidebarSignInFailure,
      });
      throw e;
    }

    Telemetry.sendEvent(SIDEBAR_SIGN_IN);
  }

  private static async isUserAuthenticated(): Promise<boolean> {
    return !!(await getApiKey(false));
  }

  public static async updateSignInState(): Promise<void> {
    this.signedIn = await this.isUserAuthenticated();

    await vscode.commands.executeCommand(
      'setContext',
      this.contextKeyShowSignInWebview,
      !this.signedIn
    );
  }
}
