import Vue from 'vue';
import { VFindingDetails } from '@appland/components'; // eslint-disable-line import/no-named-default
import '@appland/diagrams/dist/style.css';
import MessagePublisher from './messagePublisher';

export default function mountFindingInfoView() {
  const vscode = window.acquireVsCodeApi();
  const messages = new MessagePublisher(vscode);

  messages.on('initFindingsInfo', (initialData) => {
    const app = new Vue({
      el: '#app',
      render(h) {
        return h(VFindingDetails, {
          ref: 'ui',
          props: {
            findings: this.findings,
          },
        });
      },
      data() {
        return {
          findings: initialData.findings,
        };
      },
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

    messages.on('open-new-finding', ({ findings }) => {
      app.findings = findings;
      app.$forceUpdate();
    });

    app.$on('open-in-source-code', (location) => {
      messages.rpc('open-in-source-code', location);
    });

    app.$on('open-map', (mapFile, uri) => {
      messages.rpc('open-map', { mapFile, uri });
    });

    app.$on('open-findings-overview', () => {
      messages.rpc('open-findings-overview');
    });
  });

  vscode.postMessage({ command: 'findingsInfoReady' });
}
