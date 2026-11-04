import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, verify as verifySignature } from 'node:crypto';
import { createAlipayCheckout } from '../functions/_lib/alipay.js';
const db = (enabled = 1) => ({ prepare: () => ({ first: async () => ({ enabled, gateway_url: 'https://openapi.alipay.com/gateway.do' }) }) });
function makeKeys() { return generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } }); }
const baseEnv = (privateKey) => ({ ALIPAY_APP_ID: '2021000000000001', ALIPAY_PRIVATE_KEY: privateKey, ALIPAY_NOTIFY_URL: 'https://pay.example.com/api/v2/alipay/notify', ALIPAY_USDT_CNY_RATE: '7.20' });
test('Alipay PC checkout creates a signed official page-pay URL', async () => {
 const keys=makeKeys(), result=await createAlipayCheckout({env:baseEnv(keys.privateKey),db:db(),tradeNo:'QT123456',subject:'ORDER-1',amountMicro:2500000,payType:'alipay'});
 assert.equal(result.ok,true); const url=new URL(result.checkoutUrl);
 assert.equal(url.origin,'https://openapi.alipay.com'); assert.equal(url.searchParams.get('method'),'alipay.trade.page.pay'); assert.equal(url.searchParams.get('sign_type'),'RSA2'); assert.equal(result.amountCny,'18.00');
 const signature=url.searchParams.get('sign'), params=Object.fromEntries(url.searchParams.entries()); delete params.sign;
 const canonical=Object.keys(params).sort().map(k=>k+'='+params[k]).join('&');
 assert.equal(verifySignature('RSA-SHA256',Buffer.from(canonical),keys.publicKey,Buffer.from(signature,'base64')),true);
 const biz=JSON.parse(url.searchParams.get('biz_content')); assert.equal(biz.total_amount,'18.00'); assert.equal(biz.product_code,'FAST_INSTANT_TRADE_PAY');
});
test('Alipay H5 checkout uses wap.pay and QUICK_WAP_WAY', async () => {
 const keys=makeKeys(), result=await createAlipayCheckout({env:baseEnv(keys.privateKey),db:db(),tradeNo:'QT123457',subject:'ORDER-2',amountMicro:1000000,payType:'alipay_h5'});
 assert.equal(result.ok,true); const url=new URL(result.checkoutUrl); assert.equal(url.searchParams.get('method'),'alipay.trade.wap.pay'); assert.equal(JSON.parse(url.searchParams.get('biz_content')).product_code,'QUICK_WAP_WAY');
});
test('missing Alipay credentials fail explicitly', async () => {
 const result=await createAlipayCheckout({env:{},db:db(),tradeNo:'QT123458',subject:'ORDER-3',amountMicro:1000000,payType:'alipay'});
 assert.equal(result.ok,false); assert.equal(result.code,'ALIPAY_CONFIG_MISSING');
 assert.deepEqual(result.missing,['ALIPAY_APP_ID','ALIPAY_PRIVATE_KEY','ALIPAY_NOTIFY_URL','ALIPAY_USDT_CNY_RATE']);
});
test('disabled Alipay provider is rejected', async () => {
 const result=await createAlipayCheckout({env:{},db:db(0),tradeNo:'QT123459',subject:'ORDER-4',amountMicro:1000000,payType:'alipay'});
 assert.equal(result.code,'ALIPAY_DISABLED');
});
