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
            indexPort: initialData.indexPort,
            aiPort: initialData.aiPort,
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
  });

  vscode.postMessage({ command: 'chat-search-ready' });
}
