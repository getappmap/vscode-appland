import Vue from 'vue';
import { default as plugin, VVsCodeExtension } from '@appland/appmap'; // eslint-disable-line import/no-named-default

Vue.use(plugin);

const vscode = window.acquireVsCodeApi();

const app = new Vue({
  el: '#app',
  render: (h) => h(VVsCodeExtension, { ref: 'ui' }),
  methods: {
    loadData(text) {
      this.$refs.ui.loadData(text);
    },
  },
  mounted() {
    vscode.postMessage({ command: 'ready' });
  },
});

app.$on('viewSource', (location) => vscode.postMessage({ command: 'viewSource', text: location }));

window.addEventListener('message', (event) => {
  const message = event.data;
  if (message.type === 'update') {
    const { text } = message;
    app.loadData(text);

    // Then persist state information.
    // This state is returned in the call to `vscode.getState` below when a webview is reloaded.
    vscode.setState({ text });
  }
});

// Webviews are normally torn down when not visible and re-created when they become visible again.
// State lets us save information across these re-loads
const state = vscode.getState();
if (state) {
  app.loadData(state.text);
}
