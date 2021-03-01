import * as vscode from 'vscode';
import { AppMapTreeDataProvider } from './appmap/AppMapTreeDataProvider';

export default function registerTrees(): void {
  vscode.window.registerTreeDataProvider(
    'appmap.views.files',
    new AppMapTreeDataProvider()
  );
}
