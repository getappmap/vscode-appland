import Vue from 'vue';
import { VChatSearch } from '@appland/components';
import MessagePublisher from './messagePublisher';
import handleAppMapMessages from './handleAppMapMessages';
import 'highlight.js/styles/base16/snazzy.css';
import '../static/styles/navie-integration.css';

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
            mostRecentAppMaps: this.mostRecentAppMaps,
            appmapYmlPresent: this.appmapYmlPresent,
            targetAppmapData: initialData.targetAppmap,
            targetAppmapFsPath: initialData.targetAppmapFsPath,
            openNewChat() {
              vscode.postMessage({ command: 'open-new-chat' });
            },
          },
        });
      },
      data: {
        mostRecentAppMaps: initialData.mostRecentAppMaps || [],
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
        if (initialData.suggestion) {
          this.$refs.ui.$refs.vchat.addUserMessage(initialData.suggestion.label);
          this.$refs.ui.sendMessage(initialData.suggestion.prompt);
        }
        if (initialData.threadId) {
          this.$refs.ui.loadThread(initialData.threadId);
        }
      },
    });

    handleAppMapMessages(app, vscode);

    messages.on('fetch-pinned-files', (props) => {
      const { requests } = props;
      vscode.postMessage({ command: 'fetch-pinned-files', requests });
    });

    messages.on('choose-files-to-pin', () => {
      vscode.postMessage({ command: 'choose-files-to-pin' });
    });

    messages.on('pin-files', (props) => {
      const { requests } = props;
      app.$root.$emit('pin-files', requests);
    });

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

    app.$on('open-location', (location, directory) => {
      vscode.postMessage({ command: 'open-location', location, directory });
    });

    app.$on('select-llm-option', (option) => {
      vscode.postMessage({ command: 'select-llm-option', option });
    });

    app.$on('fetch-pinned-files', (requests) => {
      vscode.postMessage({ command: 'fetch-pinned-files', requests });
    });

    app.$on('pin', (event) => {
      vscode.postMessage({ command: 'pin', event });
    });

    app.$on('chat-search-loaded', () => {
      vscode.postMessage({ command: 'chat-search-loaded' });
    });

    app.$on('thread-id', (threadId) => {
      vscode.setState({ threadId });
    });
  });

  vscode.postMessage({ command: 'chat-search-ready' });
}
