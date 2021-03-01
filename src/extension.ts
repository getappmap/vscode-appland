import * as vscode from 'vscode';
import { DatabaseUpdater } from './databaseUpdater';
import { ScenarioProvider } from './scenarioViewer';
import registerTrees from './tree';

export function activate(context: vscode.ExtensionContext): void {
  // Register our custom editor providers
  ScenarioProvider.register(context);
  DatabaseUpdater.register(context);
  registerTrees();
}
