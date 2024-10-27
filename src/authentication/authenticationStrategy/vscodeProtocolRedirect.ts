import * as vscode from 'vscode';
import AuthenticationStrategy from '.';
import AppMapServerAuthenticationHandler from '../../uri/appmapServerAuthenticationHandler';
import UriHandler from '../../uri/uriHandler';

export default class VscodeProtocolRedirect implements AuthenticationStrategy {
  public getAuthnPath(ssoTarget?: string): string {
    let path = 'authn_provider/vscode';
    if (ssoTarget) {
      path += `?ssoTarget=${ssoTarget}`;
    }
    return path;
  }

  constructor(
    private readonly uriHandler: UriHandler,
    private readonly authnHandler: AppMapServerAuthenticationHandler
  ) {}

  async redirectUrl(params: ReadonlyArray<[string, string]>): Promise<string> {
    const queryParams = params.reduce((query, [k, v]) => {
      query.append(k, v);
      return query;
    }, new URLSearchParams());
    const query = queryParams.toString();

    const uri = vscode.Uri.parse(
      `${vscode.env.uriScheme}://appland.appmap/authn-appmap-server`
    ).with({ query });
    const externalUri = await vscode.env.asExternalUri(uri);
    return externalUri.toString();
  }

  prepareSignIn(): void {
    this.uriHandler.registerHandler(this.authnHandler);
  }

  dispose(): void {
    // do nothing
    this.uriHandler.unregisterHandler(this.authnHandler);
  }
}
