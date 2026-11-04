import { json, randomHex } from "../../_lib/auth.js";
import { createAlipayCheckout } from "../../_lib/alipay.js";
import { createNzzfCheckout } from "../../_lib/nzzf-provider.js";

function parseCny(value) {
  const raw = String(value ?? "").trim();
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(raw)) return null;
  const [whole, fraction = ""] = raw.split(".");
  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  return Number.isSafeInteger(cents) && cents >= 1 && cents <= 100000 ? cents : null;
}

function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}

export async function onRequestPost({ request, env }) {
  if (!env.AUTH_DB) return json({ code: "SERVICE_UNAVAILABLE", message: "收款服务暂不可用，请稍后重试。" }, 503);
  if (!sameOrigin(request)) return json({ code: "ORIGIN_REJECTED", message: "请求来源校验失败。" }, 403);
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return json({ code: "INVALID_CONTENT_TYPE", message: "请求格式不正确。" }, 415);
  }

  let body;
  try { body = await request.json(); }
  catch { return json({ code: "INVALID_JSON", message: "请求内容无效，请重试。" }, 400); }
  const merchantNo = String(body?.merchant_no || "").trim();
  const amountCents = parseCny(body?.amount);
  if (!/^\d{6}$/.test(merchantNo)) return json({ code: "INVALID_MERCHANT", message: "收款链接无效，请联系商户确认。" }, 400);
  if (amountCents === null) return json({ code: "INVALID_AMOUNT", message: "请输入 0.01 至 1000.00 元，最多两位小数。" }, 400);

  try {
    const merchant = await env.AUTH_DB.prepare(
      "SELECT id, user_id, merchant_no, app_id, status FROM pay_merchants WHERE merchant_no = ? LIMIT 1"
    ).bind(merchantNo).first();
    if (!merchant || merchant.status !== "active") {
      return json({ code: "MERCHANT_UNAVAILABLE", message: "该商户暂未开通在线收款，请联系商户确认。" }, 403);
    }

    const rate = Number(env.NZZF_USDT_CNY_RATE || env.ALIPAY_USDT_CNY_RATE || 0);
    if (!Number.isFinite(rate) || rate <= 0 || rate > 100000) {
      return json({ code: "PAYMENT_UNAVAILABLE", message: "当前暂无法创建收款订单，请联系商户。" }, 503);
    }
    const amountCny = (amountCents / 100).toFixed(2);
    const amountMicro = Math.round(amountCents / 100 / rate * 1000000);
    if (!Number.isSafeInteger(amountMicro) || amountMicro <= 0 || Math.round(amountMicro / 1000000 * rate * 100) !== amountCents) {
      return json({ code: "INVALID_AMOUNT", message: "金额超出当前收款范围。" }, 400);
    }

    const now = Math.floor(Date.now() / 1000);
    const id = randomHex(16);
    const tradeNo = "QT" + now + randomHex(8).toUpperCase();
    const outTradeNo = "QP" + now + randomHex(8).toUpperCase();
    const useNzzf = Boolean(String(env.NZZF_PID || "").trim());
    const notifyUrl = useNzzf
      ? "https://pay.lynli.me/api/v1/payments/nzzf/notify"
      : String(env.ALIPAY_NOTIFY_URL || "");
    const returnUrl = "https://pay.lynli.me/checkout/success?order_no=" + encodeURIComponent(tradeNo);

    const checkout = useNzzf
      ? await createNzzfCheckout({
          env, tradeNo, subject: "晴天支付收款", amountMicro,
          notifyUrl, returnUrl,
          clientIp: request.headers.get("CF-Connecting-IP") || ""
        })
      : await createAlipayCheckout({
          env, db: env.AUTH_DB, tradeNo, subject: "晴天支付收款",
          amountMicro, payType: "alipay"
        });

    if (!checkout.ok) {
      console.warn("[pay/create] provider unavailable", String(checkout.code || "unknown").slice(0, 80));
      return json({ code: "PAYMENT_UNAVAILABLE", message: "当前收款通道暂不可用，请稍后重试或联系商户。" }, 503);
    }

    const checkoutUrl = "/checkout/" + encodeURIComponent(tradeNo);
    const payInfo = {
      provider: useNzzf ? "nzzf" : "alipay",
      amount_cny: amountCny,
      usdt_cny_rate: rate,
      qrcode_content: checkout.qrContent || checkout.checkoutUrl,
      ...(checkout.providerTradeNo ? { provider_trade_no: checkout.providerTradeNo } : {})
    };

    await env.AUTH_DB.prepare(
      "INSERT INTO payment_orders (id, trade_no, merchant_id, app_id, out_trade_no, amount_cents, currency, method, subject, status, pay_url, pay_info, notify_url, amount_micro, pay_type, request_timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, 'USDT', 'alipay', ?, 'pending', ?, ?, ?, ?, 'alipay', ?, ?)"
    ).bind(
      id, tradeNo, merchant.id, merchant.app_id, outTradeNo,
      amountCents, "晴天支付收款",
      checkoutUrl, JSON.stringify(payInfo), notifyUrl, amountMicro, now, now
    ).run();

    return json({
      code: "SUCCESS",
      message: "收款订单已创建。",
      data: {
        order_no: tradeNo,
        checkout_url: checkoutUrl,
        amount_cny: amountCny,
        expires_at: now + 900
      }
    }, 201);
  } catch (error) {
    console.error("[pay/create]", String(error?.message || error).slice(0, 180));
    return json({ code: "CREATE_FAILED", message: "暂时无法创建收款订单，请稍后重试。" }, 503);
  }
}
