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
            userAuthenticated: this.userAuthenticated,
            javaAgentStatus: this.javaAgentStatus,
            featureFlags: new Set(['ar-python']),
            displayAiHelp: true,
          },
        });
      },
      data() {
        return {
          projects: initialData.projects,
          analysisEnabled: initialData.analysisEnabled,
          userAuthenticated: initialData.userAuthenticated,
          javaAgentStatus: initialData.javaAgentStatus,
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

    app.$on('open-findings-overview', () => {
      messages.rpc('open-findings-overview');
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

    app.$on('perform-auth', () => {
      vscode.postMessage({ command: 'perform-auth' });
    });

    app.$on('add-java-configs', (projectPath) => {
      vscode.postMessage({ command: 'add-java-configs', projectPath });
    });

    app.$on('view-output', () => {
      vscode.postMessage({ command: 'view-output' });
    });

    app.$on('ai-help', () => {
      vscode.postMessage({ command: 'ai-help' });
    });

    messages.on('page', ({ page }) => {
      app.$refs.ui.jumpTo(page);
    });

    messages.on('projects', ({ projects }) => {
      app.projects = projects;
      app.$forceUpdate();
    });

    messages.on('analysis-toggle', (message) => {
      app.analysisEnabled = message.enabled;
      app.userAuthenticated = message.userAuthenticated;
      app.$forceUpdate();
    });

    messages.on('java-agent-download-status', (message) => {
      app.javaAgentStatus = message.status;
      app.$forceUpdate();
    });
  });

  vscode.postMessage({ command: 'ready' });
}
