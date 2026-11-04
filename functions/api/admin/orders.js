import { adminContext } from "../../_lib/admin.js";
import { json } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const context = await adminContext(request, env);
  if (context.response) return context.response;
  const url = new URL(request.url);
  const page = Math.max(1, Math.min(100000, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1));
  const pageSize = Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get("page_size") || "50", 10) || 50));
  const offset = (page - 1) * pageSize;
  const where = " FROM payment_orders po JOIN pay_merchants pm ON pm.id = po.merchant_id LEFT JOIN users u ON u.id = pm.user_id";
  try {
    const [rows, count] = await Promise.all([
      context.db.prepare(
        "SELECT po.id, po.out_trade_no AS merchant_order_no, po.subject, COALESCE(po.amount_micro, po.amount_cents * 10000) AS amount_micro, " +
        "po.amount_cents, po.currency, po.status, po.method AS payment_channel, po.created_at, po.paid_at, " +
        "pm.id AS merchant_id, pm.site_name AS merchant_name, u.email AS user_email" + where +
        " ORDER BY po.created_at DESC, po.id DESC LIMIT ? OFFSET ?"
      ).bind(pageSize, offset).all(),
      context.db.prepare("SELECT COUNT(*) AS total" + where).first()
    ]);
    const total = Number(count?.total || 0);
    return json({ items: rows.results || [], pagination: { page, page_size: pageSize, total, pages: Math.ceil(total / pageSize) } });
  } catch (error) {
    console.error("[admin/orders:list]", String(error?.message || error).slice(0, 180));
    return json({ error: "暂时无法读取全站支付订单。" }, 503);
  }
}
