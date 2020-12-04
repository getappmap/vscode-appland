import * as vscode from 'vscode';
import { ScenarioProvider } from './scenarioViewer';

export function activate(context: vscode.ExtensionContext) {
	// Register our custom editor providers
	context.subscriptions.push(ScenarioProvider.register(context));
}
