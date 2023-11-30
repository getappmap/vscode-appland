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

    const licenseKeyParam = queryParams.get('api_key');
    if (!licenseKeyParam) {
      this._onError.fire(new Error('missing parameter "api_key"'));
      return;
    }

    const buffer = Buffer.from(licenseKeyParam, 'base64');
    const [email] = buffer.toString('utf-8').split(':');

    this._onCreateSession.fire(
      AppMapServerAuthenticationHandler.buildSession(email, licenseKeyParam)
    );
  }

  dispose(): void {
    // do nothing, we have nothing to dispose
  }

  static buildSession(email: string, licenseKey: string): vscode.AuthenticationSession {
    return {
      id: email,
      account: { id: email, label: email },
      scopes: ['default'],
      accessToken: licenseKey,
    };
  }
}
