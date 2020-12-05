// @ts-check

// Script run within the webview itself.
(function () {
	// Get a reference to the VS Code webview api.
	// We use this API to post messages back to our extension.

	// @ts-ignore
  const vscode = acquireVsCodeApi();

  const errorContainer = /** @type {HTMLElement} */ (document.querySelector('#errors'));
  const componentDiagramContainer = /** @type {HTMLElement} */ (document.querySelector('#component-diagram'));
  const eventDetailsContainer = /** @type {HTMLElement} */ (document.querySelector('#component-details .content'));
	let scenarioData,
		componentDiagram,
		eventDiagram;

	/**
	 * Render the document in the webview.
	 */
	function updateContent(/** @type {string} */ text) {
		try {
			scenarioData = JSON.parse(text);
		} catch {
			errorContainer.innerText = 'Error: Document is not valid json';
			errorContainer.style.display = '';
			return;
		}
		errorContainer.style.display = 'none';

		// TODO: Bug at EventInfo.getLabels (d3-appmap.js:12407) expects labels to exist.
		// if (codeObj && codeObj.labels.length) {
		function defaultFunctionLabels(obj) {
			if (obj.type === 'function') {
				if ( !obj.labels ) {
					obj.labels = [];
				}
			}
	
			if (obj.children) {
				obj.children.forEach(defaultFunctionLabels)
			}
		}
		scenarioData.classMap.forEach(defaultFunctionLabels);

		buildComponentDiagram();
	}

	function buildComponentDiagram() {
		if ( componentDiagram ) {
			return;
		}

		function viewSource(repoUrl) {
			console.log(repoUrl);
		}

		function contextMenu(componentDiagram){
			return [
				(item) => item
					.text('View source')
					.selector('g.node.class')
					.transform(function(e) {
						return componentDiagram.sourceLocation(e.getAttribute('id'));
					})
					.on('execute', viewSource)
			]
		}

    // @ts-ignore
    const componentModel = new Appmap.Models.Components(scenarioData);
		componentDiagramContainer.innerHTML = '';
		// @ts-ignore
		const diagram = new Appmap.ComponentDiagram(componentDiagramContainer, { theme: 'dark', contextMenu })
		componentDiagram = diagram;
		diagram.render(componentModel);
		diagram.on('highlight', (ids) => {
			eventDetailsContainer.innerHTML = '';
			if ( !ids ) {
				return;
			}
			const id = ids[0];
			eventDetailsContainer.innerHTML = `Selected element: ${id}`;
		})
	}

	function buildEventDiagram() {
		if ( eventDiagram ) {
			return;
		}

		function aggregateEvents(events, classMap) {
			const eventInfo = new Appmap.Models.EventInfo(classMap);
			const callTree = new Appmap.Models.CallTree(events);
		
			function buildDisplayName(event) {
				const separator = event.static ? '.' : '#';
				return [event.defined_class, separator, event.method_id].join('');				
			};

			callTree.rootNode.forEach((e) => {
				e.displayName = eventInfo.getName(e.input) || buildDisplayName(e.input);
	
				e.labels = eventInfo.getLabels(e.input);
			});
		
			return callTree;
		}
		
		const callTree = aggregateEvents(scenarioData.events, scenarioData.classMap);

		const diagram = new Appmap.FlowView('#event-diagram', { theme: 'dark' });		
		eventDiagram = diagram;
		diagram.setCallTree(callTree);
		diagram.render();
	}

	jQuery('#event-diagram-content-tab').on('show.bs.tab', buildEventDiagram);
	
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