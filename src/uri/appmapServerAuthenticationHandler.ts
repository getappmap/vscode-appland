import * as vscode from 'vscode';
import { RequestHandler } from './uriHandler';

export default class AppMapServerAuthenticationHandler implements RequestHandler {
  public readonly path = '/authn-appmap-server';

  constructor(
    public resolve: (session: vscode.AuthenticationSession) => void,
    public reject: () => void
  ) {}

  async handle(queryParams: URLSearchParams): Promise<void> {
    const apiKeyParam = queryParams.get('api_key');
    if (!apiKeyParam) return this.reject();

    const buffer = Buffer.from(apiKeyParam, 'base64');
    const [email] = buffer.toString('utf-8').split(':');

    this.resolve({
      id: email,
      account: { id: 'default', label: 'default' },
      scopes: [],
      accessToken: apiKeyParam,
    });
  }

  dispose(): void {
    // do nothing, we have nothing to dispose
  }
}
