import Vue from 'vue';
import { VVsCodeExtension } from '@appland/components'; // eslint-disable-line import/no-named-default
import patchNotesHtml from '../static/html/patch_notes.html';
import { getAppMapMetrics } from './telemetry';
import '@appland/diagrams/dist/style.css';
import MessagePublisher from './messagePublisher';

export default function mountApp() {
  const startTime = new Date();
  const vscode = window.acquireVsCodeApi();
  const messages = new MessagePublisher(vscode);

  messages.on('init-appmap', (initialData) => {
    const { shareEnabled, defaultView, savedFilters } = initialData;
    const props = {
      appMapUploadable: shareEnabled,
      defaultView,
      savedFilters,
    };

    const app = new Vue({
      el: '#app',
      render(h) {
        return h(VVsCodeExtension, {
          ref: 'ui',
          props,
        });
      },
      methods: {
        async loadData(appMap, sequenceDiagram) {
          const { ui } = this.$refs;
          ui.loadData(appMap, sequenceDiagram);

          vscode.postMessage({
            command: 'onLoadComplete',
            metrics: {
              ...getAppMapMetrics(ui.$store.state.appMap),
              load_time: (new Date() - startTime) / 1000,
            },
          });
        },
        getState() {
          return this.$refs.ui.getState();
        },
        setState(state) {
          this.$refs.ui.setState(state);
        },
        setActive(isActive) {
          this.$refs.ui.isActive = isActive;
        },
        updateFilters(updatedSavedFilters) {
          this.$refs.ui.updateFilters(updatedSavedFilters);
        },
      },
      mounted() {
        vscode.postMessage({ command: 'ready' });
      },
    });

    app.$on('request-resolve-location', (location) => {
      app.$emit('response-resolve-location', {
        location,
        externalUrl: location,
      });
    });

    app.$on('viewSource', ({ location }) => {
      vscode.postMessage({ command: 'viewSource', text: location });
    });

    // KEG: I'm not sure where this is used, but I'm not 100% sure that it doesn't do anything. So, leaving
    // it here for now.
    app.$on('copyToClipboard', (stringToCopy) => {
      vscode.postMessage({
        command: 'copyToClipboard',
        stringToCopy,
      });
    });

    app.$on('exportSVG', (svgString) => {
      vscode.postMessage({ command: 'exportSVG', svgString });
    });

    app.$on('seq-diagram-feedback', () => {
      vscode.postMessage({ command: 'seq-diagram-feedback' });
    });

    app.$on('saveFilter', (filter) => {
      vscode.postMessage({ command: 'saveFilter', filter });
    });

    app.$on('deleteFilter', (filter) => {
      vscode.postMessage({ command: 'deleteFilter', filter });
    });

    app.$on('defaultFilter', (filter) => {
      vscode.postMessage({ command: 'defaultFilter', filter });
    });

    window.addEventListener('error', (event) => {
      vscode.postMessage({
        command: 'reportError',
        error: {
          message: event.error.message,
          stack: event.error.stack,
        },
      });
    });

    window.addEventListener('message', (event) => {
      const message = event.data;

      switch (message.type) {
        case 'update':
          {
            const { appMap, sequenceDiagram } = message;
            app.loadData(appMap, sequenceDiagram);

            // Then persist state information.
            // This state is returned in the call to `vscode.getState`
            // below when a webview is reloaded.
            vscode.setState({ appMap, sequenceDiagram });
          }
          break;
        case 'requestAppmapState':
          vscode.postMessage({
            command: 'appmapStateResult',
            state: app.getState(),
          });
          break;
        case 'setAppmapState':
          app.setState(message.state);
          break;
        case 'openUrl':
          vscode.postMessage({
            command: 'appmapOpenUrl',
            url: message.url,
          });
          break;
        case 'setActive':
          app.setActive(message.active);
          break;
        case 'updateSavedFilters':
          app.updateFilters(message.savedFilters);
          break;
        default:
          break;
      }
    });

    // Webviews are normally torn down when not visible and re-created when they become visible again.
    // State lets us save information across these re-loads
    const state = vscode.getState();
    if (state) {
      app.loadData(state.appMap, state.sequenceDiagram);
    }
  });

  vscode.postMessage({ command: 'appmap-ready' });
}
