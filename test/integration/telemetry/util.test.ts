import { deepStrictEqual } from 'assert';
import { getRecords } from '../../../src/util';

describe('util', () => {
  describe('getRecords', () => {
    it('adds nested properties to the top level', async () => {
      const result = getRecords({ a: '1', b: { c: '2' } });
      deepStrictEqual(result, { a: '1', 'b.c': '2' });
    });

    it('appends a prefix', async () => {
      const result = getRecords({ a: '1', b: { c: '2' } }, 'example');
      deepStrictEqual(result, { 'example.a': '1', 'example.b.c': '2' });
    });

    it('transforms values if a transformer is provided', async () => {
      const result = getRecords<string>({ a: 1, b: { c: 2 } }, undefined, String);
      deepStrictEqual(result, { a: '1', 'b.c': '2' });
    });

    it('does not write undefined or null values', async () => {
      const result = getRecords<string>({ a: null, b: { c: undefined }, d: 1 }, undefined, String);
      deepStrictEqual(result, { d: '1' });
    });
  });
});
