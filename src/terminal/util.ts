import { PathLike } from 'fs';
import vscode from 'vscode';

export function findTerminal(name: string): vscode.Terminal | undefined {
  return vscode.window.terminals.find((t) => t.name === name);
}

export function closeTerminal(name: string): void {
  const terminal = findTerminal(name);
  terminal?.dispose();
}

export function createTerminal(name: string, cwd: PathLike): vscode.Terminal {
  closeTerminal(name);

  const terminalOptions = {
    name,
    cwd: cwd as string,
  };
  console.log(terminalOptions);
  return vscode.window.createTerminal(terminalOptions);
}
