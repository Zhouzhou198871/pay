import { merchantContext } from '../../_lib/merchant.js';
import { json, randomHex, verifyPassword } from '../../_lib/auth.js';
function parseAmountMicro(value) {
  const raw = String(value ?? '').trim();
  if (!/^\d{1,10}(?:\.\d{1,6})?$/.test(raw)) return null;
  const [whole, fraction = ''] = raw.split('.');
  const amount = Number(whole) * 1000000 + Number((fraction + '000000').slice(0, 6));
  return Number.isSafeInteger(amount) && amount > 0 && amount <= 1000000000000 ? amount : null;
}
function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
function maskAddress(value) {
  const address = String(value || '');
  return address.length < 14 ? address.slice(0, 3) + '****' : address.slice(0, 6) + '****' + address.slice(-4);
}
export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: '请求来源校验失败。' }, 403);
  const context = await merchantContext(request, env);
  if (context.response) return context.response;
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) return json({ error: '请使用 application/json。' }, 415);
  let body;
  try { body = await request.json(); } catch { return json({ error: '请求 JSON 格式不正确。' }, 400); }
  const amountMicro = parseAmountMicro(body?.amount);
  const password = String(body?.withdraw_password || '');
  if (amountMicro === null) return json({ error: '提现金额必须大于 0，最多支持 6 位小数。' }, 400);
  if (password.length < 8 || password.length > 64) return json({ error: '请输入正确长度的支付密码。' }, 400);
  try {
    const merchant = await context.db.prepare('SELECT id, usdt_address, usdt_network, withdraw_password_hash FROM pay_merchants WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').bind(context.user.id).first();
    if (!merchant) return json({ error: '当前账户尚未开通商户资料。' }, 400);
    if (!merchant.usdt_address) return json({ error: '请先在个人资料中绑定 USDT 提现地址。' }, 400);
    if (!merchant.withdraw_password_hash) return json({ error: '请先在个人资料中设置支付密码。' }, 400);
    if (!(await verifyPassword(password, merchant.withdraw_password_hash))) return json({ error: '支付密码不正确。' }, 401);
    const now = Math.floor(Date.now() / 1000), id = randomHex(16), requestNo = 'WD' + now + randomHex(6).toUpperCase();
    const ledgerId = randomHex(16), entryNo = 'WD' + now + randomHex(8).toUpperCase(), destination = maskAddress(merchant.usdt_address);
    const results = await context.db.batch([
      context.db.prepare("INSERT INTO merchant_withdrawals (id,user_id,request_no,amount_micro,fee_micro,currency,destination_masked,status,requested_at) SELECT ?,?,?,?,0,'USDT',?,'pending',? WHERE COALESCE((SELECT balance_after_micro FROM merchant_ledger WHERE user_id=? AND currency='USDT' ORDER BY created_at DESC,rowid DESC LIMIT 1),0) >= ?")
        .bind(id, context.user.id, requestNo, amountMicro, destination, now, context.user.id, amountMicro),
      context.db.prepare("INSERT INTO merchant_ledger (id,user_id,entry_no,direction,amount_micro,balance_after_micro,currency,category,description,related_type,related_id,created_at) SELECT ?,?,?, 'debit', ?, COALESCE((SELECT balance_after_micro FROM merchant_ledger WHERE user_id=? AND currency='USDT' ORDER BY created_at DESC,rowid DESC LIMIT 1),0)-?, 'USDT','withdrawal_request',?,'merchant_withdrawal',?,? FROM merchant_withdrawals WHERE id=? AND user_id=? AND NOT EXISTS (SELECT 1 FROM merchant_ledger WHERE user_id=? AND related_type='merchant_withdrawal' AND related_id=?)")
        .bind(ledgerId, context.user.id, entryNo, amountMicro, context.user.id, amountMicro, '提现申请 '+requestNo, id, now, id, context.user.id, context.user.id, id)
    ]);
    if (Number(results?.[0]?.meta?.changes || 0) !== 1) return json({ error: '可用余额不足，无法提交本次提现申请。' }, 400);
    if (Number(results?.[1]?.meta?.changes || 0) !== 1) return json({ error: '提现申请暂时未能完成，请刷新余额后重试。' }, 503);
    return json({ success: true, message: '提现申请已提交，当前状态为待审核。', data: { request_no: requestNo, amount: (amountMicro / 1000000).toFixed(6).replace(/0+$/,'').replace(/\.$/,''), currency: 'USDT', destination_masked: destination, status: 'pending', requested_at: now } }, 201);
  } catch (error) {
    console.error('[merchant/withdraw]', String(error?.message || error).slice(0, 180));
    return json({ error: '提现申请失败，请稍后重试。' }, 500);
  }
}
