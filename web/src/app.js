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
  body.appendChild(div);
  modules[moduleName]();
}
