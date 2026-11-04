import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { canonicalV2Params, verifyV2Signature, isFreshV2Timestamp } from '../functions/_lib/v2-signature.js';

const toPem = (label, bytes) => {
  const b64 = Buffer.from(bytes).toString('base64');
  return '-----BEGIN ' + label + '-----\n' + b64.match(/.{1,64}/g).join('\n') + '\n-----END ' + label + '-----';
};

test('V2 canonical string sorts keys in ASCII order and omits sign only', () => {
  assert.equal(canonicalV2Params({ z: '9', amount: '1.25', sign: 'ignored', merchant_no: '123456', empty: '' }), 'amount=1.25&empty=&merchant_no=123456&z=9');
});

test('RSA-2048 SHA256withRSA signature verifies with merchant public key', async () => {
  const pair = await webcrypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash: 'SHA-256' }, true, ['sign','verify']);
  const privateDer = await webcrypto.subtle.exportKey('pkcs8', pair.privateKey);
  const publicDer = await webcrypto.subtle.exportKey('spki', pair.publicKey);
  const privateKey = await webcrypto.subtle.importKey('pkcs8', privateDer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const params = { merchant_no: '123456', out_trade_no: 'ORDER-1', amount: '1.25', timestamp: '1790000000' };
  const signature = await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(canonicalV2Params(params)));
  const signatureBase64 = Buffer.from(signature).toString('base64');
  assert.equal(await verifyV2Signature({ ...params, sign: signatureBase64 }, toPem('PUBLIC KEY', publicDer), signatureBase64), true);
  assert.equal(await verifyV2Signature({ ...params, amount: '9.99', sign: signatureBase64 }, toPem('PUBLIC KEY', publicDer), signatureBase64), false);
});

test('V2 timestamp must be a 10-digit Unix timestamp within five minutes', () => {
  assert.equal(isFreshV2Timestamp('1790000000', 1790000300), true);
  assert.equal(isFreshV2Timestamp('1790000000', 1790000301), false);
  assert.equal(isFreshV2Timestamp('1790000000000', 1790000000), false);
});