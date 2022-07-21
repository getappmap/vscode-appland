import * as vscode from 'vscode';
import SecretSessionStore from './secretSessionStore';

interface AuthenticationProviderEvent {
  provider: string;
}

type AuthenticationProviderOptions = {
  // authenticationHandler: AuthenticationHandler<T>;
  provider: string;
  label: string;
  authUrl: string;
  context: vscode.ExtensionContext;
  // createSession: (
  //   authResponse: T,
  //   scopes: readonly string[]
  // ) => vscode.AuthenticationSession | Promise<vscode.AuthenticationSession>;
  authBeginMessage?: () => string | Promise<string>;
  authSuccessMessage?: (session: vscode.AuthenticationSession) => string | Promise<string>;
};

export function createSessionCommand(provider: string): string {
  return `appmap.${provider}.authenticationCallback`;
}

export default class AuthenticationProvider implements vscode.AuthenticationProvider {
  private _onDidChangeSessions = new vscode.EventEmitter<
    vscode.AuthenticationProviderAuthenticationSessionsChangeEvent
  >();
  readonly onDidChangeSessions = this._onDidChangeSessions.event;
  protected store: SecretSessionStore;
  protected authCancellation?: vscode.CancellationToken;

  constructor(protected readonly options: AuthenticationProviderOptions) {
    this.store = new SecretSessionStore(this.options.provider, this.options.context);
    const command = vscode.commands.registerCommand(
      `appmap.${this.options.provider}.performSignIn`,
      () => this.createSession()
    );

    this.options.context.subscriptions.push(command);
  }

  private async authBeginMessage(): Promise<string> {
    if (this.options.authBeginMessage) {
      return await this.options.authBeginMessage();
    }
    return `Signing into ${this.options.label}...`;
  }

  private async authSuccessMessage(session: vscode.AuthenticationSession): Promise<string> {
    if (this.options.authSuccessMessage) {
      return await this.options.authSuccessMessage(session);
    }
    return `Successfully signed in to ${this.options.label} as ${session.account.label}.`;
  }

  private performSignIn(): Thenable<vscode.AuthenticationSession | undefined> {
    return vscode.window.withProgress(
      {
        cancellable: true,
        location: vscode.ProgressLocation.Notification,
        title: 'AppMap',
      },
      async (progress, token) => {
        const message = await this.authBeginMessage();
        return new Promise((resolve) => {
          progress.report({ message });

          const commandId = createSessionCommand(this.options.provider);
          const command = vscode.commands.registerCommand(
            commandId,
            (session: vscode.AuthenticationSession | undefined) => {
              command.dispose();
              resolve(session);
            }
          );

          token.onCancellationRequested(() => {
            command.dispose();
            resolve(undefined);
          });
        });
      }
    );
  }

  async getSessions(): Promise<readonly vscode.AuthenticationSession[]> {
    return this.store.sessions();
  }

  async createSession(): Promise<vscode.AuthenticationSession> {
    const callbackUri = await vscode.env.asExternalUri(
      vscode.Uri.parse(`${vscode.env.uriScheme}://appland.appmap/authenticate`)
    );

    const authUrl = vscode.Uri.parse(
      `${this.options.authUrl}?${callbackUri.query}&protocol=${vscode.env.uriScheme}`
    );
    const uri = await vscode.env.asExternalUri(authUrl);
    vscode.env.openExternal(uri);

    const session = await this.performSignIn();
    if (!session) {
      throw new Error('authentication cancelled');
    }

    await this.store.add(session);

    const message = await this.authSuccessMessage(session);
    vscode.window.showInformationMessage(message);
    this._onDidChangeSessions.fire({});

    return session;
  }

  async removeSession(sessionId: string): Promise<void> {
    this.store.delete(sessionId);
    this._onDidChangeSessions.fire({});
  }
}
