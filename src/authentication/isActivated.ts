import * as vscode from 'vscode';
import { getApiKey } from '.';
import { isEntitled } from '../configuration/customerId';

/**
 * Whether AppMap is activated for this installation: the user has signed in, or a customer ID
 * entitles them.
 *
 * This is the condition deciding whether the language services may run and whether Navie is
 * usable, so it lives in one place rather than being spelled out at each site.
 *
 * Deliberately its own module rather than part of `./index`: calls between functions declared
 * in the same module compile to direct references, which `Sinon.stub(authentication,
 * 'getApiKey')` cannot intercept — several suites rely on stubbing it. Across a module
 * boundary the call goes through the exports object and the stub is honored.
 */
export default async function isActivated(context: vscode.ExtensionContext): Promise<boolean> {
  // Entitlement first, so an entitled user never reaches getApiKey on hot paths.
  return isEntitled(context) || Boolean(await getApiKey(false));
}
