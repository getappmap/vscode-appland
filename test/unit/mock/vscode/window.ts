/* eslint @typescript-eslint/naming-convention: 0 */
import { cwd } from 'process';
import EventEmitter from './EventEmitter';
import Terminal from './Terminal';
import type * as vscode from 'vscode';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const doNothing = (..._args: unknown[]) => {
  // nop
};

export const EmitOnDidChangeTerminalState = new EventEmitter<vscode.Terminal>();

function withProgress<R>(
  options: vscode.ProgressOptions,
  task: (
    progress: vscode.Progress<{
      /**
       * A progress message that represents a chunk of work
       */
      message?: string;
      /**
       * An increment for discrete progress. Increments will be summed up until 100% is reached
       */
      increment?: number;
    }>,
    token: vscode.CancellationToken
  ) => Thenable<R>
): Thenable<R> {
  const cancelEvent = new EventEmitter();
  return task(
    { report: doNothing },
    { isCancellationRequested: false, onCancellationRequested: cancelEvent.event }
  );
}

export default {
  createStatusBarItem() {
    return {
      show() {
        return '';
      },
    };
  },
  showInputBox() {
    return '';
  },
  showQuickPick: doNothing,
  showErrorMessage: doNothing,
  showWarningMessage: doNothing,
  showInformationMessage: doNothing,
  withProgress,
  workspaceFolders: [],
  createOutputChannel: () => ({
    append: doNothing,
    appendLine: doNothing,
    clear: doNothing,
    hide: doNothing,
    name: '',
    show: doNothing,
    dispose: doNothing,
  }),
  createTerminal(options: vscode.TerminalOptions = { cwd: cwd() }) {
    return new Terminal(options);
  },
  onDidChangeTerminalState: EmitOnDidChangeTerminalState.event,
  activeTextEditor: undefined,
};
