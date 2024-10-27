import { Disposable } from 'vscode';

export default interface AuthenticationStrategy extends Disposable {
  getAuthnPath(ssoTarget?: string): string;
  redirectUrl(params: ReadonlyArray<[string, string]>): string | Promise<string>;
  prepareSignIn(): void;
}
