import Vue from 'vue';
import { VSidebarSignIn } from '@appland/components';
import MessagePublisher from './messagePublisher';

export default function mountSignInView() {
  document.body.style = 'height: 100%; margin: 0; overflow-y: scroll;';

  const vscode = window.acquireVsCodeApi();
  const messages = new MessagePublisher(vscode);

  const app = new Vue({
    el: '#app',
    render(h) {
      return h(VSidebarSignIn, {
        ref: 'ui',
      });
    },
  });

  app.$on('sign-in', () => {
    messages.rpc('sign-in');
  });

  app.$on('click-sign-in-link', (linkType) => {
    messages.rpc('click-sign-in-link', linkType);
  });
}
