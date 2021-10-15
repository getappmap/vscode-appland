import Vue from 'vue';
import {
  VQuickstartDocsInstallAgent,
  VQuickstartDocsOpenAppmaps,
  VQuickstartDocsRecordAppmaps,
} from '@appland/components';
import '@appland/diagrams/dist/style.css';
import MessagePublisher from './messagePublisher';

export function mountQuickstartInstallAgent(path) {
  console.log(path);
  const vscode = window.acquireVsCodeApi();
  const messages = new MessagePublisher(vscode);

  const codeSnippet = ['npx @appland/appmap install', path].filter(Boolean).join(' ');

  messages
    .on('init', () => {
      const app = new Vue({
        el: '#app',
        render(h) {
          return h(VQuickstartDocsInstallAgent, {
            ref: 'ui',
            props: {
              codeSnippet,
            },
          });
        },
        mounted() {
          document.querySelectorAll('a[href]').forEach((el) => {
            el.addEventListener('click', (e) => {
              vscode.postMessage({ command: 'clickLink', uri: e.target.href });
            });
          });
        },
      });

      app.$on('transition', (target) => {
        vscode.postMessage({ command: 'transition', target });
      });

      app.$on('clipboard', () => {
        vscode.postMessage({ command: 'copyInstallCommand' });
      });

      vscode.postMessage({ command: 'postInitialize' });
    })
    .on(undefined, (event) => {
      throw new Error(`unhandled message type: ${event.type}`);
    });

  vscode.postMessage({ command: 'preInitialize' });
}

export function mountQuickstartRecordAppmaps() {
  const vscode = window.acquireVsCodeApi();
  const messages = new MessagePublisher(vscode);

  messages
    .on('init', (event) => {
      const app = new Vue({
        el: '#app',
        render(h) {
          return h(VQuickstartDocsRecordAppmaps, {
            ref: 'ui',
            props: {
              editor: this.editor,
            },
          });
        },
        data() {
          return {
            editor: event.editor,
          };
        },
        mounted() {
          document.querySelectorAll('a[href]').forEach((el) => {
            el.addEventListener('click', (e) => {
              vscode.postMessage({ command: 'clickLink', uri: e.target.href });
            });
          });
        },
      });

      app.$on('transition', (target) => {
        vscode.postMessage({ command: 'transition', target });
      });

      vscode.postMessage({ command: 'postInitialize' });
    })
    .on(undefined, (event) => {
      throw new Error(`unhandled message type: ${event.type}`);
    });

  vscode.postMessage({ command: 'preInitialize' });
}

export function mountQuickstartOpenAppmaps() {
  const vscode = window.acquireVsCodeApi();
  const messages = new MessagePublisher(vscode);

  messages
    .on('init', (event) => {
      const app = new Vue({
        el: '#app',
        render(h) {
          return h(VQuickstartDocsOpenAppmaps, {
            ref: 'ui',
            props: {
              appmaps: this.appmaps,
            },
          });
        },
        data() {
          return {
            appmaps: event.appmaps,
          };
        },
        mounted() {
          document.querySelectorAll('a[href]').forEach((el) => {
            el.addEventListener('click', (e) => {
              vscode.postMessage({ command: 'clickLink', uri: e.target.href });
            });
          });
        },
      });

      app.$on('openAppmap', (file) => {
        vscode.postMessage({ command: 'openFile', file });
      });

      messages.on('appmapSnapshot', ({ appmaps }) => {
        app.appmaps = appmaps;
      });

      vscode.postMessage({ command: 'postInitialize' });
    })
    .on(undefined, (event) => {
      throw new Error(`unhandled message type: ${event.type}`);
    });

  vscode.postMessage({ command: 'preInitialize' });
}
