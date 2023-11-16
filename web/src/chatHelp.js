import Vue from 'vue';
import { VChat } from '@appland/components';
import MessagePublisher from './messagePublisher';

export default function mountChatHelp() {
  document.body.style = 'height: 100%; margin: 0; overflow-y: scroll;';

  const vscode = window.acquireVsCodeApi();
  const messages = new MessagePublisher(vscode);

  messages.on(
    'init',
    ({ apiKey }) =>
      new Vue({
        el: '#app',
        render(h) {
          return h(VChat, {
            ref: 'chat',
            props: {
              apiKey,
              apiUrl: 'https://api.getappmap.com', // TODO: this should not be needed
              suggestions: [
                {
                  title: 'How to Install AppMap',
                  subTitle: 'Step-by-Step Installation Guide',
                  prompt:
                    'Ask me how to install AppMap in your development environment for a detailed guide.',
                },
                {
                  title: 'Setting Up AppMap',
                  subTitle: 'Configuring for the First Time',
                  prompt: 'Need help configuring AppMap after installation? Just ask me!',
                },
                {
                  title: 'Integrating AppMap with Your Projects',
                  subTitle: 'Effective Integration Tips',
                  prompt:
                    'Inquire about integrating AppMap into your existing projects for successful implementation.',
                },
                {
                  title: 'Solving AppMap Installation Issues',
                  subTitle: 'Overcoming Common Challenges',
                  prompt:
                    'Encountering installation issues with AppMap? Ask me for solutions to common problems.',
                },
                {
                  title: 'Enhancing AppMap Performance',
                  subTitle: 'Tips for Large-Scale Projects',
                  prompt:
                    'Want to optimize AppMap for large projects? I can provide tips on enhancing its performance.',
                },
              ],
            },
          });
        },
      })
  );

  vscode.postMessage({ command: 'ready' });
  console.log('emitting ready');
}
