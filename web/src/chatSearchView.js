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
            savedFilters: initialData.savedFilters,
            apiUrl: initialData.apiUrl,
            apiKey: initialData.apiKey,
            appmaps: this.appmaps,
            appmapYmlPresent: this.appmapYmlPresent,
          },
        });
      },
      data: {
        appmaps: initialData.appmaps || [],
        appmapYmlPresent: initialData.appmapYmlPresent,
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
      mounted() {
        if (initialData.codeSelection) {
          this.$refs.ui.includeCodeSelection(initialData.codeSelection);
        }
      },
    });

    handleAppMapMessages(app, vscode);

    messages.on('update', (props) => {
      Object.entries(props)
        .filter(([key]) => key !== 'type')
        .forEach(([key, value]) => {
          if (key in app.$data && app[key] !== value) {
            app[key] = value;
          }
        });
    });

    app.$on('open-install-instructions', () => {
      vscode.postMessage({ command: 'open-install-instructions' });
    });

    app.$on('open-record-instructions', () => {
      vscode.postMessage({ command: 'open-record-instructions' });
    });

    app.$on('open-appmap', (path) => {
      vscode.postMessage({ command: 'open-appmap', path });
    });

    app.$on('show-appmap-tree', () => {
      vscode.postMessage({ command: 'show-appmap-tree' });
    });
  });

  vscode.postMessage({ command: 'chat-search-ready' });
}
