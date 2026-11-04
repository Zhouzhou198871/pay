import { merchantContext, pagination } from "../../_lib/merchant.js";
import { json } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const context = await merchantContext(request, env);
  if (context.response) return context.response;
  const { page, pageSize, offset } = pagination(request);
  const url = new URL(request.url);
  const status = String(url.searchParams.get("status") || "all");
  const allowed = new Set(["all","pending","approved","processing","paid","rejected","cancelled"]);
  if (!allowed.has(status)) return json({ error: "提现状态筛选值无效。" }, 400);
  const filters = ["w.user_id = ?"];
  const binds = [context.user.id];
  if (status !== "all") { filters.push("w.status = ?"); binds.push(status); }
  const where = " WHERE " + filters.join(" AND ");
  try {
    const [rows, count, summary, profile] = await Promise.all([
      context.db.prepare("SELECT w.id, w.request_no, w.amount_micro, w.fee_micro, w.currency, w.destination_masked, w.status, w.requested_at, w.reviewed_at, w.payout_reference, w.withdraw_type, w.fee_amount, w.payout_amount_micro, w.payout_amount_cents, w.total_debit_micro, pm.usdt_network FROM merchant_withdrawals w LEFT JOIN pay_merchants pm ON pm.user_id = w.user_id " + where + " ORDER BY w.requested_at DESC, w.id DESC LIMIT ? OFFSET ?")
        .bind(...binds, pageSize, offset).all(),
      context.db.prepare("SELECT COUNT(*) AS total FROM merchant_withdrawals w" + where).bind(...binds).first(),
      context.db.prepare(`SELECT
        COALESCE((SELECT balance_after_micro FROM merchant_ledger WHERE user_id = ? AND currency = 'USDT' ORDER BY created_at DESC, rowid DESC LIMIT 1), 0) AS available_micro,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN COALESCE(NULLIF(total_debit_micro,0),amount_micro+fee_micro) ELSE 0 END), 0) AS pending_micro,
        COALESCE(SUM(CASE WHEN status IN ('approved','processing') THEN COALESCE(NULLIF(total_debit_micro,0),amount_micro+fee_micro) ELSE 0 END), 0) AS reviewing_micro,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN COALESCE(NULLIF(payout_amount_micro,0),amount_micro) ELSE 0 END), 0) AS paid_micro
        FROM merchant_withdrawals WHERE user_id = ? AND currency = 'USDT'`).bind(context.user.id, context.user.id).first(),
      context.db.prepare("SELECT usdt_address, usdt_network FROM pay_merchants WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").bind(context.user.id).first()
    ]);
    const total = Number(count?.total || 0);
    return json({
      items: rows.results || [],
      summary: {
        available_micro: Number(summary?.available_micro || 0),
        pending_micro: Number(summary?.pending_micro || 0),
        reviewing_micro: Number(summary?.reviewing_micro || 0),
        paid_micro: Number(summary?.paid_micro || 0)
      },
      payout: { address: profile?.usdt_address || "", network: profile?.usdt_network || "USDT-TRC20" },
      withdrawal_config: { usdt_cny_rate: Number(env.WITHDRAW_USDT_CNY_RATE || 0) },
      pagination: { page, page_size: pageSize, total, pages: Math.ceil(total / pageSize) }
    });
  } catch (error) {
    console.error("[merchant/withdrawals]", String(error?.message || error).slice(0, 180));
    return json({ error: "暂时无法读取提现记录，请稍后重试。" }, 503);
  }
}
