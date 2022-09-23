import * as vscode from 'vscode';
import { default as ExtensionSettings } from '../configuration/extensionSettings';
import UriHandler from '../uri/uriHandler';
import AppMapServerAuthenticationHandler from '../uri/appmapServerAuthenticationHandler';

const APPMAP_SERVER_SESSION_KEY = 'appmap.server.session';

export default class AppMapServerAuthenticationProvider implements vscode.AuthenticationProvider {
  private _onDidChangeSessions = new vscode.EventEmitter<
    vscode.AuthenticationProviderAuthenticationSessionsChangeEvent
  >();
  readonly onDidChangeSessions = this._onDidChangeSessions.event;

  static enroll(
    context: vscode.ExtensionContext,
    uriHandler: UriHandler
  ): AppMapServerAuthenticationProvider {
    const provider = new AppMapServerAuthenticationProvider(context, uriHandler);
    const registration = vscode.authentication.registerAuthenticationProvider(
      'appmap.server',
      'AppMap Server',
      provider,
      { supportsMultipleAccounts: false }
    );
    context.subscriptions.push(registration);
    return provider;
  }

  static get authURL(): vscode.Uri {
    return vscode.Uri.joinPath(ExtensionSettings.appMapServerURL(), 'authn_provider', 'vscode');
  }

  constructor(public context: vscode.ExtensionContext, public uriHandler: UriHandler) {}

  async getSessions(): Promise<vscode.AuthenticationSession[]> {
    const session = await this.context.secrets.get(APPMAP_SERVER_SESSION_KEY);
    if (!session) return [];

    return [JSON.parse(session)];
  }

  async createSession(): Promise<vscode.AuthenticationSession> {
    const session = await this.performSignIn();
    if (!session) {
      throw new Error('AppMap Server authentication was not completed');
    }

    this.context.secrets.store(APPMAP_SERVER_SESSION_KEY, JSON.stringify(session));

    this._onDidChangeSessions.fire({ added: [session] });

    return session;
  }

  async removeSession(): Promise<void> {
    const session = await this.context.secrets.get(APPMAP_SERVER_SESSION_KEY);
    if (session) {
      this.context.secrets.delete(APPMAP_SERVER_SESSION_KEY);

      this._onDidChangeSessions.fire({ removed: [JSON.parse(session)] });
    }
    return;
  }

  private async performSignIn(): Promise<vscode.AuthenticationSession | undefined> {
    let appMapServerAuthenticationHandler: AppMapServerAuthenticationHandler | undefined;

    const unregisterHandler = () => {
      if (appMapServerAuthenticationHandler)
        this.uriHandler.unregisterHandler(appMapServerAuthenticationHandler);
    };

    return new Promise<vscode.AuthenticationSession | undefined>((resolve, reject) => {
      appMapServerAuthenticationHandler = new AppMapServerAuthenticationHandler(resolve, reject);
      this.uriHandler.registerHandler(appMapServerAuthenticationHandler);

      vscode.env.openExternal(AppMapServerAuthenticationProvider.authURL);
    }).finally(unregisterHandler);
  }
}
