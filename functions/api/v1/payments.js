import { json, randomHex, safeEqual } from "../../_lib/auth.js";
import { signPaymentParams, isFreshTimestamp } from "../../_lib/md5.js";
import { createAlipayCheckout } from "../../_lib/alipay.js";
import { createNzzfCheckout } from "../../_lib/nzzf-provider.js";

const PAY_TYPES = new Set(["alipay", "alipay_h5"]);
const MAX_AMOUNT_MICRO = 1000000000000;

function parseAmount(value) {
  const raw = String(value ?? "").trim();
  if (!/^\d{1,10}(?:\.\d{1,6})?$/.test(raw)) return null;
  const [whole, fraction = ""] = raw.split(".");
  const micro = Number(whole) * 1000000 + Number((fraction + "000000").slice(0, 6));
  return Number.isSafeInteger(micro) && micro > 0 && micro <= MAX_AMOUNT_MICRO ? micro : null;
}

function validNotifyUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.hash) return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;
    if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    return true;
  } catch { return false; }
}

function amountText(micro) {
  return (micro / 1000000).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

export async function onRequestPost({ request, env }) {
  if (!env.AUTH_DB) return json({ code: "SERVICE_UNAVAILABLE", message: "支付服务暂不可用。" }, 503);
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return json({ code: "INVALID_CONTENT_TYPE", message: "请使用 application/json。" }, 415);
  }

  let body;
  try { body = await request.json(); }
  catch { return json({ code: "INVALID_JSON", message: "请求 JSON 格式不正确。" }, 400); }

  const required = ["merchant_no", "out_trade_no", "amount", "pay_type", "notify_url", "timestamp", "sign"];
  if (!body || typeof body !== "object" || Array.isArray(body) || required.some((key) => body[key] === undefined || body[key] === null || String(body[key]).trim() === "")) {
    return json({ code: "MISSING_PARAMETER", message: "缺少必要参数（timestamp 也必须参与签名）。" }, 400);
  }
  if (!isFreshTimestamp(body.timestamp)) return json({ code: "TIMESTAMP_EXPIRED", message: "时间戳无效或已超过 5 分钟，请重新发起请求。" }, 400);

  const merchantNo = String(body.merchant_no).trim();
  const outTradeNo = String(body.out_trade_no).trim();
  const payType = String(body.pay_type).trim().toLowerCase();
  const amountMicro = parseAmount(body.amount);
  const notifyUrl = String(body.notify_url).trim();
  if (!/^\d{6}$/.test(merchantNo)) return json({ code: "INVALID_MERCHANT", message: "商户号格式不正确。" }, 400);
  if (!/^[A-Za-z0-9_.:-]{1,64}$/.test(outTradeNo)) return json({ code: "INVALID_OUT_TRADE_NO", message: "商户订单号仅允许 1 至 64 位字母、数字及 _ . : -。" }, 400);
  if (amountMicro === null) return json({ code: "INVALID_AMOUNT", message: "金额必须大于 0，最多 6 位小数。" }, 400);
  if (!PAY_TYPES.has(payType)) return json({ code: "UNSUPPORTED_PAY_TYPE", message: "当前仅接受 alipay 或 alipay_h5。" }, 400);
  if (!validNotifyUrl(notifyUrl)) return json({ code: "INVALID_NOTIFY_URL", message: "异步通知地址必须是有效的 HTTPS 公网地址。" }, 400);

  try {
    const merchant = await env.AUTH_DB.prepare(
      "SELECT id, user_id, merchant_no, api_key, app_id, status, api_access_granted FROM pay_merchants WHERE merchant_no = ? LIMIT 1"
    ).bind(merchantNo).first();
    if (!merchant || !merchant.api_key) return json({ code: "MERCHANT_NOT_FOUND", message: "商户不存在或尚未开通 V1 API。" }, 401);

    const expected = signPaymentParams(body, merchant.api_key);
    if (!safeEqual(String(body.sign).trim().toLowerCase(), expected)) {
      return json({ code: "SIGNATURE_INVALID", message: "签名验证失败。" }, 401);
    }

    if (!merchant.api_access_granted) return json({ code: "API_ACCESS_PENDING", message: "API 调用权限尚未审批通过，请在商户客服工单中提交申请。" }, 403);

    const now = Math.floor(Date.now() / 1000);
    const id = randomHex(16);
    const tradeNo = "QT" + now.toString() + randomHex(8).toUpperCase();
    // Persist the exact CNY amount so signed provider notifications can be reconciled.
    const amountCents = Math.max(1, Math.round(amountMicro / 10000));
    const useNzzf = Boolean(String(env.NZZF_PID || '').trim());
    const provider = useNzzf ? 'nzzf' : 'alipay';
    const notifyTarget = useNzzf
      ? 'https://pay.lynli.me/api/v1/payments/nzzf/notify'
      : String(env.ALIPAY_NOTIFY_URL || '');
    const successTarget = 'https://pay.lynli.me/checkout/success?order_no=' + encodeURIComponent(tradeNo);
    const checkout = useNzzf
      ? await createNzzfCheckout({ env, tradeNo, subject: outTradeNo, amountMicro, notifyUrl: notifyTarget, returnUrl: successTarget, clientIp: request.headers.get('CF-Connecting-IP') || '' })
      : await createAlipayCheckout({ env, db: env.AUTH_DB, tradeNo, subject: outTradeNo, amountMicro, payType });
    if (!checkout.ok) return json({ code: checkout.code, message: checkout.message, ...(checkout.missing ? { missing: checkout.missing } : {}) }, 503);
    const checkoutUrl = useNzzf ? '/checkout/' + encodeURIComponent(tradeNo) : checkout.checkoutUrl;
    const payInfo = useNzzf
      ? { provider, amount_cny: checkout.amountCny, usdt_cny_rate: checkout.rate, qrcode_content: checkout.qrContent, provider_trade_no: checkout.providerTradeNo }
      : { provider, amount_cny: checkout.amountCny, usdt_cny_rate: checkout.rate };
    try {
      await env.AUTH_DB.prepare("INSERT INTO payment_orders (id, trade_no, merchant_id, app_id, out_trade_no, amount_cents, currency, method, subject, status, pay_url, pay_info, notify_url, amount_micro, pay_type, request_timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, 'USDT', ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)")
        .bind(id, tradeNo, merchant.id, merchant.app_id, outTradeNo, amountCents, 'alipay', outTradeNo, checkoutUrl, JSON.stringify(payInfo), notifyTarget, amountMicro, payType, Number(body.timestamp), now).run();
    } catch (error) {
      if (/UNIQUE constraint failed|constraint.*unique/i.test(String(error?.message || error))) return json({ code: 'ORDER_EXISTS', message: '该商户订单号已存在，请勿重复下单。' }, 409);
      throw error;
    }
    return json({ code: 'SUCCESS', message: '订单创建成功。', data: { order_id: id, trade_no: tradeNo, merchant_no: merchantNo, out_trade_no: outTradeNo, amount: amountText(amountMicro), currency: 'USDT', pay_type: payType, status: 'unpaid', created_at: now, expires_at: now + 900, checkout_url: checkoutUrl, payment_amount_cny: checkout.amountCny, payment_currency: 'CNY' } }, 201);
  } catch (error) {
    console.error("[v1/payments:create]", String(error?.message || error).slice(0, 200));
    return json({ code: "INTERNAL_ERROR", message: "订单创建失败，请稍后重试。" }, 500);
  }
}
