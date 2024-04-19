/* eslint @typescript-eslint/naming-convention: 0 */
import { cwd } from 'process';
import EventEmitter from './EventEmitter';
import Terminal from './Terminal';
import type * as vscode from 'vscode';

const doNothing = () => {
  // nop
};

export const EmitOnDidChangeTerminalState = new EventEmitter<vscode.Terminal>();

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
  showInformationMessage: doNothing,
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
