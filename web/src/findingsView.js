import Vue from 'vue';
import { VAnalysisFindings } from '@appland/components'; // eslint-disable-line import/no-named-default
import '@appland/diagrams/dist/style.css';
import MessagePublisher from './messagePublisher';

export default function mountFindingsView() {
  const vscode = window.acquireVsCodeApi();
  const messages = new MessagePublisher(vscode);

  messages.on('initFindings', (initialData) => {
    const app = new Vue({
      el: '#app',
      render(h) {
        return h(VAnalysisFindings, {
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

    messages.on('findings', (message) => {
      app.findings = message.findings;
      app.$forceUpdate();
    });

    app.$on('open-finding-info', (hash) => {
      messages.rpc('open-finding-info', hash);
    });

    app.$on('open-problems-tab', () => {
      messages.rpc('open-problems-tab');
    });
  });

  vscode.postMessage({ command: 'findings-overview-ready' });
}
