import { expect } from 'chai';
import dictEqual from '../../../src/lib/dictEqual';
import { format } from 'util';

describe('dictEqual()', () => {
  const dict = { a: 5 };
  const equal = [
    [undefined, undefined],
    [{}, {}],
    [{ a: 5 }, { a: 5 }],
    [{ a: 5 }, dict],
    [{ ...dict }, dict],
    [dict, dict],
  ];

  const unequal = [
    [undefined, dict],
    [undefined, {}],
    [{}, { a: 6 }],
    [{ a: 5 }, { a: 6 }],
    [{ a: 5 }, { b: 5 }],
    [{ a: 5 }, { a: 5, b: 5 }],
  ];

  for (const [xs, ys] of equal)
    it(format('compares %o and %o equal', xs, ys), () => expect(dictEqual(xs, ys)).to.equal(true));
  for (const [xs, ys] of unequal)
    it(format('compares %o and %o unequal', xs, ys), () =>
      expect(dictEqual(xs, ys)).to.equal(false)
    );
});
