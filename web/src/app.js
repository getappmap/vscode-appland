import plugin from '@appland/components';
import Vue from 'vue';
import mountApp from './appmapView';
import mountChatSearch from './chatSearchView';
import mountFindingInfoView from './findingsInfo';
import mountFindingsView from './findingsView';
import mountInstallGuide from './installGuideView';
import mountSignInView from './signInView';

Vue.use(plugin);

const modules = {
  app: mountApp,
  'install-guide': mountInstallGuide,
  'findings-view': mountFindingsView,
  'finding-info-view': mountFindingInfoView,
  'sign-in-view': mountSignInView,
  'chat-search': mountChatSearch,
};

const { body } = document;

const moduleName = body.dataset.appmapModule;

if (moduleName in modules) {
  const div = document.createElement('div');
  div.id = 'app';

  // Well, this is kind of gross. To make sure that focus is managed properly, we need to work around two bugs in the
  // way VS Code handles focus for a webview.
  //
  // The first is that, after activating the tab with the webview, it sets the focus to the containing iframe, which is
  // our `window`. We add a listener to watch for the focus shift. When it happens, we look for an element with the
  // data attribute `focus`. If we find one, and it doesn't have focus, we focus it.
  //
  // The second bug is that, some time after VS Code sets the focus to the iframe, it resets it to the top-level iframe
  // (the one our webview is embedded in). We don't have access to that window, so there's no way to add a listener to
  // it. Instead, after a short delay, we check to see if the element we focused still has focus. If it doesn't, we set
  // it again.
  //
  // As always, when you "fix" a problem with a delay, there's a chance that it will occasionally fail. But, this seems
  // to work well enough to be worthwhile.
  window.addEventListener('focus', () => {
    const elt = body.querySelector('[focus]');
    if (elt && document.activeElement !== elt) {
      elt.focus();
      setTimeout(() => {
        if (document.activeElement !== elt) {
          elt.focus();
        }
      }, 200);
    }
  });
  body.appendChild(div);
  modules[moduleName]();
}
