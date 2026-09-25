import '../mock/vscode';

import { expect } from 'chai';

import { diagnoseWatcherExecutable } from '../../../src/services/reportProcessError';

describe('diagnoseWatcherExecutable', () => {
  it('diagnoses the binary a watcher runs', async () => {
    const diagnosis = await diagnoseWatcherExecutable({ binPath: '/nowhere/appmap' });

    expect(diagnosis).to.be.a('string');
    expect(JSON.parse(diagnosis as string)).to.include({ path: '/nowhere/appmap', missing: true });
  });

  // Running through node means the operating system judged node, not us. Whatever went
  // wrong will have been said on stderr, which the log already carries.
  it('asks nothing about a watcher running a node module', async () => {
    const diagnosis = await diagnoseWatcherExecutable({
      binPath: 'unused',
      modulePath: '/somewhere/cli.js',
    });

    expect(diagnosis).to.be.undefined;
  });
});
