import Vue from 'vue';
import { VSidebarSignIn } from '@appland/components';
import MessagePublisher from './messagePublisher';

export default function mountSignInView() {
  document.body.style = 'height: 100%; margin: 0; overflow-y: scroll;';

  const vscode = window.acquireVsCodeApi();
  const messages = new MessagePublisher(vscode);

  messages.on('init-sign-in', (initialData) => {
    const app = new Vue({
      el: '#app',
      render(h) {
        return h(VSidebarSignIn, {
          ref: 'ui',
          props: {
            appmapServerUrl: initialData.appmapServerUrl,
            enableOrgConfig: initialData.enableOrgConfig,
            orgConfigApplied: initialData.orgConfigApplied,
          },
        });
      },
    });

    app.$on('sign-in', (ssoTarget) => {
      messages.rpc('sign-in', ssoTarget);
    });

    app.$on('activate', (apiKey) => {
      messages.rpc('activate', apiKey);
    });

    app.$on('click-sign-in-link', (linkType) => {
      messages.rpc('click-sign-in-link', linkType);
    });

    app.$on('apply-org-config', async () => {
      // Generous timeout: the user may take a while in the file picker or URL prompt.
      const response = await messages.rpc('apply-org-config', undefined, 10 * 60 * 1000);
      if (response.applied) app.$refs.ui.onOrgConfigApplied();
    });
  });

  vscode.postMessage({ command: 'sign-in-ready' });
}
