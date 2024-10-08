import Vue from 'vue';
import { VInstallGuide } from '@appland/components';
import '@appland/diagrams/dist/style.css';
import MessagePublisher from './messagePublisher';

export default function mountInstallGuide() {
  const vscode = window.acquireVsCodeApi();
  const messages = new MessagePublisher(vscode);

  messages.on('init', (initialData) => {
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
            javaAgentStatus: 2, // hard coded as 'success' - the JAR is bundled, it can't fail.
            featureFlags: new Set(['ar-python']),
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
      mounted() {
        document.querySelectorAll('a[href]').forEach((el) => {
          el.addEventListener('click', (e) => {
            vscode.postMessage({ command: 'click-link', uri: e.target.href });
          });
        });
      },
    });

    app.$on('clipboard', (text) => {
      vscode.postMessage({
        command: 'clipboard',
        project: currentProject,
        text,
      });
    });

    app.$on('select-project', (project) => {
      currentProject = project;
    });

    app.$on('open-navie', () => {
      messages.rpc('open-navie');
    });

    app.$on('perform-install', (path, language) => {
      vscode.postMessage({ command: 'perform-install', path, language });
    });

    app.$on('view-output', () => {
      vscode.postMessage({ command: 'view-output' });
    });

    app.$on('submit-to-navie', (suggestion) => {
      vscode.postMessage({ command: 'submit-to-navie', suggestion });
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
