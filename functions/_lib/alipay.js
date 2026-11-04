const encoder = new TextEncoder();
const DEFAULT_GATEWAY = 'https://openapi.alipay.com/gateway.do';
const pemBody = (value) => String(value || '').replace(/\\n/g, '\n').replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s/g, '');
function beijingTimestamp(date = new Date()) {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 19).replace('T', ' ');
}
async function importPrivateKey(pem) {
  const body = pemBody(pem);
  if (!body) throw new Error('ALIPAY_PRIVATE_KEY_INVALID');
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}
function canonical(params) {
  return Object.keys(params).filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .sort().map((key) => key + '=' + String(params[key])).join('&');
}
async function rsa2Sign(params, privatePem) {
  const key = await importPrivateKey(privatePem);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(canonical(params)));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}
function moneyCny(amountMicro, rate) {
  const amount = amountMicro / 1000000 * rate;
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('ALIPAY_AMOUNT_INVALID');
  return amount.toFixed(2);
}
export async function createAlipayCheckout({ env, db, tradeNo, subject, amountMicro, payType }) {
  const registry = await db.prepare("SELECT enabled, gateway_url FROM payment_providers WHERE provider = 'alipay' LIMIT 1").first();
  if (!registry || Number(registry.enabled) !== 1) return { ok: false, code: 'ALIPAY_DISABLED', message: '支付宝通道当前未启用，请联系平台管理员。' };
  const required = ['ALIPAY_APP_ID', 'ALIPAY_PRIVATE_KEY', 'ALIPAY_NOTIFY_URL', 'ALIPAY_USDT_CNY_RATE'];
  const missing = required.filter((key) => !String(env[key] || '').trim());
  if (missing.length) return { ok: false, code: 'ALIPAY_CONFIG_MISSING', message: '支付宝通道尚未配置完整，缺少：' + missing.join('、') + '。', missing };
  const appId = String(env.ALIPAY_APP_ID).trim();
  const notifyUrl = String(env.ALIPAY_NOTIFY_URL).trim();
  const returnUrl = String(env.ALIPAY_RETURN_URL || '').trim();
  const rate = Number(env.ALIPAY_USDT_CNY_RATE);
  if (!/^\d{16,32}$/.test(appId)) return { ok: false, code: 'ALIPAY_CONFIG_INVALID', message: 'ALIPAY_APP_ID 格式不正确。' };
  if (!Number.isFinite(rate) || rate <= 0 || rate > 100000) return { ok: false, code: 'ALIPAY_CONFIG_INVALID', message: 'ALIPAY_USDT_CNY_RATE 必须为大于 0 的有效汇率。' };
  try {
    const gateway = String(registry.gateway_url || env.ALIPAY_GATEWAY_URL || DEFAULT_GATEWAY).trim();
    const gatewayUrl = new URL(gateway);
    if (gatewayUrl.protocol !== 'https:' || !['openapi.alipay.com', 'openapi.alipaydev.com'].includes(gatewayUrl.hostname)) return { ok: false, code: 'ALIPAY_GATEWAY_INVALID', message: '支付宝网关地址不在允许的官方域名范围内。' };
    const isH5 = payType === 'alipay_h5';
    const params = {
      app_id: appId,
      method: isH5 ? 'alipay.trade.wap.pay' : 'alipay.trade.page.pay',
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: beijingTimestamp(),
      version: '1.0',
      notify_url: notifyUrl,
      ...(returnUrl ? { return_url: returnUrl } : {}),
      biz_content: JSON.stringify({
        out_trade_no: tradeNo,
        product_code: isH5 ? 'QUICK_WAP_WAY' : 'FAST_INSTANT_TRADE_PAY',
        total_amount: moneyCny(amountMicro, rate),
        subject: String(subject || tradeNo).slice(0, 128),
        timeout_express: '15m'
      })
    };
    const sign = await rsa2Sign(params, env.ALIPAY_PRIVATE_KEY);
    const query = new URLSearchParams({ ...params, sign });
    return { ok: true, checkoutUrl: gatewayUrl.origin + gatewayUrl.pathname + '?' + query.toString(), amountCny: JSON.parse(params.biz_content).total_amount, rate };
  } catch (error) {
    console.error('[alipay:checkout]', String(error?.message || error).slice(0, 180));
    return { ok: false, code: 'ALIPAY_SIGNING_FAILED', message: '支付宝下单签名失败，请检查应用私钥是否为 PKCS#8 RSA 私钥。' };
  }
}
