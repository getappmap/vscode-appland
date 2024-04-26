import vscode from 'vscode';

// this is in a separate file to avoid circular dependencies

export const OutputChannel = vscode.window.createOutputChannel('AppMap: Assets', 'log');

function log(message: string, level: 'INFO' | 'ERROR' | 'WARN' = 'INFO') {
  OutputChannel.appendLine(`${new Date().toLocaleString()} ${level.padEnd(5, ' ')} ${message}`);
}

export function info(message: string) {
  log(message, 'INFO');
}

export function error(message: string) {
  log(message, 'ERROR');
}

export function warning(message: string) {
  log(message, 'WARN');
}
