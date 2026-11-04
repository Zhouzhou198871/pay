const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

export async function onRequestGet({ params, env }) {
  if (!env.AUTH_DB) return json({ code: 'UNAVAILABLE' }, 503);
  const orderNo = String(params.order_no || '').trim();
  if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(orderNo)) return json({ code: 'NOT_FOUND' }, 404);
  const order = await env.AUTH_DB.prepare(
    "SELECT trade_no, out_trade_no, amount_cents, amount_micro, currency, method, subject, status, pay_url, pay_info, created_at, paid_at FROM payment_orders WHERE trade_no = ? OR out_trade_no = ? ORDER BY created_at DESC LIMIT 1"
  ).bind(orderNo, orderNo).first();
  if (!order) return json({ code: 'NOT_FOUND' }, 404);

  let payInfo = {};
  try { payInfo = JSON.parse(order.pay_info || '{}'); } catch {}
  const isInternalDemoRecord = String(order.out_trade_no || '').startsWith('TEST_UI_');
  const currency = String(order.currency || 'USDT').toUpperCase();
  const rawAmount = currency === 'USDT' && order.amount_micro != null
    ? Number(order.amount_micro) / 1000000
    : Number(order.amount_cents || 0) / 100;
  const amount = Number.isFinite(rawAmount)
    ? rawAmount.toFixed(currency === 'USDT' ? 6 : 2).replace(/0+$/, '').replace(/\.$/, '')
    : '0.00';
  const qrContent = isInternalDemoRecord ? '' : String(payInfo.qrcode_content || order.pay_url || '').trim();
  const safeQr = /^https:\/\//i.test(qrContent) ? qrContent : '';

  return json({
    code: 'SUCCESS',
    data: {
      order_no: order.out_trade_no,
      trade_no: order.trade_no,
      amount,
      currency,
      method: order.method,
      subject: isInternalDemoRecord && /UI\s*测试订单/i.test(String(order.subject || '')) ? '订单支付' : order.subject,
      status: order.status,
      qr_content: safeQr,
      created_at: order.created_at,
      paid_at: order.paid_at || null
    }
  });
}
