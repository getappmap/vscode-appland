import * as path from 'path';
import * as vscode from 'vscode';
import { getNonce } from './util';

/**
 * Provider for AppLand scenario files.
 */
export class ScenarioProvider implements vscode.CustomTextEditorProvider {

	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		const provider = new ScenarioProvider(context);
		const providerRegistration = vscode.window.registerCustomEditorProvider(ScenarioProvider.viewType, provider);
		return providerRegistration;
	}

	private static readonly viewType = 'appland.scenarioFile';

	constructor(
		private readonly context: vscode.ExtensionContext
	) { }

	/**
	 * Called when our custom editor is opened.
	 */
	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
		// Setup initial content for the webview
		webviewPanel.webview.options = {
			enableScripts: true,
		};
		webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

		function updateWebview() {
			webviewPanel.webview.postMessage({
				type: 'update',
				text: document.getText(),
			});
		}

		// Hook up event handlers so that we can synchronize the webview with the text document.
		//
		// The text document acts as our model, so we have to sync change in the document to our
		// editor and sync changes in the editor back to the document.
		// 
		// Remember that a single text document can also be shared between multiple custom
		// editors (this happens for example when you split a custom editor)
		const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
			if (e.document.uri.toString() === document.uri.toString()) {
				updateWebview();
			}
		});

		// Make sure we get rid of the listener when our editor is closed.
		webviewPanel.onDidDispose(() => {
			changeDocumentSubscription.dispose();
		});

		updateWebview();
	}

	/**
	 * Get the static html used for the editor webviews.
	 */
	private getHtmlForWebview(webview: vscode.Webview): string {
		// Local path to script and css for the webview
		const scriptUri = webview.asWebviewUri(vscode.Uri.file(
			path.join(this.context.extensionPath, 'media', 'scenario.js')
    ));
    const scriptD3Uri = webview.asWebviewUri(vscode.Uri.file(
      path.join(this.context.extensionPath, 'node_modules', 'd3', 'dist', 'd3.js')
    ));
    const scriptAppMapUri = webview.asWebviewUri(vscode.Uri.file(
      path.join(this.context.extensionPath, 'node_modules', 'd3-appmap', 'dist', 'd3-appmap.js')
    ));
  
		const styleMainUri = webview.asWebviewUri(vscode.Uri.file(
			path.join(this.context.extensionPath, 'media', 'scenario.css')
		));
		const styleAppMapUri = webview.asWebviewUri(vscode.Uri.file(
      path.join(this.context.extensionPath, 'node_modules', 'd3-appmap', 'dist', 'd3-appmap.css')
    ));

		// Use a nonce to whitelist which scripts can be run
		const nonce = getNonce();

		return /* html */`
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
				Use a content security policy to only allow loading images from https or from our extension directory,
				and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleAppMapUri}" rel="stylesheet" />
				<link href="${styleMainUri}" rel="stylesheet" />

				<title>AppLand Scenario</title>
			</head>
			<body>
        <div id="errors">
        </div>
        <div id="component-diagram">
        </div>
    
				<script nonce="${nonce}" src="${scriptD3Uri}"></script>
				<script nonce="${nonce}" src="${scriptAppMapUri}"></script>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}
	/**
	 * Try to get a current document as json text.
	 */
	private getDocumentAsJson(document: vscode.TextDocument): any {
		const text = document.getText();
		if (text.trim().length === 0) {
			return {};
		}

		try {
			return JSON.parse(text);
		} catch {
			throw new Error('Could not get document as json. Content is not valid json');
		}
	}
}
