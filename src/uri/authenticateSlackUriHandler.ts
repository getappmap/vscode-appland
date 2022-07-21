import * as vscode from 'vscode';
import { createSessionCommand } from '../authentication/authenticationProvider';
import { RequestHandler } from './uriHandler';

const PROVIDER = 'slack';

export default class AuthenticateSlackUriHandler implements RequestHandler {
  public readonly path = '/authenticate';
  public readonly params = { provider: PROVIDER };

  handle(queryParams: URLSearchParams): void {
    const token = queryParams.get('token');
    const email = queryParams.get('email');
    const id = queryParams.get('id');
    if (!token || !email || !id) {
      return;
    }

    const command = createSessionCommand(PROVIDER);
    vscode.commands.executeCommand(command, {
      id: id,
      accessToken: token,
      account: { id: id, label: email },
      scopes: [],
    });
  }

  dispose(): void {
    // do nothing, we have nothing to dispose
  }
}
