import Vue from 'vue';
import { VOpenAppmaps } from '@appland/components';
import '@appland/diagrams/dist/style.css';
import MessagePublisher from './messagePublisher';

export default function mountQuickstartOpenAppmaps() {
  const vscode = window.acquireVsCodeApi();
  const messages = new MessagePublisher(vscode);

  messages
    .on('init', (event) => {
      const app = new Vue({
        el: '#app',
        render(h) {
          return h(VOpenAppmaps, {
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
