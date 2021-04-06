import * as vscode from 'vscode';
import { DatabaseUpdater } from './databaseUpdater';
import { ScenarioProvider } from './scenarioViewer';
import Telemetry from './telemetry';

export function activate(context: vscode.ExtensionContext): void {
  // Register our custom editor providers
  Telemetry.register(context);
  ScenarioProvider.register(context);
  DatabaseUpdater.register(context);
}
