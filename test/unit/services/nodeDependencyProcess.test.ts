import mockery from 'mockery';
mockery.registerMock('vscode', {});
mockery.enable({ warnOnUnregistered: false });
import { ProcessLog } from '../../../src/services/nodeDependencyProcess';
mockery.disable();

import { expect } from 'chai';
import { PassThrough } from 'stream';
import sinon from 'sinon';
import { ChildProcessWithoutNullStreams } from 'child_process';

describe('ProcessLog', function() {
  it('saves all the messages with saveOutput = true', function() {
    const logged = ProcessLog.appendLogger(makeMockProcess(), undefined, true);

    for (const [i] of Array(32).entries()) {
      logged.stdout.push(`${i} in output`);
      logged.stderr.push(`${i} in error`);
    }

    const messages = logged.log.toString().split('\n');

    expect(messages)
      .to.have.lengthOf(64)
      .and.to.include('Stdout: 0 in output')
      .and.include('Stderr: 31 in error');
  });

  it('saves some last output for debugging, even with saveOutput = false', function() {
    const logged = ProcessLog.appendLogger(makeMockProcess(), undefined, false);

    for (const [i] of Array(32).entries()) {
      logged.stdout.push(`${i} in output`);
      logged.stderr.push(`${i} in error`);
    }

    const messages = logged.log.toString().split('\n');

    expect(messages.length)
      .to.be.at.least(10)
      .and.lessThan(32);
    expect(messages)
      .to.include('Stderr: 31 in error')
      .and.not.to.include('Stdout: 0 in output');
  });
});

function makeMockProcess(): ChildProcessWithoutNullStreams {
  const process = (sinon.mock() as unknown) as ChildProcessWithoutNullStreams & { log: undefined };
  process.log = undefined;
  process.stdout = new PassThrough();
  process.stderr = new PassThrough();
  return process;
}

after(sinon.restore);
