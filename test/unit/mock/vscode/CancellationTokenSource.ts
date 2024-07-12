/* eslint-disable @typescript-eslint/no-empty-function */
import type vscode from 'vscode';

export default class CancellationTokenSource implements vscode.CancellationTokenSource {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  token: any;
  cancel(): void {}
  dispose(): void {}
}
