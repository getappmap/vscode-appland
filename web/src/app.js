import Vue from 'vue';
import plugin from '@appland/components';

export { default as mountApp } from './appmapView';
export { default as mountInstallGuide } from './installGuideView';
export { default as mountFindingsView } from './findingsView';
export { default as mountFindingInfoView } from './findingsInfo';
export { default as mountSignInView } from './signInView';

Vue.use(plugin);
