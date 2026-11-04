const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
export async function onRequestGet({ params, env }) {
  if (!env.AUTH_DB) return json({ code: 'UNAVAILABLE' }, 503);
  const orderNo = String(params.order_no || '').trim();
  if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(orderNo)) return json({ code: 'NOT_FOUND' }, 404);
  const order = await env.AUTH_DB.prepare("SELECT out_trade_no, amount_cents, currency, method, subject, status, pay_url, created_at, paid_at FROM payment_orders WHERE out_trade_no = ? LIMIT 1").bind(orderNo).first();
  if (!order) return json({ code: 'NOT_FOUND' }, 404);
  const isTest = String(order.out_trade_no).startsWith('TEST_UI_');
  const qrContent = isTest ? 'https://example.com/mock-payment/' + encodeURIComponent(order.out_trade_no) : order.pay_url;
  return json({ code: 'SUCCESS', data: { order_no: order.out_trade_no, amount: (Number(order.amount_cents || 0) / 100).toFixed(2), currency: order.currency, method: order.method, subject: order.subject, status: order.status, qr_content: qrContent, created_at: order.created_at, paid_at: order.paid_at || null } });
}
