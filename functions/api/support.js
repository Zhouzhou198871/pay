import { json } from "../_lib/auth.js";

function safeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return ["https:", "http:"].includes(url.protocol) ? url.toString() : "";
  } catch { return ""; }
}
export async function onRequestGet({ env }) {
  return json({
    label: String(env.SUPPORT_LABEL || "晴天支付在线客服").slice(0, 40),
    url: safeUrl(env.SUPPORT_URL),
    wechat_qr_url: safeUrl(env.SUPPORT_WECHAT_QR_URL),
    hours: String(env.SUPPORT_HOURS || "").slice(0, 80)
  }, 200, { "Cache-Control": "public, max-age=60" });
}
