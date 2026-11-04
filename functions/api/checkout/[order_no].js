const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
export async function onRequestGet({ params, env }) {
  if (!env.AUTH_DB) return json({ code: 'UNAVAILABLE' }, 503);
  const orderNo = String(params.order_no || '').trim();
  if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(orderNo)) return json({ code: 'NOT_FOUND' }, 404);
  const order = await env.AUTH_DB.prepare("SELECT trade_no, amount_micro, currency, status, pay_info, created_at, paid_at FROM payment_orders WHERE trade_no = ? LIMIT 1").bind(orderNo).first();
  if (!order) return json({ code: 'NOT_FOUND' }, 404);
  let info = {};
  try { info = JSON.parse(order.pay_info || '{}'); } catch {}
  if (info.provider !== 'nzzf') return json({ code: 'NOT_FOUND' }, 404);
  return json({ code: 'SUCCESS', data: { order_no: order.trade_no, amount: (Number(order.amount_micro) / 1000000).toFixed(6).replace(/0+$/, '').replace(/[.]$/, ''), currency: order.currency, status: order.status, paid_at: order.paid_at || null, qr_content: info.qrcode_content || '' } });
}
