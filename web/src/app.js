import Vue from 'vue';
import plugin from '@appland/components';
import mountApp from './appmapView';
import mountInstallGuide from './installGuideView';
import mountFindingsView from './findingsView';
import mountFindingInfoView from './findingsInfo';
import mountSignInView from './signInView';
import mountChatSearch from './chatSearchView';
import mountChatHelp from './chatHelp';

Vue.use(plugin);

const modules = {
  app: mountApp,
  'install-guide': mountInstallGuide,
  'findings-view': mountFindingsView,
  'finding-info-view': mountFindingInfoView,
  'sign-in-view': mountSignInView,
  'chat-search': mountChatSearch,
  'chat-help': mountChatHelp,
};

const { body } = document;

const moduleName = body.dataset.appmapModule;

if (moduleName in modules) {
  const div = document.createElement('div');
  div.id = 'app';
  body.appendChild(div);
  modules[moduleName]();
}
