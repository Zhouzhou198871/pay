import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalNzzfParams,
  isFreshNzzfTimestamp
} from '../functions/_lib/nzzf.js';

test('NZZF canonical string excludes signature fields, empty values and objects', () => {
  assert.equal(
    canonicalNzzfParams({
      z: 'last',
      sign: 'ignored',
      sign_type: 'RSA',
      empty: '',
      absent: null,
      nested: { x: 1 },
      a: 'first',
      count: 0
    }),
    'a=first&count=0&z=last'
  );
});

test('NZZF timestamp must be 10 digits and within five minutes', () => {
  const now = 1783000000;
  assert.equal(isFreshNzzfTimestamp(String(now), now), true);
  assert.equal(isFreshNzzfTimestamp(String(now - 300), now), true);
  assert.equal(isFreshNzzfTimestamp(String(now - 301), now), false);
  assert.equal(isFreshNzzfTimestamp('12345', now), false);
});
