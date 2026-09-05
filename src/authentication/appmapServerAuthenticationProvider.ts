import * as vscode from 'vscode';
import { default as ExtensionSettings } from '../configuration/extensionSettings';
import AppMapServerAuthenticationHandler from '../uri/appmapServerAuthenticationHandler';
import LocalWebserver from './authenticationStrategy/localWebServer';
import { DEBUG_EXCEPTION, Telemetry } from '../telemetry';
import ErrorCode from '../telemetry/definitions/errorCodes';
import { AUTHN_PROVIDER_NAME } from './index';
import { debuglog } from 'node:util';
import { LicenseKey } from '@appland/client';
import { base64UrlDecode } from '@appland/models';

const debug = debuglog('appmap-vscode:AppMapServerAuthenticationProvider');

const APPMAP_SERVER_SESSION_KEY = 'appmap.server.session';

export default class AppMapServerAuthenticationProvider implements vscode.AuthenticationProvider {
  // vscode.AuthenticationProvider is not Disposable, therefore listeners on this event
  // will not and apparently do not need to be disposed.
  private _onDidChangeSessions =
    new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
  readonly onDidChangeSessions = this._onDidChangeSessions.event;

  private session?: vscode.AuthenticationSession;
  private pendingLicenseKey?: string;
  private activeCancellationTokenSource?: vscode.CancellationTokenSource;

  public cancel(): void {
    this.activeCancellationTokenSource?.cancel();
  }

  static enroll(context: vscode.ExtensionContext): AppMapServerAuthenticationProvider {
    const provider = new AppMapServerAuthenticationProvider(context);
    const registration = vscode.authentication.registerAuthenticationProvider(
      AUTHN_PROVIDER_NAME,
      'AppMap',
      provider,
      { supportsMultipleAccounts: false }
    );
    context.subscriptions.push(registration);
    context.subscriptions.push(
      vscode.commands.registerCommand('appmap.enterLicenseKey', async (licenseKey?: string) => {
        return provider.enterLicenseKeyCommand(licenseKey);
      })
    );
    return provider;
  }

  async enterLicenseKeyCommand(licenseKey?: string, assumeValid = false): Promise<void> {
    if (!licenseKey) {
      licenseKey = await vscode.window.showInputBox({
        title: `Enter your AppMap license key`,
        ignoreFocusOut: true,
      });
    }

    if (!licenseKey) return;

    // Only check validity if the license key is coming from user input.
    // This is to avoid proxy issues — sometimes the embedded chrome
    // will be able to connect to AppMap server, but the extension cannot.
    if (!(assumeValid || (await LicenseKey.check(licenseKey)))) {
      vscode.window.showErrorMessage('Invalid license key');
      return;
    }

    this.pendingLicenseKey = licenseKey;

    // This is required to ask the user to authorize the extension to access their account.
    await vscode.authentication.getSession(AUTHN_PROVIDER_NAME, ['default'], {
      createIfNone: true,
    });
  }

  static authURL(authnPath: string, queryParams?: Record<string, string>): vscode.Uri {
    const url = new URL(authnPath, ExtensionSettings.appMapServerURL.toString());
    if (!queryParams) queryParams = {};
    queryParams.azure_user_id = vscode.env.machineId;

    Object.entries(queryParams).forEach(([k, v]) => url.searchParams.set(k, v));

    return vscode.Uri.parse(url.toString());
  }

  constructor(public context: vscode.ExtensionContext) {}

  async getSessions(): Promise<vscode.AuthenticationSession[]> {
    if (!this.session)
      try {
        const sessionJson = await this.context.secrets.get(APPMAP_SERVER_SESSION_KEY);
        if (sessionJson) this.session = JSON.parse(sessionJson);
      } catch (err) {
        console.warn('error retrieving session key: %s', err);
      }

    return this.session ? [this.session] : [];
  }

  async storeSession(): Promise<void> {
    try {
      await this.context.secrets.store(APPMAP_SERVER_SESSION_KEY, JSON.stringify(this.session));
    } catch (err) {
      console.warn('error storing session key: %s', err);
    }
  }

