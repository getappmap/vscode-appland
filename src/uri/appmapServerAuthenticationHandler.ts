import * as vscode from 'vscode';

export default class AppMapServerAuthenticationHandler {
  private readonly _onCreateSession = new vscode.EventEmitter<vscode.AuthenticationSession>();
  private readonly _onError = new vscode.EventEmitter<Error>();

  public get onCreateSession(): vscode.Event<vscode.AuthenticationSession> {
    return this._onCreateSession.event;
  }

  public get onError(): vscode.Event<Error> {
    return this._onError.event;
  }

  handle(queryParams: URLSearchParams): void {
    const errorParam = queryParams.get('error');
    if (errorParam) {
      const errorDescription = queryParams.get('error_description');
      const errorMessage = errorDescription ? `${errorParam}: ${errorDescription}` : errorParam;
      this._onError.fire(new Error(errorMessage));
      return;
    }

    const licenseKeyParam = queryParams.get('code') || queryParams.get('api_key');
    if (!licenseKeyParam) {
      this._onError.fire(new Error('missing authentication key'));
      return;
    }

    const buffer = Buffer.from(licenseKeyParam, 'base64');
    const [email] = buffer.toString('utf-8').split(':');

    this._onCreateSession.fire(
      AppMapServerAuthenticationHandler.buildSession(email, licenseKeyParam)
    );
  }

  dispose(): void {
    this._onCreateSession.dispose();
    this._onError.dispose();
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
