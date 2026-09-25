import * as vscode from 'vscode';
import { AUTHN_PROVIDER_NAME, getApiKey } from '../authentication';
import { isEntitled, onDidChangeEntitlement } from '../configuration/customerId';
import ExtensionState from '../configuration/extensionState';
import { DEBUG_EXCEPTION, Telemetry } from '../telemetry';
import ErrorCode from '../telemetry/definitions/errorCodes';

/**
 * Whether the sign-in UI is called for. An unset context key is a third state — not
 * determined yet — which the sidebar shows a placeholder view for.
 *
 * A boolean could not express that third state. `activationEvents` is
 * `onStartupFinished`, so the workbench paints the sidebar before this extension runs,
 * and for an unset key both `!key` and `key == false` evaluate falsy: "signed in" and
 * "we don't know yet" were indistinguishable, which is why the authenticated views used
 * to appear briefly for users who turned out to be signed out.
 *
 * Every `when` clause therefore has to compare against a value positively, `==
 * 'required'` or `== 'satisfied'`. A negated comparison would fold the undetermined
 * state back into one of the two known ones and bring that flash back.
 */
type SignInState = 'required' | 'satisfied';

export default class SignInManager {
  private static contextKeySignInState = 'appmap.signInState';
  private static state: SignInState | undefined;
  private static generation = 0;
  private static context: vscode.ExtensionContext | undefined;

  public static get signInState(): SignInState | undefined {
    return this.state;
  }

  public static async register(
    extensionState: ExtensionState,
    context: vscode.ExtensionContext
  ): Promise<void> {
    this.context = context;

    // Deliberately not awaited. vscode.authentication.getSession() waits for the
    // extension that declares the provider — this one — to finish activating, so
    // awaiting the result here deadlocks activation against itself and the sidebar stays
    // on the placeholder forever. The placeholder is there to cover this gap: it shows
    // until the state resolves, which it does shortly after activate() returns.
    void this.updateSignInState().catch(async (e) => {
      console.error('Error updating sign-in state on register():', e);
      Telemetry.sendEvent(DEBUG_EXCEPTION, {
        exception: e as Error,
        errorCode: ErrorCode.UpdateSignInStateFailure,
      });
      // Let the views through rather than leaving the sidebar on the placeholder: a Navie
      // that cannot reach the server explains itself, a sidebar stuck on "starting"
      // doesn't.
      await this.setSignInState('satisfied');
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
    if (this.state === 'satisfied') return;

    try {
      await getApiKey(true, ssoTarget);
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
    // sidebar views and six walkthrough steps — hangs off the appmap.signInState context
    // key this feeds, so entitlement suppresses all of them without any new `when` clauses.
    if (this.context && isEntitled(this.context)) return true;

    return !!(await getApiKey(false));
  }

  public static async updateSignInState(): Promise<void> {
    const generation = ++this.generation;
    const state = (await this.isUserAuthenticated()) ? 'satisfied' : 'required';

    // A check begun later has already published a fresher answer, so this one is stale and
    // would only undo it. The initial check is the likeliest to lose: getSession() doesn't
    // return until this extension has finished activating, so a refresh from a session or
    // entitlement change that arrives in the meantime resolves well before it.
    if (generation !== this.generation) return;

    await this.setSignInState(state);
  }

  private static async setSignInState(state: SignInState): Promise<void> {
    this.state = state;
    await vscode.commands.executeCommand('setContext', this.contextKeySignInState, state);
  }
}
