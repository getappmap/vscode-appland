// @ts-check

// Script run within the webview itself.
(function () {
	// Get a reference to the VS Code webview api.
	// We use this API to post messages back to our extension.

	// @ts-ignore
  const vscode = acquireVsCodeApi();

  const errorContainer = /** @type {HTMLElement} */ (document.querySelector('#errors'));
  const componentDiagramContainer = /** @type {HTMLElement} */ (document.querySelector('#component-diagram'));

	/**
	 * Render the document in the webview.
	 */
	function updateContent(/** @type {string} */ text) {
		let scenarioData;
		try {
			scenarioData = JSON.parse(text);
		} catch {
			errorContainer.innerText = 'Error: Document is not valid json';
			errorContainer.style.display = '';
			return;
		}
		errorContainer.style.display = 'none';

    // @ts-ignore
    const componentModel = new Appmap.Models.Components(scenarioData);
    // @ts-ignore
    const diagram = new Appmap.ComponentDiagram(componentDiagramContainer);
    diagram.render(componentModel);
	}

	// Handle messages sent from the extension to the webview
	window.addEventListener('message', event => {
		const message = event.data; // The json data that the extension sent
		switch (message.type) {
			case 'update':
				const text = message.text;

				// Update our webview's content
				updateContent(text);

				// Then persist state information.
				// This state is returned in the call to `vscode.getState` below when a webview is reloaded.
				vscode.setState({ text });

				return;
		}
	});

	// Webviews are normally torn down when not visible and re-created when they become visible again.
	// State lets us save information across these re-loads
	const state = vscode.getState();
	if (state) {
		updateContent(state.text);
	}
}());