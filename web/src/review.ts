import Vue from 'vue';

import { VReview, ReviewStream } from '@appland/components';
import StaticReview from './review.json';

import MessagePublisher from './messagePublisher';
import { threadId } from 'worker_threads';

const getCategory = (finding, rule) => {
  if (finding.event.sql_query) {
    return 'sql';
  }
  if (finding.event.http_server_request) {
    return 'http';
  }
  return rule.impactDomain.toLowerCase();
};

const merge = (a: { id: string }[], b: { id: string }[]) =>
  Array.from(
    a
      .concat(b)
      .reduce((acc, suggestion) => {
        acc.set(suggestion.id, suggestion);
        return acc;
      }, new Map<string, any>())
      .values()
  );

const getLocation = (finding) => {
  if (finding.stack) {
    // Find the first stack frame that has a valid (or no) line number
    const location = finding.stack.find((l) => !l.endsWith(':-1'));
    if (location) return location;
  }
  if (finding.event.sql_query?.sql) {
    return finding.event.sql_query.sql;
  }
  if (finding.event.http_server_request) {
    const { http_server_request: req } = finding.event;
    if (req) {
      return `${req.request_method} ${req.normalized_path_info}`;
    }
  }
  return '';
};

const getUniqueFindings = (findings) =>
  Array.from(
    findings
      .map(({ rule, finding }) => ({
        id: finding.hash,
        title: rule.title,
        category: getCategory(finding, rule),
        type: rule.impactDomain.toLowerCase(),
        location: getLocation(finding),
        runtime: {
          stackTrace: finding.stack
            .filter((frame) => !frame.endsWith(':-1'))
            .map((frame) => `at ${frame}`)
            .join('\n'),
          appMapReferences: [
            {
              path: finding.appMapFile,
              name: finding.appMapFile.split(/[/\\]/).pop(),
              findingHash: finding.hash_v2,
            },
          ],
          finding: { ...finding, description: rule.description },
        },
      }))
      .reduce((acc, finding) => {
        acc.set(finding.id, finding);
        return acc;
      }, new Map<string, any>())
      .values()
  );

export default function mountReview() {
  const vscode = window.acquireVsCodeApi();
  const messages = new MessagePublisher(vscode);

  messages.on('init', ({ findings, rpcPort }) => {
    const app = new Vue({
      el: '#app',
      data() {
        return { loading: true, suggestions: getUniqueFindings(findings), features: [] };
      },
      render(h) {
        return h(VReview, {
          ref: 'review',
          props: {
            loading: this.loading,
            suggestions: this.suggestions,
            features: this.features,
            appmapRpcPort: rpcPort,
          },
        });
      },
    });

    const reviewComponent = app.$refs.review as VReview;
    console.log(StaticReview);

    // const stream = ReviewStream.fromRpc(rpcPort, baseRef);
    // stream
    //   .on('update', () => {
    //     reviewComponent.features = stream.features;
    //     reviewComponent.suggestions = stream.suggestions;
    //   })
    //   .on('complete', () => {
    //     for (let i = 0; i < 10; ++i) {
    //       console.log(`### DONE ${i}`);
    //     }
    //     app.loading = false;
    //   });

    const randomTimeBetween = (min, max) => Math.random() * (max - min) + min;
    const featuresComplete = randomTimeBetween(7000, 12000);
    setTimeout(() => {
      app.features = StaticReview.features;
    }, featuresComplete);

    setTimeout(() => {
      const uniqueFindings = getUniqueFindings(findings);
      app.suggestions = merge(
        StaticReview.suggestions.filter((s) => !s.runtime),
        uniqueFindings
      );
      app.loading = false;
    }, featuresComplete + randomTimeBetween(2000, 4000));

    messages.on('update-findings', ({ findings }) => {
      const uniqueFindings = getUniqueFindings(findings);
      app.suggestions = merge(reviewComponent.suggestions ?? [], uniqueFindings);
    });

    app.$on('open-file', (path) => {
      vscode.postMessage({
        type: 'open-file',
        path,
      });
    });

    app.$on('open-appmap-finding', (path, findingHash) => {
      vscode.postMessage({
        type: 'open-appmap-finding',
        path,
        findingHash,
      });
    });

    app.$on('open-navie-thread', (threadId) => {
      vscode.postMessage({
        type: 'open-navie-thread',
        threadId,
      });
    });
  });

  vscode.postMessage({ type: 'ready' });
}
