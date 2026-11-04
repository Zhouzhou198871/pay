import { adminContext, sameOrigin } from "../../../../_lib/admin.js";
import { json } from "../../../../_lib/auth.js";

export async function onRequestPost({ request, env, params }) {
  if (!sameOrigin(request)) return json({ error: "请求来源校验失败。" }, 403);
  const context = await adminContext(request, env);
  if (context.response) return context.response;
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return json({ error: "请使用 application/json。" }, 415);
  }
  let body;
  try { body = await request.json(); } catch { return json({ error: "请求 JSON 格式不正确。" }, 400); }
  const reference = String(body?.payout_reference || "").trim();
  const note = String(body?.note || "").trim().slice(0, 500);
  if (reference.length < 4 || reference.length > 128 || !/^[A-Za-z0-9_.:-]+$/.test(reference)) {
    return json({ error: "请填写 4 至 128 位有效的链上交易哈希或打款凭证编号。" }, 400);
  }
  const id = String(params?.id || "").trim();
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) return json({ error: "提现申请编号无效。" }, 400);
  const now = Math.floor(Date.now() / 1000);
  try {
    const result = await context.db.prepare(
      "UPDATE merchant_withdrawals SET status = 'paid', reviewed_at = ?, payout_reference = ?, admin_user_id = ?, admin_note = ? " +
      "WHERE id = ? AND status IN ('pending','approved','processing')"
    ).bind(now, reference, context.user.id, note, id).run();
    if (Number(result?.meta?.changes || 0) === 1) {
      return json({ success: true, message: "提现已标记为已打款。申请时已从可用余额扣除，本操作不会重复扣款。", status: "paid", reviewed_at: now });
    }
    const current = await context.db.prepare(
      "SELECT status, payout_reference FROM merchant_withdrawals WHERE id = ?"
    ).bind(id).first();
    if (!current) return json({ error: "提现申请不存在。" }, 404);
    if (current.status === "paid" && current.payout_reference === reference) {
      return json({ success: true, idempotent: true, message: "该提现已使用相同打款凭证标记为已打款。", status: "paid" });
    }
    if (current.status === "paid") return json({ error: "该提现已打款，不能更换打款凭证。" }, 409);
    return json({ error: "只有待处理、已通过或打款中的提现申请可以标记为已打款。" }, 409);
  } catch (error) {
    if (/UNIQUE constraint failed/i.test(String(error?.message || error))) {
      return json({ error: "该打款凭证已关联其他提现申请，请核对交易哈希。" }, 409);
    }
    console.error("[admin/withdrawals:paid]", String(error?.message || error).slice(0, 180));
    return json({ error: "更新提现状态失败，请稍后重试。" }, 503);
  }
}
