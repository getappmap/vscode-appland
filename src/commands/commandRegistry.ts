import * as vscode from 'vscode';

type WaitAliasOptions = {
  // The name of the command to be registered
  command: string;

  // The target command to wait for
  target: string;

  // The message to display when the target command is not yet ready
  message?: string;

  // Whether the command is cancellable while waiting
  cancellable?: boolean;
};

// This class is a wrapper around the vscode.commands API. It allows us to register commands and
// fire an event when a command is registered. This is useful for testing, as it allows us to
// wait for a command to be registered before running a test.
export default class CommandRegistry {
  private static context?: vscode.ExtensionContext;
  private static readonly _onCommandRegistered = new vscode.EventEmitter<string>();
  public static readonly onCommandRegistered = CommandRegistry._onCommandRegistered.event;

  public static setContext(context: vscode.ExtensionContext): typeof CommandRegistry {
    CommandRegistry.context = context;
    context.subscriptions.push(this._onCommandRegistered);
    return this;
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  public static registerCommand(
    command: string,
    callback: (...args: any[]) => any,
    thisArg?: any
  ): vscode.Disposable {
    if (!CommandRegistry.context) {
      throw new Error('CommandRegistry.context is not set');
    }

    const disposable = vscode.commands.registerCommand(command, callback, thisArg);
    CommandRegistry._onCommandRegistered.fire(command);
    return disposable;
  }

  // Waits for a command to become registered.
  public static async commandReady(command: string): Promise<void> {
    const commands = await vscode.commands.getCommands(true);
    if (commands.includes(command)) {
      return;
    }

    return new Promise((resolve) => {
      const disposable = this.onCommandRegistered((registeredCommand) => {
        if (registeredCommand === command) {
          disposable.dispose();
          resolve();
        }
      });
    });
  }

  // A wait alias is a command that waits for another command to be registered before executing.
  // This is useful both for testing and UX, as it allows for a command to be run before it is registered.
  // Users will receive a status message while the command is pending.
  public static addWaitAlias(options: WaitAliasOptions): typeof CommandRegistry {
    if (!this.context) {
      throw new Error('CommandRegistry.context is not set');
    }

    const disposable = vscode.commands.registerCommand(options.command, async (...args: any[]) => {
      const commands = await vscode.commands.getCommands(true);
      if (commands.includes(options.target)) {
        return vscode.commands.executeCommand(options.target, args);
      }

      return vscode.window.withProgress(
        {
          cancellable: options.cancellable,
          location: vscode.ProgressLocation.Notification,
          title: options.message || 'AppMap: Waiting for command to be ready...',
        },
        (_, token) => {
          return new Promise((resolve) => {
            let disposable: vscode.Disposable | undefined;
            const cleanup = () => {
              if (disposable) {
                disposable.dispose();
                disposable = undefined;
              }
            };

            disposable = this.onCommandRegistered((command) => {
              if (command === options.target) {
                cleanup();
                resolve(vscode.commands.executeCommand(options.target, args));
              }
            });

            token.onCancellationRequested(() => {
              cleanup();
              resolve(Promise.resolve());
            });
          });
        }
      );
    });

    this.context.subscriptions.push(disposable);

    return this;
  }

  public static dispose() {
    CommandRegistry._onCommandRegistered.dispose();
  }
}
