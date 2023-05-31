import { expect } from 'chai';
import links from '../../../src/tree/links';
import http from 'node:http';
import https from 'node:https';

type CheckPromise = Promise<http.IncomingMessage> & {
  link?: string;
};

function check(link: string): CheckPromise {
  const req = https.request(link, { method: 'HEAD' });
  const promise: CheckPromise = new Promise<http.IncomingMessage>((resolve, reject) => {
    req.once('response', resolve);
    req.once('error', reject);
  });
  req.end();
  promise.link = link;
  return promise;
}

describe('documentation links @online', () => {
  const promises = Object.values(links.Documentation).map(({ link }) => check(link));
  for (const promise of promises) {
    const { link } = promise;
    it(`should validate ${link}`, async () => {
      const { statusCode } = await promise;
      expect(statusCode).to.be.lessThan(400);
    });
  }
});
