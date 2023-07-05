import type * as vscode from 'vscode';
import { EmitOnDidChangeTerminalState } from './window';

export default class Terminal implements vscode.Terminal {
  private isInteractedWith = false;

  constructor(public readonly creationOptions: Readonly<vscode.TerminalOptions>) {}

  public get name(): string {
    return this.creationOptions.name ?? 'a test terminal';
  }

  public get processId(): Thenable<number | undefined> {
    return Promise.resolve(undefined);
  }

  public get exitStatus(): vscode.TerminalExitStatus | undefined {
    return undefined;
  }

  public get state(): vscode.TerminalState {
    return {
      isInteractedWith: this.isInteractedWith,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  sendText(_text: string, _addNewLine?: boolean | undefined): void {
    const wasInteractedWith = this.isInteractedWith;
    this.isInteractedWith = true;
    if (!wasInteractedWith) EmitOnDidChangeTerminalState.fire(this);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  show(_preserveFocus?: boolean | undefined): void {
    return;
  }

  hide(): void {
    return;
  }

  dispose(): void {
    return;
  }
}
