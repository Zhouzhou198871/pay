import { nzzfPost } from './nzzf.js';

export function amountToCents(value) {
  const match = String(value ?? '').trim().match(/^(\\d{1,12})(?:\\.(\\d{1,2}))?$/);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
}

export function calculateNetCredit(amountMicro, feeRateBps) {
  const feeMicro = Math.round(Number(amountMicro) * Number(feeRateBps) / 10000);
  return { feeMicro, creditMicro: Number(amountMicro) - feeMicro };
}

export async function createNzzfCheckout({ env, tradeNo, subject, amountMicro, notifyUrl, returnUrl, clientIp }) {
  const rate = Number(env.NZZF_USDT_CNY_RATE || env.ALIPAY_USDT_CNY_RATE || 0);
  if (!Number.isFinite(rate) || rate <= 0) return { ok: false, code: 'NZZF_RATE_MISSING', message: 'NZZF_USDT_CNY_RATE 尚未配置。' };
  const amountCny = (Math.round((amountMicro / 1000000 * rate) * 100) / 100).toFixed(2);
  if (Number(amountCny) < 0.01) return { ok: false, code: 'NZZF_AMOUNT_INVALID', message: '折算后的人民币金额低于 0.01 元。' };
  try {
    const data = await nzzfPost({
      env, path: '/api/pay/create',
      params: { type: 'alipay', out_trade_no: tradeNo, notify_url: notifyUrl, return_url: returnUrl, name: String(subject || tradeNo).slice(0, 100), money: amountCny, ...(clientIp ? { clientip: clientIp } : {}) }
    });
    if (Number(data?.code) !== 0 || !data?.trade_no) return { ok: false, code: 'NZZF_CREATE_FAILED', message: '上游未成功创建订单。' };
    const upstreamQr = String(data.qrcode || data.payurl || '').trim();
    let parsed;
    try { parsed = new URL(upstreamQr); } catch { return { ok: false, code: 'NZZF_QR_INVALID', message: '上游未返回有效二维码收银台链接。' }; }
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'nzzf.org') return { ok: false, code: 'NZZF_QR_INVALID', message: '上游二维码链接域名不符合预期。' };
    return { ok: true, providerTradeNo: String(data.trade_no), amountCny, rate, qrContent: upstreamQr };
  } catch (error) {
    console.error('[nzzf:create]', String(error?.message || error).slice(0, 180));
    return { ok: false, code: 'NZZF_UNAVAILABLE', message: '支付通道暂不可用，请稍后重试。' };
  }
}
