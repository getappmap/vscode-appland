/* eslint @typescript-eslint/no-unused-vars: 0 */

// Mirrors vscode.commands.executeCommand(command: string, ...rest: any[]): Thenable<T>.
// The parameters are declared so that stubs of it carry a usable argument tuple, and callers
// can assert on the command id and its arguments.
export default {
  executeCommand(_command: string, ..._rest: unknown[]): Promise<unknown> {
    return Promise.resolve(undefined);
  },
  registerCommand() {
    return {
      dispose: () => {
        /* no-op */
      },
    };
  },
};
