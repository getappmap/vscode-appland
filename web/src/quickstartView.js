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
              stepsState: this.stepsState,
              appmapYmlSnippet: this.appmapYmlSnippet,
              appmapsProgress: this.appmapsProgress,
              testFrameworks: this.testFrameworks,
              initialStep: this.initialStep,
              language: this.language,
              installSnippets: this.installSnippets,
              async onAction(language, step) {
                const milestone = STEPS[step];
                if (!milestone) {
                  return;
                }

                await messages.rpc('milestoneAction', { language, milestone });
              },
            },
          });
        },
        data() {
          return {
            stepsState: event.stepsState,
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

      messages
        .on('milestoneUpdate', ({ state, index }) => {
          app.$set(app.stepsState, index, state);
        })
        .on('agentInfo', ({ newAppmapYmlSnippet, newTestFrameworks }) => {
          app.appmapYmlSnippet = newAppmapYmlSnippet;
          app.testFrameworks = newTestFrameworks;
        })
        .on('appmapCount', ({ count }) => {
          app.appmapsProgress = count;
        })
        .on('milestoneSnapshot', ({ state }) => {
          app.stepsState = state;
        })
        .on('changeMilestone', ({ milestoneIndex }) => {
          app.$refs.ui.currentStep = milestoneIndex;
        });

      vscode.postMessage({ command: 'postInitialize' });
    })
    .on(undefined, (event) => {
      throw new Error(`unhandled message type: ${event.type}`);
    });

  vscode.postMessage({ command: 'preInitialize' });
}
