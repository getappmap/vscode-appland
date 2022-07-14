import * as vscode from 'vscode';
import { createSessionCommand } from '../authentication/authenticationProvider';
import { RequestHandler } from './uriHandler';

const PROVIDER = 'appland';

export default class AuthenticateAppLandUriHandler implements RequestHandler {
  public readonly path = '/authenticate';
  public readonly params = { provider: PROVIDER };

  constructor(protected readonly context: vscode.ExtensionContext) {}

  handle(queryParams: URLSearchParams): void {
    const apiKey = queryParams.get('api_key');
    if (!apiKey) {
      return;
    }

    const buffer = Buffer.from(apiKey, 'base64');
    const email = buffer.toString('utf-8');
    const command = createSessionCommand(PROVIDER);
    vscode.commands.executeCommand(command, {
      id: email,
      accessToken: apiKey,
      account: { id: email, label: email },
      scopes: [],
    });
  }

  dispose(): void {
    // do nothing, we have nothing to dispose
  }
}
