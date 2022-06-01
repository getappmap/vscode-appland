import Vue from 'vue';
import { VInstallGuide } from '@appland/components';
import '@appland/diagrams/dist/style.css';
import MessagePublisher from './messagePublisher';

export default function mountInstallGuide() {
  const vscode = window.acquireVsCodeApi();
  const messages = new MessagePublisher(vscode);

  messages.on('init', ({ projects: startProjects, page: startPage }) => {
    const app = new Vue({
      el: '#app',
      render(h) {
        return h(VInstallGuide, {
          ref: 'ui',
          props: {
            projects: this.projects,
            editor: 'vscode',
          },
        });
      },
      data() {
        return {
          projects: startProjects,
        };
      },
      mounted() {
        document.querySelectorAll('a[href]').forEach((el) => {
          el.addEventListener('click', (e) => {
            vscode.postMessage({ command: 'clickLink', uri: e.target.href });
          });
        });
        this.$refs.ui.jumpTo(startPage);
      },
    });

    app.$on('view-problems', (projectPath) => {
      messages.rpc('view-problems', projectPath);
    });

    app.$on('openAppmap', (file) => {
      vscode.postMessage({ command: 'open-file', file });
    });

    app.$on('open-instruction', (pageId) => {
      app.$refs.ui.jumpTo(pageId);
    });

    messages.on('page', ({ page }) => {
      app.$refs.ui.jumpTo(page);
    });

    messages.on('projects', ({ projects }) => {
      app.projects = projects;
      app.$forceUpdate();
    });
  });

  vscode.postMessage({ command: 'ready' });
}
