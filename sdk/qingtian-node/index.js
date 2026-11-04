import { createHash, createSign } from 'node:crypto';

export class QingtianPayClient {
  constructor({ baseUrl = 'https://pay.lynli.me', merchantNo, v1Key, v2PrivateKey }) {
    if (!merchantNo) throw new Error('merchantNo is required');
    this.baseUrl = baseUrl.replace(/\/$/, ''); this.merchantNo = String(merchantNo);
    this.v1Key = v1Key; this.v2PrivateKey = v2PrivateKey;
  }
  canonical(params, keepEmpty = false) {
    return Object.keys(params).filter(k => k !== 'sign' && params[k] !== undefined && params[k] !== null && (keepEmpty || params[k] !== ''))
      .sort((a,b) => a < b ? -1 : a > b ? 1 : 0).map(k => {
        if (typeof params[k] === 'object') throw new TypeError('Only scalar API parameters are supported');
        return k + '=' + String(params[k]);
      }).join('&');
  }
  signV1(params) {
    if (!this.v1Key) throw new Error('v1Key is required');
    return createHash('md5').update(this.canonical(params) + '&key=' + this.v1Key, 'utf8').digest('hex');
  }
  signV2(params) {
    if (!this.v2PrivateKey) throw new Error('v2PrivateKey is required');
    const signer = createSign('RSA-SHA256'); signer.update(this.canonical(params, true), 'utf8'); signer.end();
    return signer.sign(this.v2PrivateKey, 'base64');
  }
  createOrderV1(order) { return this.request('/api/v1/payments', order, false); }
  createOrderV2(order) { return this.request('/api/v2/payments', order, true); }
  async request(path, order, rsa) {
    const params = { ...order, merchant_no: this.merchantNo, timestamp: String(Math.floor(Date.now()/1000)) };
    params.sign = rsa ? this.signV2(params) : this.signV1(params);
    const response = await fetch(this.baseUrl + path, { method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'}, body:JSON.stringify(params), signal:AbortSignal.timeout(20000) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Qingtian API HTTP ' + response.status);
    return data;
  }
}
