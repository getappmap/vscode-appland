import Vue from 'vue';
import { VVsCodeExtension } from '@appland/components'; // eslint-disable-line import/no-named-default
import patchNotesHtml from '../static/html/patch_notes.html';
import { getAppMapMetrics } from './telemetry';
import '@appland/diagrams/dist/style.css';

export default function mountApp() {
  const startTime = new Date();
  const vscode = window.acquireVsCodeApi();

  const app = new Vue({
    el: '#app',
    // eslint-disable-next-line arrow-body-style
    render: (h) => {
      return h(VVsCodeExtension, {
        ref: 'ui',
        props: {
          appMapUploadable: true,
        },
      });
    },
    methods: {
      async loadData(text) {
        const { ui } = this.$refs;
        ui.loadData(text);

        vscode.postMessage({
          command: 'onLoadComplete',
          metrics: {
            ...getAppMapMetrics(ui.$store.state.appMap),
            load_time: (new Date() - startTime) / 1000,
          },
        });
      },
      showInstructions() {
        this.$refs.ui.showInstructions();
      },
      getState() {
        return this.$refs.ui.getState();
      },
      setState(state) {
        this.$refs.ui.setState(state);
      },
      displayUpdateNotification(version) {
        this.$refs.ui.showVersionNotification(`v${version}`, patchNotesHtml);
      },
    },
    mounted() {
      vscode.postMessage({ command: 'ready' });
    },
  });

  app.$on('viewSource', (location) => {
    vscode.postMessage({ command: 'viewSource', text: location });
    vscode.postMessage({ command: 'performAction', action: 'view_source' });
  });

  app.$on('clearSelection', () => {
    vscode.postMessage({ command: 'performAction', action: 'clear_selection' });
  });

  app.$on('uploadAppmap', () => {
    vscode.postMessage({
      command: 'uploadAppmap',
      metrics: getAppMapMetrics(app.$refs.ui.$store.state.appMap),
    });
    vscode.postMessage({ command: 'performAction', action: 'upload_appmap' });
  });

  app.$on('stateChanged', (stateKey) => {
    const { ui } = app.$refs;
    const state = ui.getState();

    if (stateKey === 'selectedObject') {
      const { selectedObject } = state;
      if (!selectedObject || selectedObject === '') {
        return;
      }

      vscode.postMessage({
        command: 'performAction',
        action: 'selected_object',
        data: {
          // remove the identifier and only send the object type
          object_type: id.replace(/:.*/, ''),
        },
      });
    }
  });

  app.$on('changeTab', (tabId) => {
    vscode.postMessage({
      command: 'performAction',
      action: 'change_tab',
      data: { tabId },
    });
  });

  app.$on('showInstructions', () => {
    vscode.postMessage({ command: 'performAction', action: 'show_instructions' });
  });

  app.$on('notificationOpen', () => {
    vscode.postMessage({ command: 'performAction', action: 'view_patch_notes' });
  });

  app.$on('notificationClose', () => {
    vscode.postMessage({ command: 'performAction', action: 'dismiss_patch_notes' });
    vscode.postMessage({ command: 'closeUpdateNotification' });
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
          const { text } = message;
          app.loadData(text);

          // Then persist state information.
          // This state is returned in the call to `vscode.getState`
          // below when a webview is reloaded.
          vscode.setState({ text });
        }
        break;
      case 'showInstructions':
        app.showInstructions();
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
      case 'displayUpdateNotification':
        app.displayUpdateNotification(message.version);
        break;
      case 'openUrl':
        vscode.postMessage({
          command: 'appmapOpenUrl',
          url: message.url,
        });
        break;
      default:
        break;
    }
  });

  // Webviews are normally torn down when not visible and re-created when they become visible again.
  // State lets us save information across these re-loads
  const state = vscode.getState();
  if (state) {
    app.loadData(state.text);
  }
}
