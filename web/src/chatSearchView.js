import Vue from 'vue';
import { VChatSearch } from '@appland/components';
import MessagePublisher from './messagePublisher';
import handleAppMapMessages from './handleAppMapMessages';
import 'highlight.js/styles/base16/snazzy.css';

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
            savedFilters: initialData.savedFilters,
          },
        });
      },
      methods: {
        getAppMapState() {
          return this.$refs.ui.getAppMapState();
        },
        setAppMapState(state) {
          this.$refs.ui.setAppMapState(state);
        },
        updateFilters(updatedSavedFilters) {
          this.$refs.ui.updateFilters(updatedSavedFilters);
        },
      },
    });

    handleAppMapMessages(app, vscode);

    app.$on('open-record-instructions', () => {
      vscode.postMessage({ command: 'open-record-instructions' });
    });
  });

  vscode.postMessage({ command: 'chat-search-ready' });
}