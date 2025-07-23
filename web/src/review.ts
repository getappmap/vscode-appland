import Vue from 'vue';

import { VReview, ReviewBackend } from '@appland/components';

import MessagePublisher from './messagePublisher';

const EVENTS = ['open-location', 'show-navie-thread', 'view-recording-instructions'];

export default function mountReview() {
  const vscode = window.acquireVsCodeApi();
  const messages = new MessagePublisher(vscode);

  messages.on('init', ({ rpcPort, baseRef }) => {
    const app = new Vue({
      el: '#app',
      render: (h) =>
        h(VReview, {
          ref: 'review',
        }),
    });

    const reviewComponent = app.$refs.review as VReview;

    EVENTS.forEach((event) => {
      app.$on(event, (...args) => vscode.postMessage([event, ...args]));
    });

    const backend = new ReviewBackend(reviewComponent, { rpcPort });
    backend.startReview(baseRef);
  });

  vscode.postMessage('ready');
}
