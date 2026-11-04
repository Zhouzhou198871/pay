import { adminContext } from "../../_lib/admin.js";
import { json } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const context = await adminContext(request, env);
  if (context.response) return context.response;
  const url = new URL(request.url);
  const status = String(url.searchParams.get("status") || "pending");
  const allowed = new Set(["pending", "approved", "processing", "paid", "rejected", "cancelled", "all"]);
  if (!allowed.has(status)) return json({ error: "提现状态筛选值无效。" }, 400);
  const page = Math.max(1, Math.min(100000, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1));
  const pageSize = Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get("page_size") || "50", 10) || 50));
  const offset = (page - 1) * pageSize;
  const filter = status === "all" ? "" : " WHERE w.status = ?";
  const binds = status === "all" ? [] : [status];
  try {
    const [rows, count] = await Promise.all([
      context.db.prepare(
        "SELECT w.id, w.user_id, u.email, w.request_no, w.amount_micro, w.fee_micro, w.currency, " +
        "w.destination_masked, w.withdraw_type, w.bank_account_info, w.fee_amount, w.payout_amount_micro, w.payout_amount_cents, w.total_debit_micro, COALESCE((SELECT pm.usdt_address FROM pay_merchants pm WHERE pm.user_id = w.user_id ORDER BY pm.created_at DESC LIMIT 1), w.destination_masked) AS payout_address, " +
        "(SELECT pm.usdt_network FROM pay_merchants pm WHERE pm.user_id = w.user_id ORDER BY pm.created_at DESC LIMIT 1) AS payout_network, " +
        "w.status, w.requested_at, w.reviewed_at, w.payout_reference, w.admin_note " +
        "FROM merchant_withdrawals w JOIN users u ON u.id = w.user_id" + filter +
        " ORDER BY CASE w.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 WHEN 'processing' THEN 2 ELSE 3 END, w.requested_at ASC LIMIT ? OFFSET ?"
      ).bind(...binds, pageSize, offset).all(),
      context.db.prepare("SELECT COUNT(*) AS total FROM merchant_withdrawals w" + filter).bind(...binds).first()
    ]);
    const total = Number(count?.total || 0);
    return json({ items: rows.results || [], pagination: { page, page_size: pageSize, total, pages: Math.ceil(total / pageSize) } });
  } catch (error) {
    console.error("[admin/withdrawals:list]", String(error?.message || error).slice(0, 180));
    return json({ error: "暂时无法读取提现申请。" }, 503);
  }
}
