import * as vscode from 'vscode';
import { default as ExtensionSettings } from '../configuration/extensionSettings';
import UriHandler from '../uri/uriHandler';
import AppMapServerAuthenticationHandler from '../uri/appmapServerAuthenticationHandler';
import { randomUUID } from 'crypto';
import VscodeProtocolRedirect from './authenticationStrategy/vscodeProtocolRedirect';
import LocalWebserver from './authenticationStrategy/localWebServer';
import {
  AUTHENTICATION_FAILED,
  AUTHENTICATION_SIGN_OUT,
  AUTHENTICATION_SUCCESS,
  DEBUG_EXCEPTION,
  Telemetry,
} from '../telemetry';
import ErrorCode from '../telemetry/definitions/errorCodes';
import { AUTHN_PROVIDER_NAME } from './index';
import { debuglog } from 'node:util';

const debug = debuglog('appmap-vscode:AppMapServerAuthenticationProvider');

const APPMAP_SERVER_SESSION_KEY = 'appmap.server.session';

export default class AppMapServerAuthenticationProvider implements vscode.AuthenticationProvider {
  private _onDidChangeSessions =
    new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
  readonly onDidChangeSessions = this._onDidChangeSessions.event;

  private session?: vscode.AuthenticationSession;

  static enroll(
    context: vscode.ExtensionContext,
    uriHandler: UriHandler
  ): AppMapServerAuthenticationProvider {
    const provider = new AppMapServerAuthenticationProvider(context, uriHandler);
    const registration = vscode.authentication.registerAuthenticationProvider(
      AUTHN_PROVIDER_NAME,
      'AppMap Server',
      provider,
      { supportsMultipleAccounts: false }
    );
    context.subscriptions.push(registration);
    return provider;
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

  async createSession(): Promise<vscode.AuthenticationSession> {
    this.session = await this.performSignIn();
    debug('createSession(); session %savailable', this.session ? '' : 'not ');

    if (!this.session) {
      Telemetry.sendEvent(AUTHENTICATION_FAILED);
      throw new Error('AppMap Server authentication was not completed');
    }

    this.context.secrets
      .store(APPMAP_SERVER_SESSION_KEY, JSON.stringify(this.session))
      .then(undefined, (err) => console.warn('error storing session key: %s', err));

    this._onDidChangeSessions.fire({ added: [this.session] });

    Telemetry.sendEvent(AUTHENTICATION_SUCCESS);

    return this.session;
  }

  async removeSession(): Promise<void> {
    const [session] = await this.getSessions();
    debug('removeSession(); session %savailable', this.session ? '' : 'not ');

    if (session) {
      this.session = undefined;
      this.context.secrets
        .delete(APPMAP_SERVER_SESSION_KEY)
        .then(undefined, (err) => console.warn('error removing session key: %s', err));

      this._onDidChangeSessions.fire({ removed: [session] });

      Telemetry.sendEvent(AUTHENTICATION_SIGN_OUT);
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
      const session = await vscode.window.withProgress<vscode.AuthenticationSession | undefined>(
        {
          cancellable: true,
          location: vscode.ProgressLocation.Notification,
          title: `Signing into AppMap...`,
        },
        async (_progress, token) => {
          return new Promise((resolve) => {
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
                resolve(undefined);
              }),
            ];
            token.onCancellationRequested(async () => {
              dispose(disposables);
              resolve(undefined);
            });
          });
        }
      );

      if (session) return session;
      if (index === authnStrategies.length - 1) return undefined;

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
