import '../mock/vscode';

import { expect } from 'chai';
import Sinon from 'sinon';

import RpcProcessWatcher from '../../../src/services/rpcProcessWatcher';

import MockExtensionContext from '../../mocks/mockExtensionContext';

class TestRpcProcessWatcher extends RpcProcessWatcher {
  // Expose the protected onStdout method for testing
  public feedStdout(data: string) {
    this.onStdout(data);
  }

  // Expose the stdoutBuffer for testing
  public getStdoutBuffer(): string {
    return this.stdoutBuffer;
  }
}

describe('RpcProcessWatcher', () => {
  let watcher: TestRpcProcessWatcher;
  let portChangeSpy: Sinon.SinonSpy;

  beforeEach(() => {
    watcher = new TestRpcProcessWatcher(new MockExtensionContext());
    portChangeSpy = Sinon.spy();
    watcher.onRpcPortChange(portChangeSpy);
  });

  afterEach(() => {
    watcher.dispose();
  });

  describe('stdout parsing', () => {
    it('fires port change when stdout contains the port', () => {
      watcher.feedStdout('Running JSON-RPC server on port: 1234\n');
      expect(portChangeSpy.calledOnceWith(1234)).to.be.true;
    });

    it('handles data chunks split across the port announcement', () => {
      watcher.feedStdout('Running JSON-RPC ');
      expect(portChangeSpy.called).to.be.false;

      watcher.feedStdout('server on port: 1234\n');
      expect(portChangeSpy.calledOnceWith(1234)).to.be.true;
    });

    it('does not fire multiple times for the same match if subsequent unrelated stdout arrives', () => {
      watcher.feedStdout('Running JSON-RPC server on port: 1234\n');
      expect(portChangeSpy.callCount).to.equal(1);

      // In the old broken implementation, this would trigger a second event
      // because the previous match was still in the buffer
      watcher.feedStdout('Some other log line\n');
      expect(portChangeSpy.callCount).to.equal(1);
    });

    it('fires multiple times if multiple port lines are received', () => {
      watcher.feedStdout(
        'Running JSON-RPC server on port: 1234\nRunning JSON-RPC server on port: 5678\n'
      );
      expect(portChangeSpy.calledTwice).to.be.true;
      expect(portChangeSpy.firstCall.calledWith(1234)).to.be.true;
      expect(portChangeSpy.secondCall.calledWith(5678)).to.be.true;
    });

    it('truncates the buffer to prevent memory leaks on massive contiguous lines', () => {
      // Feed a massive line without newlines
      const massiveString = 'A'.repeat(2048);
      watcher.feedStdout(massiveString);

      // The buffer should be truncated to the last 1024 characters
      const stdoutBuffer = watcher.getStdoutBuffer();
      expect(stdoutBuffer.length).to.equal(1024);
      expect(stdoutBuffer).to.equal('A'.repeat(1024));
    });
  });
});
