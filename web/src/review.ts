import Vue from 'vue';

import { VReview, ReviewStream } from '@appland/components';

import MessagePublisher from './messagePublisher';

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

    const stream = ReviewStream.fromRpc(rpcPort, baseRef);
    stream.on('update', () => {
      reviewComponent.features = stream.features;
      reviewComponent.suggestions = stream.suggestions;
    });
  });
}
