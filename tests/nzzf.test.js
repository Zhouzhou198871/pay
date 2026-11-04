import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createSign } from 'node:crypto';
import {
  canonicalNzzfParams,
  isFreshNzzfTimestamp,
  verifyNzzfParams
} from '../functions/_lib/nzzf.js';
import { amountToCents, calculateNetCredit } from '../functions/_lib/nzzf-provider.js';

test('NZZF canonical string excludes signature fields, empty values and objects', () => {
  assert.equal(
    canonicalNzzfParams({
      z: 'last', sign: 'ignored', sign_type: 'RSA', empty: '',
      absent: null, nested: { x: 1 }, a: 'first', count: 0
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

test('NZZF callback signature verifies and rejects tampering', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' }
  });
  const params = { pid: '10001', out_trade_no: 'QT12345678', money: '12.34', timestamp: '1783000000', sign_type: 'RSA' };
  const signer = createSign('RSA-SHA256');
  signer.update(canonicalNzzfParams(params));
  signer.end();
  params.sign = signer.sign(privateKey, 'base64');
  assert.equal(await verifyNzzfParams(params, publicKey), true);
  assert.equal(await verifyNzzfParams({ ...params, money: '12.35' }, publicKey), false);
});

test('NZZF amount reconciliation uses exact integer cents', () => {
  assert.equal(amountToCents('12'), 1200);
  assert.equal(amountToCents('12.3'), 1230);
  assert.equal(amountToCents('12.34'), 1234);
  assert.equal(amountToCents('12.345'), null);
  assert.equal(amountToCents('-1.00'), null);
});

test('NZZF net credit uses integer micro-USDT and bounded fee rates', () => {
  assert.deepEqual(calculateNetCredit(1000000, 1000), { feeMicro: 100000, creditMicro: 900000 });
});
