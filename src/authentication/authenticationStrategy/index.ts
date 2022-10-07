import { Disposable } from 'vscode';

export default interface AuthenticationStrategy extends Disposable {
  authnPath: string;
  redirectUrl(params: ReadonlyArray<[string, string]>): string | Promise<string>;
  prepareSignIn(): void | Promise<void>;
}
