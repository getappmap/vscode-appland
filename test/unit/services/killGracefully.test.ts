import { expect } from 'chai';
import { EventEmitter } from 'events';
import Sinon from 'sinon';

import { killGracefully } from '../../../src/services/killGracefully';

class FakeProcess extends EventEmitter {
  kill = Sinon.stub().returns(true);
}

describe('killGracefully', () => {
  afterEach(() => Sinon.restore());

  it('resolves once the process exits, without escalating to SIGKILL', async () => {
    const clock = Sinon.useFakeTimers();
    try {
      const proc = new FakeProcess();

      const result = killGracefully(proc as never);
      proc.emit('exit');
      clock.tick(0);

      expect(await result).to.be.true;
      expect(proc.kill.callCount).to.equal(1);

      // No pending SIGKILL escalation should remain.
      clock.tick(5000);
      expect(proc.kill.callCount).to.equal(1);
    } finally {
      clock.restore();
    }
  });

  it('escalates to SIGKILL after the timeout if the process does not exit', async () => {
    const clock = Sinon.useFakeTimers();
    try {
      const proc = new FakeProcess();

      const result = killGracefully(proc as never, 1000);
      clock.tick(1000);

      expect(proc.kill.callCount).to.equal(2);
      expect(proc.kill.secondCall.calledWith('SIGKILL')).to.be.true;

      proc.emit('exit');
      expect(await result).to.be.true;
    } finally {
      clock.restore();
    }
  });

  it('returns false immediately if kill() reports the process was already dead', async () => {
    const clock = Sinon.useFakeTimers();
    try {
      const proc = new FakeProcess();
      proc.kill.returns(false);

      const result = await killGracefully(proc as never);

      expect(result).to.be.false;

      // The kill-timer must have been cleared; ticking past its threshold must not re-invoke kill().
      clock.tick(5000);
      expect(proc.kill.callCount).to.equal(1);
    } finally {
      clock.restore();
    }
  });
});
