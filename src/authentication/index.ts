// This was previously exported within `appmapServerAuthenticationProvider.ts`, however by doing so
// it introduces dependencies which rely on transpiled content (HTML files). This works in the packaged

import * as vscode from 'vscode';
import Environment from '../configuration/environment';

// extension (because of Webpack), but fails during tests. As a quick fix, this export has been moved out.
export const AUTHN_PROVIDER_NAME = 'appmap.server';

export async function getApiKey(
  createIfNone: boolean,
  ssoTarget?: string
): Promise<string | undefined> {
  // APPMAP_TEST_API_KEY is a test fixture, not a deployment mechanism, and deliberately
  // separate from the customer ID (see doc/organization-config.md). It short-circuits
  // vscode.authentication.getSession, whose consent prompt is blocked in test environments —
  // see withAuthenticatedUser in test/integration/util.ts. It must keep returning a value
  // *from* getApiKey, because the integration suite exercises the authenticated code paths;
  // a customer ID entitles the extension without ever standing in for a credential, so the
  // two cannot be unified without breaking that suite.
  if (!createIfNone && Environment.appMapTestApiKey) return Environment.appMapTestApiKey;

  let session: vscode.AuthenticationSession | undefined;
  try {
    const scopes = ['default'];
    if (ssoTarget) {
      scopes.push(`ssoTarget:${ssoTarget}`);
    }
    session = await vscode.authentication.getSession(AUTHN_PROVIDER_NAME, scopes, {
      createIfNone,
    });
  } catch (e) {
    // VSCode may throw a string instead of an Error, e.g., if the authentication provider is not registered in time.
    const err = e instanceof Error ? e : new Error(String(e));
    console.error(err);
  }

  return session?.accessToken;
}
