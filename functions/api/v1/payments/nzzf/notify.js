import { verifyNzzfParams, isFreshNzzfTimestamp } from '../../../../_lib/nzzf.js';
import { amountToCents, calculateNetCredit } from '../../../../_lib/nzzf-provider.js';

const reply = (value) => new Response(value, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
const fail = () => reply('failure');

function addUnique(target, key, value) {
  if (Object.prototype.hasOwnProperty.call(target, key)) return false;
  if (typeof value !== 'string') return false;
  target[key] = value;
  return true;
}

async function readNotification(request) {
  const params = Object.create(null);
  if (request.method === 'GET') {
    const url = new URL(request.url);
    for (const key of url.searchParams.keys()) {
      const values = url.searchParams.getAll(key);
      if (values.length !== 1 || !addUnique(params, key, values[0])) return null;
    }
    return params;
  }

  const contentType = String(request.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = new URLSearchParams(await request.text());
    for (const key of form.keys()) {
      const values = form.getAll(key);
      if (values.length !== 1 || !addUnique(params, key, values[0])) return null;
    }
    return params;
  }
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    for (const [key, value] of form.entries()) {
      if (typeof value !== 'string' || !addUnique(params, key, value)) return null;
    }
    return params;
  }
  return null;
}

async function processNotification({ request, env }) {
  if (!env.AUTH_DB || !env.NZZF_PID || !env.NZZF_PLATFORM_PUBLIC_KEY) return fail();
  try {
    const params = await readNotification(request);
    if (!params ||
        String(params.pid || '') !== String(env.NZZF_PID) ||
        String(params.sign_type || '').toUpperCase() !== 'RSA' ||
        !isFreshNzzfTimestamp(params.timestamp) ||
        !(await verifyNzzfParams(params, env.NZZF_PLATFORM_PUBLIC_KEY))) return fail();

    if (String(params.type || '') !== 'alipay') return fail();
    if (String(params.trade_status || '') !== 'TRADE_SUCCESS') return reply('success');

    const outTradeNo = String(params.out_trade_no || '');
    const providerTradeNo = String(params.trade_no || '');
    if (!/^[A-Za-z0-9_.:-]{1,64}$/.test(outTradeNo) ||
        !/^[A-Za-z0-9_.:-]{8,128}$/.test(providerTradeNo)) return fail();

    const order = await env.AUTH_DB.prepare(
      "SELECT po.id, po.trade_no, po.out_trade_no, po.amount_micro, po.currency, po.status, po.provider_trade_no, po.pay_info, pm.user_id " +
      "FROM payment_orders po JOIN pay_merchants pm ON pm.id = po.merchant_id WHERE po.trade_no = ? LIMIT 1"
    ).bind(outTradeNo).first();
    if (!order || order.currency !== 'USDT' || order.trade_no !== outTradeNo ||
        !Number.isSafeInteger(Number(order.amount_micro)) || Number(order.amount_micro) <= 0) return fail();

    let payInfo;
    try { payInfo = JSON.parse(order.pay_info || '{}'); } catch { return fail(); }
    if (payInfo.provider !== 'nzzf') return fail();

    const expectedCents = amountToCents(payInfo.amount_cny);
    const receivedCents = amountToCents(params.money);
    if (expectedCents === null || receivedCents === null || expectedCents !== receivedCents) return fail();

    if (order.status === 'paid') {
      if (order.provider_trade_no !== providerTradeNo) return fail();
      const ledger = await env.AUTH_DB.prepare(
        "SELECT id FROM merchant_ledger WHERE user_id = ? AND related_type = 'payment_order' AND related_id = ? LIMIT 1"
      ).bind(order.user_id, order.id).first();
      return ledger ? reply('success') : fail();
    }
    if (order.status !== 'pending' || (order.provider_trade_no && order.provider_trade_no !== providerTradeNo)) return fail();

    const feeRateBps = Number(env.NZZF_FEE_RATE_BPS ?? env.ALIPAY_FEE_RATE_BPS);
    if (!Number.isInteger(feeRateBps) || feeRateBps < 0 || feeRateBps > 9999) return fail();
    const { feeMicro, creditMicro } = calculateNetCredit(Number(order.amount_micro), feeRateBps);
    if (!Number.isSafeInteger(feeMicro) || !Number.isSafeInteger(creditMicro) || creditMicro <= 0) return fail();

    const now = Math.floor(Date.now() / 1000);
    const ledgerId = crypto.randomUUID().replace(/-/g, '');
    const entryNo = 'NZZF' + order.trade_no;
    const description = '晴天支付订单入账 ' + order.out_trade_no + '（扣除手续费 ' + feeRateBps + ' bps）';

    // D1 batch is transactional. Insert the one-time credit first; only mark paid
    // when that exact ledger entry exists. A duplicate/concurrent callback cannot
    // create another credit because the migration adds a unique payment-order ledger index.
    const results = await env.AUTH_DB.batch([
      env.AUTH_DB.prepare(
        "INSERT INTO merchant_ledger (id, user_id, entry_no, direction, amount_micro, balance_after_micro, currency, category, description, related_type, related_id, created_at) " +
        "SELECT ?, ?, ?, 'credit', ?, COALESCE((SELECT balance_after_micro FROM merchant_ledger WHERE user_id = ? AND currency = 'USDT' ORDER BY created_at DESC, rowid DESC LIMIT 1), 0) + ?, 'USDT', 'payment_credit', ?, 'payment_order', ?, ? " +
        "FROM payment_orders WHERE id = ? AND status = 'pending' AND currency = 'USDT' " +
        "AND NOT EXISTS (SELECT 1 FROM merchant_ledger WHERE related_type = 'payment_order' AND related_id = ?) " +
        "AND NOT EXISTS (SELECT 1 FROM merchant_ledger WHERE entry_no = ?)"
      ).bind(ledgerId, order.user_id, entryNo, creditMicro, order.user_id, creditMicro, description, order.id, now, order.id, order.id, entryNo),
      env.AUTH_DB.prepare(
        "UPDATE payment_orders SET status = 'paid', provider_trade_no = ?, paid_at = ?, fee_cents = ?, credit_cents = ? " +
        "WHERE id = ? AND status = 'pending' AND EXISTS (SELECT 1 FROM merchant_ledger WHERE user_id = ? AND related_type = 'payment_order' AND related_id = ?)"
      ).bind(providerTradeNo, now, Math.round(feeMicro / 10000), Math.round(creditMicro / 10000), order.id, order.user_id, order.id)
    ]);

    const credited = Number(results?.[0]?.meta?.changes || 0);
    const updated = Number(results?.[1]?.meta?.changes || 0);
    if (credited === 1 && updated === 1) return reply('success');

    const current = await env.AUTH_DB.prepare(
      "SELECT status, provider_trade_no FROM payment_orders WHERE id = ?"
    ).bind(order.id).first();
    const existingLedger = await env.AUTH_DB.prepare(
      "SELECT id FROM merchant_ledger WHERE user_id = ? AND related_type = 'payment_order' AND related_id = ? LIMIT 1"
    ).bind(order.user_id, order.id).first();
    return current?.status === 'paid' &&
      current.provider_trade_no === providerTradeNo &&
      Boolean(existingLedger) ? reply('success') : fail();
  } catch (error) {
    console.error('[nzzf:notify]', String(error?.message || error).slice(0, 180));
    return fail();
  }
}

export async function onRequestGet(context) {
  return processNotification(context);
}

export async function onRequestPost(context) {
  return processNotification(context);
}
