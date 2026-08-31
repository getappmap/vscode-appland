import * as vscode from 'vscode';
import * as semver from 'semver';
import { AUTHN_PROVIDER_NAME, getApiKey } from '../authentication';
import { isEntitled, onDidChangeEntitlement } from '../configuration/customerId';
import ExtensionState from '../configuration/extensionState';
import { DEBUG_EXCEPTION, Telemetry } from '../telemetry';
import ErrorCode from '../telemetry/definitions/errorCodes';

export default class SignInManager {
  private static contextKeyShowSignInWebview = 'appMap.showSignIn';
  private static signedIn: boolean;
  private static firstInstalledVersion: semver.SemVer | null;
  private static versionCutOff = '0.66.2';
  private static context: vscode.ExtensionContext | undefined;

  public static async register(
    extensionState: ExtensionState,
    context: vscode.ExtensionContext
  ): Promise<void> {
    this.context = context;
    this.firstInstalledVersion = semver.coerce(extensionState.firstVersionInstalled);
    void this.updateSignInState().catch((e) => {
      console.error('Error updating sign-in state on register():', e);
      Telemetry.sendEvent(DEBUG_EXCEPTION, {
        exception: e as Error,
        errorCode: ErrorCode.UpdateSignInStateFailure,
      });
    });

    if (!extensionState.hasSeenWalkthrough()) {
      vscode.commands.executeCommand(
        'workbench.action.openWalkthrough',
        'appland.appmap#navie.walkthrough'
      );
      extensionState.setSeenWalkthrough();
    }

    context.subscriptions.push(
      vscode.authentication.onDidChangeSessions((e) => {
        if (e.provider.id !== AUTHN_PROVIDER_NAME) return;

        setTimeout(() => this.updateSignInState(), 0);
      }),
      onDidChangeEntitlement(() => setTimeout(() => this.updateSignInState(), 0))
    );
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
    // A customer ID entitles the installation outright. Every sign-in affordance — five
    // sidebar views and six walkthrough steps — hangs off the appMap.showSignIn context key
    // this feeds, so entitlement suppresses all of them without any new `when` clauses.
    if (this.context && isEntitled(this.context)) return true;

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
