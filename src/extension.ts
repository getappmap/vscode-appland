import * as vscode from 'vscode';
import { ScenarioProvider } from './scenarioViewer';
import './scss/appland.scss';

export function activate(context: vscode.ExtensionContext) {
	// Register our custom editor providers
	context.subscriptions.push(ScenarioProvider.register(context));
}
