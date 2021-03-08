import Vue from 'vue';
import { default as plugin } from '@appland/appmap'; // eslint-disable-line import/no-named-default

export { default as mountDiff } from './diffView';
export { default as mountApp } from './appmapView';

Vue.use(plugin);
