import Vue from 'vue';
import plugin from '@appland/components';

export { default as mountApp } from './appmapView';
export { default as mountInstallGuide } from './installGuideView';
export { default as mountOpenAppmaps } from './openAppMapsView';

Vue.use(plugin);
