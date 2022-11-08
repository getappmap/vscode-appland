import * as vscode from 'vscode';
import { RequestHandler } from './uriHandler';

export default class AppMapServerAuthenticationHandler implements RequestHandler {
  public readonly path = '/authn-appmap-server';
  private readonly _onCreateSession = new vscode.EventEmitter<vscode.AuthenticationSession>();
  private readonly _onError = new vscode.EventEmitter<Error>();

  public get onCreateSession(): vscode.Event<vscode.AuthenticationSession> {
    return this._onCreateSession.event;
  }

  public get onError(): vscode.Event<Error> {
    return this._onError.event;
  }

  constructor(private readonly nonce: string) {}

  async handle(queryParams: URLSearchParams): Promise<void> {
    const nonce = queryParams.get('nonce');
    if (nonce !== this.nonce) {
      this._onError.fire(new Error('nonce mismatch'));
      return;
    }

    const apiKeyParam = queryParams.get('code');
    if (!apiKeyParam) {
      this._onError.fire(new Error('missing parameter "code"'));
      return;
    }

    const buffer = Buffer.from(apiKeyParam, 'base64');
    const [email] = buffer.toString('utf-8').split(':');

    this._onCreateSession.fire({
      id: email,
      account: { id: email, label: email },
      scopes: ['default'],
      accessToken: apiKeyParam,
    });
  }

  dispose(): void {
    // do nothing, we have nothing to dispose
  }
}
