import Vue from 'vue';
import { default as plugin } from '@appland/components'; // eslint-disable-line import/no-named-default

export { default as mountApp } from './appmapView'; // eslint-disable-line import/prefer-default-export

Vue.use(plugin);
