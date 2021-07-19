import Vue from 'vue';
import { VQuickstart } from '@appland/components';
import '@appland/diagrams/dist/style.css';
import MessagePublisher from './messagePublisher';

const STEPS = {
  1: 'INSTALL_AGENT',
  2: 'CREATE_CONFIGURATION',
  3: 'RECORD_APPMAP',
};

export default function mountApp() {
  const vscode = window.acquireVsCodeApi();
  const messages = new MessagePublisher(vscode);

  messages
    .on('init', (event) => {
      const app = new Vue({
        el: '#app',
        render(h) {
          return h(VQuickstart, {
            ref: 'ui',
            props: {
              steps: this.steps,
              appmaps: this.appmaps,
              appmapYmlSnippet: this.appmapYmlSnippet,
              appmapsProgress: this.appmapsProgress,
              testFrameworks: this.testFrameworks,
              initialStep: this.initialStep,
              language: this.language,
              installSnippets: this.installSnippets,
              async onAction(language, step, data) {
                const milestone = STEPS[step];
                if (!milestone) {
                  return;
                }

                await messages.rpc('milestoneAction', { language, milestone, data });
              },
            },
          });
        },
        data() {
          return {
            steps: event.steps,
            appmaps: event.appmaps,
            appmapYmlSnippet: event.appmapYmlSnippet,
            testFrameworks: event.testFrameworks,
            initialStep: event.initialStep,
            appmapsProgress: 0,
            language: event.language,
            installSnippets: {
              ruby: "gem 'appmap', :groups => [:development, :test]",
            },
          };
        },
      });

      app.$on('viewAppmapYml', () => {
        vscode.postMessage({ command: 'openFile', file: 'appmap.yml' });
      });

      app.$on('openLocalAppmaps', () => {
        vscode.postMessage({ command: 'focus' });
      });

      app.$on('openAppmap', (file) => {
        vscode.postMessage({ command: 'openFile', file });
      });

      messages
        .on('milestoneUpdate', ({ state, index }) => {
          app.$set(app.steps, index, { ...app.steps[index], state });
        })
        .on('agentInfo', ({ appmapYmlSnippet, testFrameworks }) => {
          app.appmapYmlSnippet = appmapYmlSnippet;
          app.testFrameworks = testFrameworks;
        })
        .on('appmapSnapshot', ({ appmaps }) => {
          app.appmapsProgress = appmaps?.length || 0;
          app.appmaps = appmaps;
        })
        .on('milestoneSnapshot', ({ steps }) => {
          app.steps = steps;
        })
        .on('changeMilestone', ({ milestoneIndex }) => {
          app.$refs.ui.currentStep = milestoneIndex;
        })
        .on('milestoneError', ({ index, errors }) => {
          app.$set(app.steps, index, {
            state: 'error',
            errors,
          });
        });

      vscode.postMessage({ command: 'postInitialize' });
    })
    .on(undefined, (event) => {
      throw new Error(`unhandled message type: ${event.type}`);
    });

  vscode.postMessage({ command: 'preInitialize' });
}
