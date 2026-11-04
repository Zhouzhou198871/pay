import { merchantContext, pagination } from "../../_lib/merchant.js";
import { json } from "../../_lib/auth.js";

function dateBound(value, end = false) {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(raw + (end ? "T23:59:59Z" : "T00:00:00Z"));
  const seconds = Math.floor(date.getTime() / 1000);
  return Number.isFinite(seconds) ? seconds : null;
}

export async function onRequestGet({ request, env }) {
  const context = await merchantContext(request, env);
  if (context.response) return context.response;
  const { page, pageSize, offset } = pagination(request);
  const url = new URL(request.url);
  const filters = ["pm.user_id = ?"];
  const values = [context.user.id];
  const searchType = String(url.searchParams.get("search_type") || "trade_no");
  const keyword = String(url.searchParams.get("keyword") || "").trim().slice(0, 120);
  if (keyword) {
    const column = searchType === "out_trade_no" ? "po.out_trade_no" : searchType === "subject" ? "po.subject" : "po.trade_no";
    filters.push(column + " LIKE ?");
    values.push("%" + keyword.replace(/[\\%_]/g, "\\$&") + "%");
  }
  const method = String(url.searchParams.get("method") || "").trim();
  if (method) { filters.push("po.pay_type = ?"); values.push(method); }
  const status = String(url.searchParams.get("status") || "").trim();
  if (status && ["pending","paid","failed","cancelled","refunded"].includes(status)) { filters.push("po.status = ?"); values.push(status); }
  const start = dateBound(url.searchParams.get("start_date"));
  const end = dateBound(url.searchParams.get("end_date"), true);
  if (start !== null) { filters.push("po.created_at >= ?"); values.push(start); }
  if (end !== null) { filters.push("po.created_at <= ?"); values.push(end); }
  const where = " FROM payment_orders po JOIN pay_merchants pm ON pm.id = po.merchant_id LEFT JOIN merchant_ledger ml ON ml.related_type = 'payment_order' AND ml.related_id = po.id AND ml.user_id = pm.user_id WHERE " + filters.join(" AND ");
  try {
    const [rows, count] = await Promise.all([
      context.db.prepare(
        "SELECT po.id, po.trade_no AS system_order_no, po.out_trade_no AS merchant_order_no, po.subject, " +
        "COALESCE(po.amount_micro, po.amount_cents * 10000) AS amount_micro, po.amount_cents, po.actual_paid_cents, " +
        "po.fee_cents, po.credit_cents, COALESCE(ml.amount_micro, po.credit_cents * 10000) AS credit_micro, " +
        "po.currency, po.status, po.pay_type AS payment_channel, po.method, po.provider_trade_no, po.created_at, po.paid_at, " +
        "NULL AS refunded_at" + where +
        " ORDER BY po.created_at DESC, po.id DESC LIMIT ? OFFSET ?"
      ).bind(...values, pageSize, offset).all(),
      context.db.prepare("SELECT COUNT(*) AS total" + where).bind(...values).first()
    ]);
    const total = Number(count?.total || 0);
    return json({ items: rows.results || [], pagination: { page, page_size: pageSize, total, pages: Math.ceil(total / pageSize) } });
  } catch (error) {
    console.error("[merchant/orders]", String(error?.message || error).slice(0, 180));
    return json({ error: "暂时无法读取商户订单，请稍后重试。" }, 503);
  }
}
