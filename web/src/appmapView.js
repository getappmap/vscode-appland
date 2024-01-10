import Vue from 'vue';
import { VVsCodeExtension } from '@appland/components'; // eslint-disable-line import/no-named-default
import { getAppMapMetrics } from './telemetry';
import '@appland/diagrams/dist/style.css';
import MessagePublisher from './messagePublisher';
import handleAppMapMessages from './handleAppMapMessages';

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
        getAppMapState() {
          return this.$refs.ui.getState();
        },
        setAppMapState(state) {
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

    handleAppMapMessages(app, vscode);

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
        case 'updateSavedFilters':
          // TODO: Update ChatSearch to handle updated filters.
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
``;
