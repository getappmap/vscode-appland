/* eslint @typescript-eslint/naming-convention: 0 */
import { cwd } from 'process';
import EventEmitter from './EventEmitter';
import Terminal from './Terminal';
import type * as vscode from 'vscode';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const doNothing = (..._args: unknown[]): unknown => {
  // nop, but return a promise in case the caller is expecting one
  return Promise.resolve(undefined);
};

export const EmitOnDidChangeTerminalState = new EventEmitter<vscode.Terminal>();

export interface MockOutputChannel extends vscode.OutputChannel {
  lines: string[];
}

export function getOutputChannelLines(channel: vscode.OutputChannel): string[] {
  return (channel as MockOutputChannel).lines;
}

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

export enum ViewColumn {
  Active = -1,
  Beside = -2,
  One = 1,
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Seven = 7,
  Eight = 8,
  Nine = 9,
}

export interface MockWebviewPanel extends vscode.WebviewPanel {
  receiveMessage(message: unknown): void;
}

export const WebviewPanels: MockWebviewPanel[] = [];

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
  showOpenDialog: doNothing,
  showErrorMessage: doNothing,
  showWarningMessage: doNothing,
  showInformationMessage: doNothing,
  withProgress,
  workspaceFolders: [],
  createOutputChannel: () => {
    const lines: string[] = [];
    return {
      lines,
      append: (value: string) => {
        if (lines.length === 0) lines.push(value);
        else lines[lines.length - 1] += value;
      },
      appendLine: (line: string) => {
        lines.push(line);
      },
      clear: () => {
        lines.length = 0;
      },
      hide: doNothing,
      name: '',
      show: doNothing,
      dispose: doNothing,
    };
  },
  createWebviewPanel: (
    viewType: string,
    title: string,
    showOptions: ViewColumn | { preserveFocus?: boolean; viewColumn: ViewColumn },
    options?: vscode.WebviewPanelOptions & vscode.WebviewOptions
  ): vscode.WebviewPanel => {
    const onDidReceiveMessage = new EventEmitter<unknown>();
    const viewColumn = typeof showOptions === 'number' ? showOptions : showOptions.viewColumn;
    const panel: MockWebviewPanel = {
      viewType,
      title,
      visible: true,
      active: true,
      viewColumn,
      options: options || {},
      webview: {
        html: '',
        options: options || {},
        onDidReceiveMessage: onDidReceiveMessage.event,
        postMessage: async () => false,
        asWebviewUri: (uri: vscode.Uri) => uri,
        cspSource: 'mock-csp-source',
      },
      onDidChangeViewState: new EventEmitter<vscode.WebviewPanelOnDidChangeViewStateEvent>().event,
      onDidDispose: new EventEmitter<void>().event,
      dispose: doNothing,
      reveal: doNothing,
      receiveMessage: (msg: unknown) => onDidReceiveMessage.fire(msg),
    };
    WebviewPanels.push(panel);
    return panel;
  },
  createTerminal(options: vscode.TerminalOptions = { cwd: cwd() }) {
    return new Terminal(options);
  },
  onDidChangeTerminalState: EmitOnDidChangeTerminalState.event,
  activeTextEditor: undefined,
};
