import * as vscode from 'vscode';
import AuthenticationStrategy from '.';
import extensionSettings from '../../configuration/extensionSettings';
import AppMapServerAuthenticationHandler from '../../uri/appmapServerAuthenticationHandler';
import UriHandler from '../../uri/uriHandler';

export default class VscodeProtocolRedirect implements AuthenticationStrategy {
  public get authnPath(): string {
    return 'authn_provider/vscode';
  }

  constructor(
    private readonly uriHandler: UriHandler,
    private readonly authnHandler: AppMapServerAuthenticationHandler
  ) {}

  async redirectUrl(params: ReadonlyArray<[string, string]>): Promise<string> {
    const query = params
      .reduce((query, [k, v]) => {
        query.append(k, v);
        return query;
      }, new URLSearchParams())
      .toString();

    const uri = vscode.Uri.parse(`vscode://appland.appmap/authn-appmap-server`).with({ query });
    const externalUri = await vscode.env.asExternalUri(uri);
    return externalUri.toString();
  }

  getAuthUrl(queryParams?: Record<string, string>): vscode.Uri {
    const url = new URL('authn_provider/vscode', extensionSettings.appMapServerURL.toString());
    if (queryParams) {
      Object.entries(queryParams).forEach(([k, v]) => url.searchParams.set(k, v));
    }
    return vscode.Uri.parse(url.toString());
  }

  prepareSignIn(): void {
    this.uriHandler.registerHandler(this.authnHandler);
  }

  dispose(): void {
    // do nothing
    this.uriHandler.unregisterHandler(this.authnHandler);
  }
}
