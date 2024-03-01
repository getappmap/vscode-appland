import * as vscode from 'vscode';
import { default as ExtensionSettings } from '../configuration/extensionSettings';
import UriHandler from '../uri/uriHandler';
import AppMapServerAuthenticationHandler from '../uri/appmapServerAuthenticationHandler';
import { randomUUID } from 'crypto';
import VscodeProtocolRedirect from './authenticationStrategy/vscodeProtocolRedirect';
import LocalWebserver from './authenticationStrategy/localWebServer';
import { DEBUG_EXCEPTION, Telemetry } from '../telemetry';
import ErrorCode from '../telemetry/definitions/errorCodes';
import { AUTHN_PROVIDER_NAME } from './index';
import { debuglog } from 'node:util';
import { LicenseKey } from '@appland/client';
import { base64UrlDecode } from '@appland/models';

const debug = debuglog('appmap-vscode:AppMapServerAuthenticationProvider');

const APPMAP_SERVER_SESSION_KEY = 'appmap.server.session';

enum AuthFailure {
  NotAuthorized = 'NotAuthorized',
  UserCanceled = 'UserCanceled',
  SignInAttempt = 'SignInAttempt',
}

export default class AppMapServerAuthenticationProvider implements vscode.AuthenticationProvider {
  // vscode.AuthenticationProvider is not Disposable, therefore listeners on this event
  // will not and apparently do not need to be disposed.
  private _onDidChangeSessions =
    new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
  readonly onDidChangeSessions = this._onDidChangeSessions.event;

  private session?: vscode.AuthenticationSession;
  private pendingLicenseKey?: string;
  public customCancellationToken = new vscode.CancellationTokenSource();

  static enroll(
    context: vscode.ExtensionContext,
    uriHandler: UriHandler
  ): AppMapServerAuthenticationProvider {
    const provider = new AppMapServerAuthenticationProvider(context, uriHandler);
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

  async enterLicenseKeyCommand(licenseKey?: string) {
    if (!licenseKey) {
      licenseKey = await vscode.window.showInputBox({
        title: `Enter your AppMap license key`,
        ignoreFocusOut: true,
      });
    }

    if (!licenseKey) return;

    if (!(await LicenseKey.check(licenseKey))) {
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

  constructor(public context: vscode.ExtensionContext, public uriHandler: UriHandler) {}

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

  async createSession(): Promise<vscode.AuthenticationSession> {
    const session = this.consumePendingLicenseKey();
    if (session) {
      this.session = session;
    } else if (!this.session) {
      this.session = await this.performSignIn();
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

  async performSignIn(): Promise<vscode.AuthenticationSession | undefined> {
    const nonce = randomUUID();
    const authnHandler = new AppMapServerAuthenticationHandler(nonce);
    const authnStrategies = [
      new VscodeProtocolRedirect(this.uriHandler, authnHandler),
      new LocalWebserver(authnHandler),
    ];

    for (const [index, authnStrategy] of authnStrategies.entries()) {
      authnStrategy.prepareSignIn();
      const redirectUri = await authnStrategy.redirectUrl([['nonce', nonce]]);
      const authnUrl = AppMapServerAuthenticationProvider.authURL(authnStrategy.authnPath, {
        redirect_url: redirectUri.toString(),
      });
      vscode.env.openExternal(authnUrl);
      const session = await vscode.window.withProgress<vscode.AuthenticationSession | AuthFailure>(
        {
          cancellable: true,
          location: vscode.ProgressLocation.Notification,
          title: `Signing into AppMap...`,
        },
        async (_progress, token) => {
          return new Promise((resolve) => {
            this.customCancellationToken = new vscode.CancellationTokenSource();

            const dispose = (disposables: vscode.Disposable[]) =>
              disposables.forEach((d) => d.dispose());

            const disposables = [
              authnHandler.onCreateSession((session) => {
                dispose(disposables);
                resolve(session);
              }),
              authnHandler.onError((exception) => {
                Telemetry.sendEvent(DEBUG_EXCEPTION, {
                  exception,
                  errorCode: ErrorCode.AuthenticationFailure,
                });
                console.warn('Failed to authenticate');
                console.warn(exception);
                dispose(disposables);
                resolve(AuthFailure.NotAuthorized);
              }),
            ];

            token.onCancellationRequested(() => {
              dispose(disposables);
              resolve(AuthFailure.UserCanceled);
            });

            this.customCancellationToken.token.onCancellationRequested(() => {
              dispose(disposables);
              resolve(AuthFailure.SignInAttempt);
            });
          });
        }
      );

      if (!Object.values(AuthFailure).includes(session as AuthFailure))
        return session as vscode.AuthenticationSession;

      if (index === authnStrategies.length - 1 || session === AuthFailure.SignInAttempt)
        return undefined;

      const tryNewStrategy = await vscode.window.showWarningMessage(
        'Having trouble logging in? Would you like to try a different method?',
        'Yes',
        'No'
      );

      if (tryNewStrategy !== 'Yes') {
        return undefined;
      }
    }
  }
}
