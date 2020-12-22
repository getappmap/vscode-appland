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

		function openFile(uri: vscode.Uri, lineNumber: number) {
			const showOptions = {
				viewColumn: vscode.ViewColumn.Beside,
				selection: new vscode.Range(new vscode.Position(lineNumber - 1, 0), new vscode.Position(lineNumber - 1, 0))
			}
			vscode.commands.executeCommand('vscode.open', uri, showOptions)
		}

		function viewSource(location: string) {
			const tokens = location.split(':', 2);
			const path = tokens[0];
			const lineNumberStr = tokens[1];
			let lineNumber = 1;
			if ( lineNumberStr ) {
				lineNumber = Number.parseInt(lineNumberStr, 10);
			}

			vscode.workspace.findFiles(path).then((uris) => {
				if (uris.length === 0) {
					return;
				} else if (uris.length === 1) {
					openFile(uris[0], lineNumber);
				} else {
					const options: vscode.QuickPickOptions = {
						canPickMany: false,
						placeHolder: 'Choose file to open'
					};
					vscode.window.showQuickPick(uris.map(uri => uri.toString()), options).then((fileName) => {
						if ( !fileName ) {
							return false;
						}
						openFile(vscode.Uri.parse(fileName), lineNumber);
					});
				}
			});

		}

		// Handle messages from the webview
		webviewPanel.webview.onDidReceiveMessage((message) => {
			switch (message.command) {
				case 'viewSource':
					viewSource(message.text);
					break;
			}
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
		const scriptBootstrapUri = webview.asWebviewUri(vscode.Uri.file(
			path.join(this.context.extensionPath, 'node_modules', 'bootstrap', 'dist', 'js', 'bootstrap.bundle.js')
		));
		const scriptBootstrapAutocompleteUri = webview.asWebviewUri(vscode.Uri.file(
			path.join(this.context.extensionPath, 'node_modules', 'bootstrap-autocomplete', 'dist', 'latest', 'bootstrap-autocomplete.js')
		));
		const scriptJQuery = webview.asWebviewUri(vscode.Uri.file(
			path.join(this.context.extensionPath, 'node_modules', 'jquery', 'dist', 'jquery.js')
		));
		const scriptAppMapUri = webview.asWebviewUri(vscode.Uri.file(
			path.join(this.context.extensionPath, 'node_modules', '@appland', 'diagrams', 'dist', '@appland', 'diagrams.js')
		));
		const scriptModelsUri = webview.asWebviewUri(vscode.Uri.file(
			path.join(this.context.extensionPath, 'node_modules', '@appland', 'models', 'dist', 'index.js')
		));

		const styleBootstrapUri = webview.asWebviewUri(vscode.Uri.file(
			path.join(this.context.extensionPath, 'node_modules', 'bootstrap', 'dist', 'css', 'bootstrap.css')
		));
		const styleMainUri = webview.asWebviewUri(vscode.Uri.file(
			path.join(this.context.extensionPath, 'out', 'extension.css')
		));
		const styleAppMapUri = webview.asWebviewUri(vscode.Uri.file(
			path.join(this.context.extensionPath, 'node_modules', '@appland', 'diagrams', 'dist', '@appland', 'diagrams.css')
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
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} 'self' data: ; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleBootstrapUri}" rel="stylesheet" />
				<link href="${styleAppMapUri}" rel="stylesheet" />
				<link href="${styleMainUri}" rel="stylesheet" />

				<title>AppLand Scenario</title>
			</head>
			<body>
				<div id="appland">
					<div class="sidebar">
						<div id="component-details" class="selection-details">
							<h3 class="block-heading">Component details</h3>
							<div class="content">
							</div>
						</div>
					</div>
					<div id="diagram">
						<div id="errors"></div>
						<div id="filter">
							<h5 class="block-heading">Filters</h5>
							<div id="filter-input">
								<input type="text" size="80" placeholder="Filter the diagram by package, class or function" autocomplete="off"></input>
							</div>
						</div>
						<div class="tabs-wrap">
							<ul id="diagram-tabs" class="nav nav-tabs" role="tablist">
								<li class="nav-item"><a class="nav-link active" id="component-diagram-content-tab" data-toggle="tab" href="#component-diagram-content" role="tab" aria-selected="true">Components</a></li>
								<li class="nav-item"><a class="nav-link" id="event-diagram-content-tab" data-toggle="tab" href="#event-diagram-content" role="tab">Events</a></li>
							</ul>
							<div id="diagram-tab-content" class="tab-content">
								<div id="component-diagram-content" class="diagram-content tab-pane fade show active" role="tabpanel" aria-labeled-by="component-diagram-content-tab">
									<div class="diagram-wrapper">
										<div id="component-diagram" class="diagram">
										</div>
									</div>
								</div>
								<div id="event-diagram-content" class="diagram-content tab-pane fade" role="tabpanel" aria-labeled-by="event-diagram-content-tab">
									<div class="diagram-wrapper">
										<div id="event-details" class="selection-details">
											<div class="content">
											</div>
										</div>
										<div id="event-diagram" class="diagram">
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
					
				</div>
        
    
				<script nonce="${nonce}" src="${scriptD3Uri}"></script>
				<script nonce="${nonce}" src="${scriptJQuery}"></script>
				<script nonce="${nonce}" src="${scriptBootstrapUri}"></script>
				<script nonce="${nonce}" src="${scriptBootstrapAutocompleteUri}"></script>
				<script nonce="${nonce}" src="${scriptModelsUri}"></script>
				<script nonce="${nonce}" src="${scriptAppMapUri}"></script>
				<script nonce="${nonce}" type="module" src="${scriptUri}"></script>
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
