import '../mock/vscode';
import { expect } from 'chai';

import * as log from '../../../src/assets/log';

describe('assets log', () => {
  it('keeps the most recent lines', () => {
    for (let i = 0; i < 40; i++) log.info(`line ${i}`);
    log.warning('the reason');

    const lines = log.recentLines().split('\n');
    expect(lines).to.have.lengthOf(30);
    expect(lines[0]).to.match(/INFO +line 11$/);
    expect(lines[29]).to.match(/WARN +the reason$/);
  });

  it('leaves credentials out of URLs', () => {
    log.warning(
      'Failed to request https://user:secret@mirror.example.com/appmap-latest.json?token=abc#x: got status 403'
    );
    log.info('Fetched manifest from file:///mnt/share/appmap-latest.json (version 3.206.0)');

    const lines = log.recentLines().split('\n');
    expect(lines[28]).to.match(
      /Failed to request https:\/\/mirror\.example\.com\/appmap-latest\.json: got status 403$/
    );
    expect(lines[29]).to.match(/from file:\/\/\/mnt\/share\/appmap-latest\.json \(version/);
    expect(lines.join('\n')).not.to.match(/secret|token|user/);
  });
});
