// This was previously exported within `appmapServerAuthenticationProvider.ts`, however by doing so
// it introduces dependencies which rely on transpiled content (HTML files). This works in the packaged

import * as vscode from 'vscode';
import Environment from '../configuration/environment';

// extension (because of Webpack), but fails during tests. As a quick fix, this export has been moved out.
export const AUTHN_PROVIDER_NAME = 'appmap.server';

export async function getApiKey(createIfNone: boolean): Promise<string | undefined> {
  if (!createIfNone && Environment.appMapTestApiKey) return Environment.appMapTestApiKey;

  const session = await vscode.authentication.getSession(AUTHN_PROVIDER_NAME, ['default'], {
    createIfNone,
  });
  return session?.accessToken;
}
