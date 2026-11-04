import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { ensurePlatformKeyPair, canonicalPlatformParams, signPlatformCallback } from '../functions/_lib/platform-signature.js';

function fakeDb() {
  let row = null;
  return {
    prepare(sql) {
      return {
        first: async () => row ? { public_key: row.public_key, private_key_ciphertext: row.private_key_ciphertext } : null,
        bind(publicKey, ciphertext, createdAt, updatedAt) {
          return { run: async () => { if (!row) row = { public_key: publicKey, private_key_ciphertext: ciphertext, created_at: createdAt, updated_at: updatedAt }; } };
        }
      };
    }
  };
}
function pemDer(value) {
  const body = value.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g, '');
  return Uint8Array.from(atob(body), c => c.charCodeAt(0));
}
test('platform keypair is generated once and callback signatures verify with public key', async () => {
  const db = fakeDb(), secret = 'test-only-auth-secret-for-platform-key-tests';
  const publicPem = await ensurePlatformKeyPair(db, secret);
  assert.match(publicPem, /BEGIN PUBLIC KEY/);
  assert.equal(await ensurePlatformKeyPair(db, secret), publicPem);
  const params = { merchant_no: '123456', trade_no: 'QT001', out_trade_no: 'ORDER-1', amount: '12.50', status: 'paid', timestamp: '1790000000', sign_type: 'RSA2' };
  assert.equal(canonicalPlatformParams({ ...params, sign: 'ignored' }), canonicalPlatformParams(params));
  const signature = await signPlatformCallback({ ...params, sign: 'old' }, db, secret);
  const publicKey = await webcrypto.subtle.importKey('spki', pemDer(publicPem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await webcrypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, Uint8Array.from(atob(signature), c => c.charCodeAt(0)), new TextEncoder().encode(canonicalPlatformParams(params)));
  assert.equal(valid, true);
  const invalid = await webcrypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, Uint8Array.from(atob(signature), c => c.charCodeAt(0)), new TextEncoder().encode(canonicalPlatformParams({ ...params, amount: '99.99' })));
  assert.equal(invalid, false);
});
