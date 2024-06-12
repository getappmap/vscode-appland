// This was previously exported within `appmapServerAuthenticationProvider.ts`, however by doing so
// it introduces dependencies which rely on transpiled content (HTML files). This works in the packaged

import * as vscode from 'vscode';
import Environment from '../configuration/environment';

// extension (because of Webpack), but fails during tests. As a quick fix, this export has been moved out.
export const AUTHN_PROVIDER_NAME = 'appmap.server';

export async function getApiKey(createIfNone: boolean): Promise<string | undefined> {
  if (!createIfNone && Environment.appMapTestApiKey) return Environment.appMapTestApiKey;

  let session: vscode.AuthenticationSession | undefined;
  try {
    session = await vscode.authentication.getSession(AUTHN_PROVIDER_NAME, ['default'], {
      createIfNone,
    });
  } catch (e) {
    // VSCode may throw a string instead of an Error, e.g., if the authentication provider is not registered in time.
    const err = e instanceof Error ? e : new Error(String(e));
    console.error(err);
  }

  return session?.accessToken;
}
