import { verifyNzzfParams, isFreshNzzfTimestamp } from '../../../../_lib/nzzf.js';
import { amountToCents, calculateNetCredit } from '../../../../_lib/nzzf-provider.js';

const reply = (value) => new Response(value, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
const fail = () => reply('failure');

export async function onRequestGet({ request, env }) {
  if (!env.AUTH_DB || !env.NZZF_PID || !env.NZZF_PLATFORM_PUBLIC_KEY) return fail();
  const url = new URL(request.url);
  const params = {};
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    if (values.length !== 1) return fail();
    params[key] = values[0];
  }
  try {
    if (String(params.pid || '') !== String(env.NZZF_PID) ||
        String(params.sign_type || '').toUpperCase() !== 'RSA' ||
        !isFreshNzzfTimestamp(params.timestamp) ||
        !(await verifyNzzfParams(params, env.NZZF_PLATFORM_PUBLIC_KEY))) return fail();
    if (String(params.type || '') !== 'alipay') return fail();
    if (String(params.trade_status || '') !== 'TRADE_SUCCESS') return reply('success');
    const outTradeNo = String(params.out_trade_no || '');
    const providerTradeNo = String(params.trade_no || '');
    if (!outTradeNo || !providerTradeNo || providerTradeNo.length < 8) return fail();

    const order = await env.AUTH_DB.prepare(
      "SELECT po.id, po.trade_no, po.out_trade_no, po.amount_micro, po.currency, po.status, po.provider_trade_no, po.pay_info, pm.user_id FROM payment_orders po JOIN pay_merchants pm ON pm.id = po.merchant_id WHERE po.trade_no = ? LIMIT 1"
    ).bind(outTradeNo).first();
    if (!order || order.currency !== 'USDT' || order.trade_no !== outTradeNo) return fail();
    let payInfo;
    try { payInfo = JSON.parse(order.pay_info || '{}'); } catch { return fail(); }
    if (payInfo.provider !== 'nzzf') return fail();
    const expectedCents = amountToCents(payInfo.amount_cny);
    const receivedCents = amountToCents(params.money);
    if (expectedCents === null || receivedCents === null || expectedCents !== receivedCents) return fail();
    if (order.status === 'paid') return order.provider_trade_no === providerTradeNo ? reply('success') : fail();
    if (order.status !== 'pending') return fail();

    const feeRateBps = Number(env.NZZF_FEE_RATE_BPS ?? env.ALIPAY_FEE_RATE_BPS);
    if (!Number.isInteger(feeRateBps) || feeRateBps < 0 || feeRateBps > 9999) return fail();
    const { feeMicro, creditMicro } = calculateNetCredit(order.amount_micro, feeRateBps);
    if (!Number.isSafeInteger(creditMicro) || creditMicro <= 0) return fail();
    const now = Math.floor(Date.now() / 1000);
    const ledgerId = crypto.randomUUID().replace(/-/g, '');
    const entryNo = 'NZZF' + order.trade_no;
    const description = '晴天支付订单入账 ' + order.out_trade_no + '（扣除手续费 ' + feeRateBps + ' bps）';
    const results = await env.AUTH_DB.batch([
      env.AUTH_DB.prepare("UPDATE payment_orders SET status = 'paid', provider_trade_no = ?, paid_at = ?, fee_cents = ?, credit_cents = ? WHERE id = ? AND status = 'pending'")
        .bind(providerTradeNo, now, Math.round(feeMicro / 10000), Math.round(creditMicro / 10000), order.id),
      env.AUTH_DB.prepare(
        "INSERT INTO merchant_ledger (id, user_id, entry_no, direction, amount_micro, balance_after_micro, currency, category, description, related_type, related_id, created_at) " +
        "SELECT ?, ?, ?, 'credit', ?, COALESCE((SELECT balance_after_micro FROM merchant_ledger WHERE user_id = ? AND currency = 'USDT' ORDER BY created_at DESC, rowid DESC LIMIT 1), 0) + ?, 'USDT', 'payment_credit', ?, 'payment_order', ?, ? " +
        "WHERE EXISTS (SELECT 1 FROM payment_orders WHERE id = ? AND status = 'paid' AND provider_trade_no = ?) " +
        "AND NOT EXISTS (SELECT 1 FROM merchant_ledger WHERE user_id = ? AND related_type = 'payment_order' AND related_id = ?)"
      ).bind(ledgerId, order.user_id, entryNo, creditMicro, order.user_id, creditMicro, description, order.id, now, order.id, providerTradeNo, order.user_id, order.id)
    ]);
    const updated = Number(results?.[0]?.meta?.changes || 0);
    const credited = Number(results?.[1]?.meta?.changes || 0);
    if (updated === 0 && credited === 0) {
      const current = await env.AUTH_DB.prepare('SELECT status, provider_trade_no FROM payment_orders WHERE id = ?').bind(order.id).first();
      return current?.status === 'paid' && current.provider_trade_no === providerTradeNo ? reply('success') : fail();
    }
    return reply('success');
  } catch (error) {
    console.error('[nzzf:notify]', String(error?.message || error).slice(0, 180));
    return fail();
  }
}
