import { Uri, workspace, WorkspaceFolder } from 'vscode';
import utfDecoder from '../utfDecoder';

const fs = workspace.fs;

// utility functions for analyzers

export type DependencyFinder = ((name: string) => boolean) & { filename?: string };

function wordScanner(file: Uint8Array): DependencyFinder {
  const text = utfDecoder(file);
  return (name) => {
    return new RegExp(`(\\W|^)${name}(\\W|$)`, 'mi').test(text);
  };
}

export function fileWordScanner(filename: string) {
  return (folder: WorkspaceFolder): PromiseLike<DependencyFinder> =>
    fs.readFile(Uri.joinPath(folder.uri, filename)).then((file) => {
      const scanner = wordScanner(file);
      scanner.filename = filename;
      return scanner;
    });
}
