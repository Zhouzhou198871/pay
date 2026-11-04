import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign as rsaSign } from 'node:crypto';
import { canonicalAlipayNotify, verifyAlipayNotify, amountToCents, calculateNetCredit } from '../functions/_lib/alipay-notify.js';
test('Alipay notify RSA2 verification excludes sign and sign_type', async () => {
 const pair=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
 const params={app_id:'2021000000000001',out_trade_no:'QT123456',total_amount:'1.00',trade_status:'TRADE_SUCCESS',sign_type:'RSA2'};
 const signature=rsaSign('RSA-SHA256',Buffer.from(canonicalAlipayNotify(params)),pair.privateKey).toString('base64');
 assert.equal(await verifyAlipayNotify({...params,sign:signature},pair.publicKey),true);
 assert.equal(await verifyAlipayNotify({...params,total_amount:'2.00',sign:signature},pair.publicKey),false);
 assert.equal(await verifyAlipayNotify({...params,sign_type:'RSA',sign:signature},pair.publicKey),false);
});
test('CNY amounts compare exactly to cents',()=>{assert.equal(amountToCents('0.01'),1);assert.equal(amountToCents('12.30'),1230);assert.equal(amountToCents('1.001'),null);});
test('fee is calculated in integer micro-USDT',()=>{assert.deepEqual(calculateNetCredit(1000000,100),{feeMicro:10000,creditMicro:990000});assert.deepEqual(calculateNetCredit(1000000,0),{feeMicro:0,creditMicro:1000000});});
