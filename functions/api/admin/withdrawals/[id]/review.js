import { adminContext, sameOrigin } from "../../../../_lib/admin.js";
import { json } from "../../../../_lib/auth.js";

export async function onRequestPost({ request, env, params }) {
  if (!sameOrigin(request)) return json({ error: "请求来源校验失败。" }, 403);
  const context = await adminContext(request, env);
  if (context.response) return context.response;
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) return json({ error: "请使用 application/json。" }, 415);
  let body;
  try { body = await request.json(); } catch { return json({ error: "请求 JSON 格式不正确。" }, 400); }
  const action = String(body?.action || "");
  const note = String(body?.note || "").trim().slice(0, 500);
  const id = String(params?.id || "").trim();
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) return json({ error: "提现申请编号无效。" }, 400);
  if (!["approve", "reject"].includes(action)) return json({ error: "审核操作无效。" }, 400);
  if (action === "reject" && note.length < 3) return json({ error: "拒绝提现必须填写至少 3 个字符的原因。" }, 400);
  const now = Math.floor(Date.now() / 1000);
  try {
    if (action === "approve") {
      const result = await context.db.prepare("UPDATE merchant_withdrawals SET status='approved', reviewed_at=?, admin_user_id=?, admin_note=? WHERE id=? AND status='pending'")
        .bind(now, context.user.id, note, id).run();
      if (Number(result?.meta?.changes || 0) !== 1) return json({ error: "该提现已处理或不存在，请刷新列表。" }, 409);
      return json({ success: true, status: "approved", message: "审核已通过，等待完成实际打款。" });
    }
    const result = await context.db.batch([
      context.db.prepare("UPDATE merchant_withdrawals SET status='rejected', reviewed_at=?, admin_user_id=?, admin_note=? WHERE id=? AND status IN ('pending','approved')").bind(now, context.user.id, note, id),
      context.db.prepare("INSERT INTO merchant_ledger (id,user_id,entry_no,direction,amount_micro,balance_after_micro,currency,category,description,related_type,related_id,created_at) SELECT lower(hex(randomblob(16))),w.user_id,'WR' || strftime('%s','now') || upper(hex(randomblob(6))),'credit',w.total_debit_micro,COALESCE((SELECT balance_after_micro FROM merchant_ledger WHERE user_id=w.user_id AND currency='USDT' ORDER BY created_at DESC,rowid DESC LIMIT 1),0)+w.total_debit_micro,'USDT','withdrawal_refund','提现审核拒绝，退回申请扣款 ' || w.request_no,'withdrawal_refund',w.id,? FROM merchant_withdrawals w WHERE w.id=? AND w.status='rejected' AND NOT EXISTS (SELECT 1 FROM merchant_ledger l WHERE l.user_id=w.user_id AND l.related_type='withdrawal_refund' AND l.related_id=w.id)")
        .bind(now, id)
    ]);
    if (Number(result?.[0]?.meta?.changes || 0) !== 1) {
      const current = await context.db.prepare("SELECT status FROM merchant_withdrawals WHERE id=?").bind(id).first();
      if (!current) return json({ error: "提现申请不存在。" }, 404);
      return json({ error: "该提现已处理，不能重复拒绝。" }, 409);
    }
    return json({ success: true, status: "rejected", message: "提现已拒绝，申请时扣除的余额及手续费已退回。" });
  } catch (error) {
    console.error("[admin/withdrawals:review]", String(error?.message || error).slice(0, 180));
    return json({ error: "提现审核失败，请稍后重试。" }, 503);
  }
}
