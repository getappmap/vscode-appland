// @ts-check

import ClassDetails from './ui/classDetails.js';
import FunctionDetails from './ui/functionDetails.js';
import { ComponentDiagram, FlowView } from '@appland/diagrams';
import { CallTree, EventInfo, Components, ClassMap } from '@appland/models';

import 'bootstrap';
import 'bootstrap-autocomplete';

import '@appland/diagrams/dist/@appland/diagrams.css';
import '../src/scss/appland.scss';

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
		selectedCallNode,
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
			const eventInfo = new EventInfo(classMap);
			const callTree = new CallTree(events);

			function buildDisplayName(event) {
				const separator = event.static ? '.' : '#';
				return [event.defined_class, separator, event.method_id].join('');
			};
			
			callTree.rootEvent.forEach((e) => {
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

	function openCallNode(callNode) {
		jQuery('#event-diagram-content-tab').tab('show');
		selectedCallNode = callNode;
	}

	function displayClassDetails(cls) {
		const appmap = { classMap, events: callTree };

		const cod = new ClassDetails(eventDetailsContainer, appmap)
		cod.on('openSourceLocation', openSourceLocation);
		cod.on('selectFunction', (fn) => {
			const fnDetails = new FunctionDetails(eventDetailsContainer, appmap)
			fnDetails.on('openSourceLocation', openSourceLocation);
			fnDetails.on('selectCallNode', openCallNode);
			fnDetails.on('selectClass', displayClassDetails);
			fnDetails.render(fn);
		});
		cod.render(cls);	
	}

	function buildComponentDiagram() {
		if (componentDiagram) {
			return;
		}

		function contextMenu(componentDiagram) {
			return [
				(item) => item
					.text('Expand')
					.selector('g.node')
					.transform((e) => e.getAttribute('id'))
					.condition((id) => componentDiagram.hasPackage(id))
					.on('execute', (id) => componentDiagram.expand(id)),
				(item) => item
					.text('Collapse')
					.selector('g.node')
					.transform((e) => e.getAttribute('id'))
					.condition((id) => !componentDiagram.hasPackage(id))
					.on('execute', (id) => componentDiagram.collapse(id)),
				(item) => item
					.text('Reset view')
					.on('execute', () => {
						componentDiagram.render(componentDiagram.initialModel);
					})
			];
		}

		// @ts-ignore
		const componentModel = new Components(scenarioData);
		componentDiagramContainer.innerHTML = '';
		// @ts-ignore
		const diagram = new ComponentDiagram(componentDiagramContainer, { theme: 'dark', contextMenu })
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
			if (codeObjects.length === 0) {
				return false;
			}

			const codeObject = codeObjects[0];

			if ( codeObject.type === 'class' ) {
				displayClassDetails(codeObject);
			}
		});
	}

	function buildEventDiagram() {
		if (eventDiagram) {
			return;
		}

		const diagram = new FlowView('#event-diagram', { theme: 'dark' });
		eventDiagram = diagram;
		diagram.setCallTree(callTree);
		diagram.render();
	}

	function selectCallNode() {
		if ( selectedCallNode ) {
			// This has to wait until the tab is visible, or the pan-to-node viewport calculations won't work.
			callTree.selectedEvent = selectedCallNode;
			selectedCallNode = null;
		}
	}

	jQuery('#event-diagram-content-tab').on('shown.bs.tab', () => {
		buildEventDiagram();
		selectCallNode();
	});

	jQuery(filterInput).autoComplete({
		resolver: 'custom',
		events: {
			search: function (qry, callback) {
				callback(classMap.search(qry).map((co) => co.id));
			}
		}
	}).on('autocomplete.select', function (/** @type Event */ evt, /** @type {string} */ item) {
		const codeObject = classMap.codeObjectFromId(item);
		let filterId;
		switch (codeObject.type) {
			case 'package':
				filterId = codeObject.packageOf;
				break;
			default:
				filterId = codeObject.classOf;
				break;
		}
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

	vscode.postMessage({ command: 'ready' });

	// Webviews are normally torn down when not visible and re-created when they become visible again.
	// State lets us save information across these re-loads
	const state = vscode.getState();
	if (state) {
		updateContent(state.text);
	}
}());
