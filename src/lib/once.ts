import * as vscode from 'vscode';

/**
 * Returns true if the given key has not been shown before, and updates the global state accordingly.
 * @param context
 * @param key
 */
export default function once(context: vscode.ExtensionContext, key: string): boolean {
  const hasBeenShown = context.globalState.get(key, false);

  if (!hasBeenShown) {
    context.globalState.update(key, true);
    return true;
  }

  return false;
}

once.reset = function (context: vscode.ExtensionContext, key: string) {
  context.globalState.update(key, undefined);
};