  private consumePendingLicenseKey(): vscode.AuthenticationSession | undefined {
    if (this.pendingLicenseKey) {
      const licenseKey = this.pendingLicenseKey;
      this.pendingLicenseKey = undefined;

      const decoded = base64UrlDecode(licenseKey);
      const tokens = decoded.split(':');
      const email = tokens.slice(0, tokens.length - 1).join(':');
      return AppMapServerAuthenticationHandler.buildSession(email, licenseKey);
    }
  }

  async createSession(scopes: string[]): Promise<vscode.AuthenticationSession> {
    const session = this.consumePendingLicenseKey();
    if (session) {
      this.session = session;
    } else if (!this.session) {
      this.session = await this.performSignIn(scopes);
      debug('createSession(); session %savailable', this.session ? '' : 'not ');
    }

    if (!this.session) throw new Error('AppMap authentication was not completed');

    await this.storeSession();

    this._onDidChangeSessions.fire({
      added: [this.session],
      removed: [],
      changed: [],
    });

    return this.session;
  }

  async removeSession(): Promise<void> {
    const [session] = await this.getSessions();
    debug('removeSession(); session %savailable', this.session ? '' : 'not ');

    if (session) {
      this.session = undefined;
      try {
        await this.context.secrets.delete(APPMAP_SERVER_SESSION_KEY);
        this._onDidChangeSessions.fire({ removed: [session], added: [], changed: [] });
      } catch (err) {
        console.warn('error removing session key: %s', err);
      }
    }

    return;
  }

  async performSignIn(scopes: string[]): Promise<vscode.AuthenticationSession | undefined> {
    const localWebserver = new LocalWebserver();
    const authnHandler = new AppMapServerAuthenticationHandler();
    const disposables: vscode.Disposable[] = [localWebserver, authnHandler];

    try {
      const ssoTarget: string | undefined = scopes
        .find((s) => s.startsWith('ssoTarget:'))
        ?.split(':')[1];

      await localWebserver.prepareSignIn((p) => authnHandler.handle(p));
      const localUrl = localWebserver.localUrl;
      if (!localUrl) {
        throw new Error('Local server URL is not available');
      }

      const externalUri = await vscode.env.asExternalUri(vscode.Uri.parse(localUrl));

      const queryParams: Record<string, string> = {
        redirect_url: externalUri.toString(),
      };
      if (ssoTarget) {
        queryParams.ssoTarget = ssoTarget;
      }

      const authnUrl = AppMapServerAuthenticationProvider.authURL('authn_provider', queryParams);
      vscode.env.openExternal(authnUrl);
      const session = await vscode.window.withProgress<vscode.AuthenticationSession | undefined>(
        {
          cancellable: true,
          location: vscode.ProgressLocation.Notification,
          title: `Signing into AppMap...`,
        },
        async (_progress, token) => {
          return new Promise((resolve, reject) => {
            const cancellationTokenSource = new vscode.CancellationTokenSource();
            this.activeCancellationTokenSource = cancellationTokenSource;

            disposables.push(
              cancellationTokenSource,
              authnHandler.onCreateSession((session) => {
                resolve(session);
              }),
              authnHandler.onError((exception) => {
                Telemetry.sendEvent(DEBUG_EXCEPTION, {
                  exception,
                  errorCode: ErrorCode.AuthenticationFailure,
                });
                console.warn('Failed to authenticate');
                console.warn(exception);
                reject(exception);
              }),
              token.onCancellationRequested(() => {
                resolve(undefined);
              }),
              cancellationTokenSource.token.onCancellationRequested(() => {
                resolve(undefined);
              })
            );
          });
        }
      );

      return session;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`AppMap sign-in failed: ${message}`);
      return undefined;
    } finally {
      disposables.forEach((d) => d.dispose());
      this.activeCancellationTokenSource = undefined;
    }
  }
}
