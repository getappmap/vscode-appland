import Vue from 'vue';
import { VInstallGuide } from '@appland/components';
import '@appland/diagrams/dist/style.css';
import MessagePublisher from './messagePublisher';

export default function mountInstallGuide() {
  const vscode = window.acquireVsCodeApi();
  const messages = new MessagePublisher(vscode);

  messages.on('init', (initialData) => {
    let currentPage = initialData.page;
    let currentProject;

    const app = new Vue({
      el: '#app',
      render(h) {
        return h(VInstallGuide, {
          ref: 'ui',
          props: {
            projects: this.projects,
            editor: 'vscode',
            analysisEnabled: this.analysisEnabled,
            findingsEnabled: this.findingsEnabled,
            userAuthenticated: this.userAuthenticated,
            featureFlags: new Set(['ar-python']),
          },
        });
      },
      data() {
        return {
          projects: initialData.projects,
          analysisEnabled: initialData.analysisEnabled,
          findingsEnabled: initialData.findingsEnabled,
          userAuthenticated: initialData.userAuthenticated,
        };
      },
      beforeCreate() {
        this.$on('open-page', async (pageId) => {
          // Wait until next frame if there's no current project. It may take some time for the
          // view to catch up.
          if (!currentProject) await new Promise((resolve) => requestAnimationFrame(resolve));

          currentPage = pageId;
          vscode.postMessage({
            command: 'open-page',
            page: currentPage,
            project: currentProject,
            projects: this.projects,
          });
        });
      },
      mounted() {
        document.querySelectorAll('a[href]').forEach((el) => {
          el.addEventListener('click', (e) => {
            vscode.postMessage({ command: 'click-link', uri: e.target.href });
          });
        });
        this.$refs.ui.jumpTo(initialData.page);
      },
    });

    app.$on('clipboard', (text) => {
      vscode.postMessage({
        command: 'clipboard',
        page: currentPage,
        project: currentProject,
        text,
      });
    });

    app.$on('select-project', (project) => {
      currentProject = project;
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

    app.$on('perform-install', (path, language) => {
      vscode.postMessage({ command: 'perform-install', path, language });
    });

    app.$on('generate-openapi', (projectPath) => {
      messages.rpc('generate-openapi', { projectPath });
    });

    app.$on('perform-auth', () => {
      vscode.postMessage({ command: 'perform-auth' });
    });

    messages.on('page', ({ page }) => {
      app.$refs.ui.jumpTo(page);
    });

    messages.on('projects', ({ projects }) => {
      app.projects = projects;
      app.$forceUpdate();
    });

    messages.on('analysis-toggle', (message) => {
      app.findingsEnabled = message.findingsEnabled;
      app.analysisEnabled = message.enabled;
      app.userAuthenticated = message.userAuthenticated;
      app.$forceUpdate();
    });
  });

  vscode.postMessage({ command: 'ready' });
}
