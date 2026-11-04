import { verifyAlipayNotify, amountToCents, calculateNetCredit } from '../../../_lib/alipay-notify.js';
const text = (value, status = 200) => new Response(value, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
const failure = () => text('failure', 400);
export async function onRequestPost({ request, env }) {
  if (!env.AUTH_DB || !env.ALIPAY_PUBLIC_KEY || !env.ALIPAY_APP_ID || !env.ALIPAY_SELLER_ID || env.ALIPAY_FEE_RATE_BPS === undefined) return failure();
  if (!String(request.headers.get('content-type') || '').toLowerCase().includes('application/x-www-form-urlencoded')) return failure();
  let params;
  try {
    const body = new URLSearchParams(await request.text());
    params = {};
    for (const key of new Set(body.keys())) {
      const values = body.getAll(key);
      if (values.length !== 1) return failure();
      params[key] = values[0];
    }
  } catch { return failure(); }
  try {
    if (!(await verifyAlipayNotify(params, env.ALIPAY_PUBLIC_KEY))) return failure();
    if (String(params.app_id || '') !== String(env.ALIPAY_APP_ID) || String(params.seller_id || '') !== String(env.ALIPAY_SELLER_ID)) return failure();
    const order = await env.AUTH_DB.prepare(
      "SELECT po.id, po.trade_no, po.merchant_id, po.out_trade_no, po.amount_micro, po.currency, po.status, po.provider_trade_no, po.pay_info, pm.user_id FROM payment_orders po JOIN pay_merchants pm ON pm.id = po.merchant_id WHERE po.trade_no = ? OR po.out_trade_no = ? LIMIT 1"
    ).bind(String(params.out_trade_no || ''), String(params.out_trade_no || '')).first();
    if (!order || order.currency !== 'USDT') return failure();
    let payInfo;
    try { payInfo = JSON.parse(order.pay_info || '{}'); } catch { return failure(); }
    const expectedCents = amountToCents(payInfo.amount_cny);
    const notifiedCents = amountToCents(params.total_amount);
    if (expectedCents === null || notifiedCents === null || expectedCents !== notifiedCents || String(params.trade_no || '').length < 8) return failure();
    if (!['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(String(params.trade_status || ''))) return text('success');
    if (order.status === 'paid') return order.provider_trade_no === params.trade_no ? text('success') : failure();
    if (order.status !== 'pending') return failure();
    const feeRateBps = Number(env.ALIPAY_FEE_RATE_BPS);
    if (!Number.isInteger(feeRateBps) || feeRateBps < 0 || feeRateBps > 10000) return failure();
    const { feeMicro, creditMicro } = calculateNetCredit(order.amount_micro, feeRateBps);
    if (!Number.isSafeInteger(creditMicro) || creditMicro <= 0) return failure();
    const now = Math.floor(Date.now() / 1000);
    const ledgerId = crypto.randomUUID().replace(/-/g, '');
    const entryNo = 'ALIPAY' + order.trade_no;
    const description = '支付宝订单入账 ' + order.out_trade_no + '（扣除手续费 ' + feeRateBps + ' bps）';
    const results = await env.AUTH_DB.batch([
      env.AUTH_DB.prepare("UPDATE payment_orders SET status = 'paid', provider_trade_no = ?, paid_at = ?, fee_cents = ?, credit_cents = ? WHERE id = ? AND status = 'pending'")
        .bind(String(params.trade_no), now, Math.round(feeMicro / 10000), Math.round(creditMicro / 10000), order.id),
      env.AUTH_DB.prepare(
        "INSERT INTO merchant_ledger (id, user_id, entry_no, direction, amount_micro, balance_after_micro, currency, category, description, related_type, related_id, created_at) " +
        "SELECT ?, ?, ?, 'credit', ?, COALESCE((SELECT balance_after_micro FROM merchant_ledger WHERE user_id = ? AND currency = 'USDT' ORDER BY created_at DESC, rowid DESC LIMIT 1), 0) + ?, 'USDT', 'payment_credit', ?, 'payment_order', ?, ? " +
        "WHERE EXISTS (SELECT 1 FROM payment_orders WHERE id = ? AND status = 'paid' AND provider_trade_no = ?) " +
        "AND NOT EXISTS (SELECT 1 FROM merchant_ledger WHERE user_id = ? AND related_type = 'payment_order' AND related_id = ?)"
      ).bind(ledgerId, order.user_id, entryNo, creditMicro, order.user_id, creditMicro, description, order.id, now, order.id, String(params.trade_no), order.user_id, order.id)
    ]);
    const updated = Number(results?.[0]?.meta?.changes || 0);
    const credited = Number(results?.[1]?.meta?.changes || 0);
    if (updated === 0 && credited === 0) {
      const current = await env.AUTH_DB.prepare('SELECT status, provider_trade_no FROM payment_orders WHERE id = ?').bind(order.id).first();
      if (current?.status === 'paid' && current.provider_trade_no === params.trade_no) return text('success');
      return failure();
    }
    return text('success');
  } catch (error) {
    console.error('[alipay:notify]', String(error?.message || error).slice(0, 180));
    return failure();
  }
}
