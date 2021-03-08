import Vue from 'vue';
import { VDiff } from '@appland/appmap'; // eslint-disable-line import/no-named-default

export default function mountDiff() {
  const vscode = window.acquireVsCodeApi();

  window.addEventListener('message', (event) => {
    const message = event.data;
    console.log(event);
    if (message.type === 'update') {
      const { base, working } = message;
      console.log(base, working);
      const app = new Vue({
        el: '#app',
        render: (h) => h(VDiff, { ref: 'ui', props: { base, working } }),
        mounted() {
          vscode.postMessage({ command: 'ready' });
        },
      });
    }
  });
}
