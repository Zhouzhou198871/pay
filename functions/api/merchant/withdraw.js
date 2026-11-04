import { merchantContext } from '../../_lib/merchant.js';
import { json, randomHex, verifyPassword } from '../../_lib/auth.js';

function parseAmountMicro(value) {
  const raw = String(value ?? '').trim();
  if (!/^\\d{1,10}(?:\\.\\d{1,6})?$/.test(raw)) return null;
  const [whole, fraction = ''] = raw.split('.');
  const amount = Number(whole) * 1000000 + Number((fraction + '000000').slice(0, 6));
  return Number.isSafeInteger(amount) && amount >= 10000 && amount <= 1000000000000 ? amount : null;
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
function validQr(value) {
  return typeof value === 'string' &&
    /^data:image\\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value) &&
    value.length <= 320000;
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
  const withdrawType = String(body?.withdraw_type || 'usdt').toLowerCase();
  if (amountMicro === null) return json({ error: '提现金额须在 0.01 至 1,000,000 USDT 之间，最多支持 6 位小数。' }, 400);
  if (!['usdt', 'fiat'].includes(withdrawType)) return json({ error: '提现方式无效。' }, 400);
  if (password.length < 8 || password.length > 64) return json({ error: '请输入正确长度的支付密码。' }, 400);

  let feeMicro = 0, payoutMicro = amountMicro, payoutCents = 0, totalDebitMicro = 0;
  let bankInfo = '', destination = '', description = '';
  try {
    const merchant = await context.db.prepare('SELECT id, usdt_address, usdt_network, withdraw_password_hash FROM pay_merchants WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').bind(context.user.id).first();
    if (!merchant) return json({ error: '当前账户尚未开通商户资料。' }, 400);
    if (!merchant.withdraw_password_hash) return json({ error: '请先在个人资料中设置支付密码。' }, 400);
    if (!(await verifyPassword(password, merchant.withdraw_password_hash))) return json({ error: '支付密码不正确。' }, 401);

    if (withdrawType === 'usdt') {
      if (!merchant.usdt_address) return json({ error: '请先在个人资料中绑定 USDT 提现地址。' }, 400);
      feeMicro = amountMicro < 500000000 ? 5000000 : 0;
      payoutMicro = amountMicro;
      totalDebitMicro = amountMicro + feeMicro;
      destination = maskAddress(merchant.usdt_address);
      description = 'USDT 提现申请 ' + merchant.usdt_network + (feeMicro ? '（手续费 5 USDT）' : '（免手续费）');
    } else {
      const method = String(body?.fiat_method || '').toLowerCase();
      const realName = String(body?.real_name || '').trim();
      const qrImage = body?.qr_image;
      if (!['wechat', 'alipay'].includes(method)) return json({ error: '请选择微信或支付宝收款方式。' }, 400);
      if (realName.length < 2 || realName.length > 40 || /[<>\\r\\n]/.test(realName)) return json({ error: '请填写 2 至 40 个字符的真实姓名。' }, 400);
      if (!validQr(qrImage)) return json({ error: '请上传有效的收款码图片（PNG、JPG 或 WebP，压缩后不超过约 230KB）。' }, 400);
      const rate = Number(env.WITHDRAW_USDT_CNY_RATE || env.NZZF_USDT_CNY_RATE || 0);
      if (!Number.isFinite(rate) || rate <= 0 || rate > 1000) return json({ error: '法币提现汇率尚未配置，请联系平台客服。' }, 503);
      feeMicro = Math.round(amountMicro * 600 / 10000);
      payoutMicro = amountMicro - feeMicro;
      totalDebitMicro = amountMicro;
      payoutCents = Math.round(payoutMicro * rate / 10000);
      bankInfo = JSON.stringify({ method, real_name: realName, qr_image: qrImage, rate_usdt_cny: rate });
      destination = (method === 'wechat' ? '微信' : '支付宝') + ' · ' + realName;
      description = '法币提现申请（6% 手续费，按配置汇率折算）';
    }

    const now = Math.floor(Date.now() / 1000), id = randomHex(16), requestNo = 'WD' + now + randomHex(6).toUpperCase();
    const ledgerId = randomHex(16), entryNo = 'WD' + now + randomHex(8).toUpperCase();
    const result = await context.db.batch([
      context.db.prepare("INSERT INTO merchant_withdrawals (id,user_id,request_no,amount_micro,fee_micro,fee_amount,currency,destination_masked,status,requested_at,withdraw_type,bank_account_info,payout_amount_micro,payout_amount_cents,total_debit_micro) SELECT ?,?,?,?,?,?,'USDT',?,'pending',?,?,?,?,?,? WHERE COALESCE((SELECT balance_after_micro FROM merchant_ledger WHERE user_id=? AND currency='USDT' ORDER BY created_at DESC,rowid DESC LIMIT 1),0) >= ?")
        .bind(id, context.user.id, requestNo, amountMicro, feeMicro, feeMicro, destination, now, withdrawType, bankInfo, payoutMicro, payoutCents, totalDebitMicro, context.user.id, totalDebitMicro),
      context.db.prepare("INSERT INTO merchant_ledger (id,user_id,entry_no,direction,amount_micro,balance_after_micro,currency,category,description,related_type,related_id,created_at) SELECT ?,?,?, 'debit', ?, COALESCE((SELECT balance_after_micro FROM merchant_ledger WHERE user_id=? AND currency='USDT' ORDER BY created_at DESC,rowid DESC LIMIT 1),0)-?, 'USDT','withdrawal_request',?,'merchant_withdrawal',?,? FROM merchant_withdrawals WHERE id=? AND user_id=? AND NOT EXISTS (SELECT 1 FROM merchant_ledger WHERE user_id=? AND related_type='merchant_withdrawal' AND related_id=?)")
        .bind(ledgerId, context.user.id, entryNo, totalDebitMicro, context.user.id, totalDebitMicro, description + ' ' + requestNo, id, now, id, context.user.id, context.user.id, id)
    ]);
    if (Number(result?.[0]?.meta?.changes || 0) !== 1) return json({ error: '可用余额不足（手续费计入扣款），无法提交本次提现申请。' }, 400);
    if (Number(result?.[1]?.meta?.changes || 0) !== 1) return json({ error: '提现申请暂时未能完成，请刷新余额后重试。' }, 503);
    return json({
      success: true, message: '提现申请已提交，等待平台审核。',
      data: {
        request_no: requestNo, withdraw_type: withdrawType,
        amount: (amountMicro / 1000000).toFixed(6),
        fee: (feeMicro / 1000000).toFixed(6),
        payout_amount: (payoutMicro / 1000000).toFixed(6),
        payout_amount_cny: withdrawType === 'fiat' ? (payoutCents / 100).toFixed(2) : null,
        total_debit: (totalDebitMicro / 1000000).toFixed(6),
        currency: 'USDT', destination_masked: destination, status: 'pending', requested_at: now
      }
    }, 201);
  } catch (error) {
    console.error('[merchant/withdraw]', String(error?.message || error).slice(0, 180));
    return json({ error: '提现申请失败，请稍后重试。' }, 500);
  }
}
