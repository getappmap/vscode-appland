import Vue from 'vue';
import { VChatSearch } from '@appland/components';
import MessagePublisher from './messagePublisher';

export default function mountChatSearchView() {
  const vscode = window.acquireVsCodeApi();
  const messages = new MessagePublisher(vscode);

  messages.on('initChatSearch', (initialData) => {
    const app = new Vue({
      el: '#app',
      render(h) {
        return h(VChatSearch, {
          ref: 'ui',
          props: {
            appmapRpcPort: initialData.appmapRpcPort,
            question: initialData.question,
          },
        });
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

    app.$on('request-resolve-location', (location) => {
      app.$emit('response-resolve-location', {
        location,
        externalUrl: location,
      });
    });

    app.$on('viewSource', ({ location }) => {
      vscode.postMessage({ command: 'viewSource', text: location });
      vscode.postMessage({ command: 'performAction', action: 'view_source' });
    });
  });

  vscode.postMessage({ command: 'chat-search-ready' });
}
