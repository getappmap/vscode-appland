// @ts-check
import ClassMap from './models/classMap.js';

// Script run within the webview itself.
(function () {
	// Get a reference to the VS Code webview api.
	// We use this API to post messages back to our extension.

	// @ts-ignore
	const vscode = acquireVsCodeApi();

	const errorContainer = /** @type {HTMLElement} */ (document.querySelector('#errors'));
	const componentDiagramContainer = /** @type {HTMLElement} */ (document.querySelector('#component-diagram'));
	const eventDetailsContainer = /** @type {HTMLElement} */ (document.querySelector('#component-details .content'));
	const filterInput = /** @type {HTMLInputElement} */ (document.querySelector('#filter-input input[type=text]'));
	let scenarioData,
		componentDiagram,
		callTree,
		classMap,
		eventDiagram;

	/**
	 * Render the document in the webview.
	 */
	function updateContent(/** @type {string} */ text) {
		try {
			scenarioData = JSON.parse(text);
		} catch (e) {
			errorContainer.innerText = 'Error: Document is not valid json';
			errorContainer.style.display = '';
			return;
		}
		errorContainer.style.display = 'none';

		// TODO: Bug at EventInfo.getLabels (d3-appmap.js:12407) expects labels to exist.
		// if (codeObj && codeObj.labels.length) {
		function defaultFunctionLabels(obj) {
			if (obj.type === 'function') {
				if (!obj.labels) {
					obj.labels = [];
				}
			}

			if (obj.children) {
				obj.children.forEach(defaultFunctionLabels)
			}
		}
		scenarioData.classMap.forEach(defaultFunctionLabels);

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

		callTree = aggregateEvents(scenarioData.events, scenarioData.classMap);

		classMap = new ClassMap(scenarioData.classMap);

		buildComponentDiagram();
	}

	function openSourceLocation(path) {
		vscode.postMessage({ command: 'viewSource', text: path });
	}

	function buildComponentDiagram() {
		if (componentDiagram) {
			return;
		}

		function viewSource(repoUrl) {
			console.log(repoUrl);
		}

		function contextMenu(componentDiagram) {
			return [
				(item) => item
					.text('View source')
					.selector('g.node.class')
					.transform(function (e) {
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
		diagram.on('focus', (/** @type {string} */ id) => {
			if (!id) {
				filterInput.value = '';
				return;
			}
		});
		diagram.on('highlight', (/** @type {Array<string>} */ ids) => {
			eventDetailsContainer.innerHTML = '';
			if (!ids) {
				return;
			}
			const id = ids[0];
			// TODO: Doing fuzzy match here, because ids from the component diagram aren't currently fully qualified.
			// const codeObject = classMap.codeObjectFromId(id);
			const codeObjects = classMap.search(id);
			if ( codeObjects.length === 0 ) {
				return false;
			}

			const codeObject = codeObjects[0];
			eventDetailsContainer.innerHTML = '';

			const httpServerRequests = /** @type {Set<CallNode>} */ new Set();
			const invocationEvents = /** @type {Array<CallNode>} */ new Array();
			const sqlQueries = /** @type {Array<CallNode>} */ [];
			callTree.rootNode.forEach((/** @type {CallNode} */ node, /** @type {Array<CallNode>} */ stack) => {
				const location = [ node.input.path, node.input.lineno ].filter(n => n).join(':');
				const types = /** @type {Array<CodeObject>} */ classMap.codeObjectsAtLocation(location);
				if ( types.length === 0 ) {
					return;
				}
				const type = types[0];
				if ( type.classOf === codeObject.classOf ) {
					invocationEvents.push(node);
					stack.filter((node) => node.input.http_server_request).forEach(httpServerRequests.add.bind(httpServerRequests))
				}
			});
			invocationEvents.forEach((/** @type {CallNode} */ node) => {
				node.forEach((/** @type {CallNode} */ child) => {
					if ( child.input.sql_query ) {
						sqlQueries.push(child);
					}
				});
			});

			d3.select(eventDetailsContainer)
				.append('h4')
				.text(id);
			d3.select(eventDetailsContainer)
				.append('div')
				.classed('content', true)
				.call((content) => {
					content
						.append('h5')
						.text('Locations');	
				})
				.call((content) => {
					content
						.append('ul')
						.classed('locations detail-list', true)
						.call((ul) => {
							ul
								.selectAll('.location')
								.data(codeObject.locations)
								.enter()
								.append('li')
								.append('a')
								.attr('href', 'javascript: void(0)')
								.on('click', openSourceLocation)
								.text((d) => d)
								;
						});
				})
				.call((content) => {
					content
						.append('h5')
						.text('HTTP server requests');	
				})
				.call((content) => {
					content
						.append('ul')
						.classed('http-server-requests detail-list', true)
						.call((ul) => {
							ul
								.selectAll('.http-server-request')
								.data(Array.from(httpServerRequests).map((e) => e.input), (d) => d.id)
								.enter()
								.append('li')
								.append('a')
								.attr('href', 'javascript: void(0)')
								.attr('data-event-id', d => d.id)
								.text((d) => `${d.http_server_request.request_method} ${d.http_server_request.path_info}`)
								;
						});
				})
				.call((content) => {
					content
						.append('h5')
						.text('SQL queries');	
				})
				.call((content) => {
					content
						.append('ul')
						.classed('sql-queries detail-list', true)
						.call((ul) => {
							ul
								.selectAll('.sql-query')
								.data(sqlQueries.map((e) => e.input), (d) => d.id)
								.enter()
								.append('li')
								.append('a')
								.attr('data-event-id', d => d.id)
								.attr('href', 'javascript: void(0)')
								.text((_, i) => `Query ${i}`) // d.sql_query.sql
								;
						});
				});
		});
	}

	function buildEventDiagram() {
		if (eventDiagram) {
			return;
		}

		const diagram = new Appmap.FlowView('#event-diagram', { theme: 'dark' });
		eventDiagram = diagram;
		diagram.setCallTree(callTree);
		diagram.render();
	}

	jQuery('#event-diagram-content-tab').on('show.bs.tab', buildEventDiagram);
	jQuery(filterInput).autoComplete({
		resolver: 'custom',
		events: {
			search: function (qry, callback) {
				callback(classMap.search(qry).map((co) => co.id));
			}
		}
	}).on('autocomplete.select', function(/** @type Event */ evt, /** @type {string} */ item) {
		const codeObject = classMap.codeObjectFromId(item);
		let filterId;
		switch ( codeObject.type ) {
		case 'package':
			filterId = codeObject.packageOf;
			break;
		default:
			filterId = codeObject.classOf;
			break;			
		}
		componentDiagram.clearFocus();
		componentDiagram.focus(filterId);
	});

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