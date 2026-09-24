import { expect } from 'chai';

import LineBuffer from '../../../src/services/lineBuffer';

describe('LineBuffer', () => {
  it('returns a single complete line', () => {
    const buffer = new LineBuffer();
    expect(buffer.push('hello\n')).to.deep.equal(['hello']);
  });

  it('holds a line until it is completed across chunks', () => {
    const buffer = new LineBuffer();
    expect(buffer.push('hel')).to.deep.equal([]);
    expect(buffer.push('lo\n')).to.deep.equal(['hello']);
  });

  it('does not re-return a line once consumed', () => {
    const buffer = new LineBuffer();
    expect(buffer.push('hello\n')).to.deep.equal(['hello']);
    expect(buffer.push('world\n')).to.deep.equal(['world']);
  });

  it('returns multiple lines from a single push', () => {
    const buffer = new LineBuffer();
    expect(buffer.push('one\ntwo\n')).to.deep.equal(['one', 'two']);
  });

  it('truncates the buffer to prevent unbounded growth on a massive line with no newline', () => {
    const buffer = new LineBuffer(1024);
    const massiveString = 'A'.repeat(2048);
    expect(buffer.push(massiveString)).to.deep.equal([]);
    expect(buffer.pending.length).to.equal(1024);
    expect(buffer.pending).to.equal('A'.repeat(1024));
  });
});
