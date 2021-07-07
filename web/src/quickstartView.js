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

  vscode.postMessage({ command: 'ready' });
  messages
    .on('init', (event) => {
      const { language: detectedLanguage, completedSteps } = event;
      const app = new Vue({
        el: '#app',
        render: (h) =>
          h(VQuickstart, {
            ref: 'ui',
            props: {
              completedSteps,
              language: detectedLanguage,
              async onAction(language, step) {
                const milestone = STEPS[step];
                if (!milestone) {
                  return true;
                }

                await messages.rpc('milestoneAction', { language, milestone });
                return true;
              },
            },
          }),
      });
    })
    .on(undefined, (event) => {
      throw new Error(`unhandled message type: ${event.type}`);
    });
}
