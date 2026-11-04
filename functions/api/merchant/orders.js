import { merchantContext, pagination } from "../../_lib/merchant.js";
import { json } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const context = await merchantContext(request, env);
  if (context.response) return context.response;
  const { page, pageSize, offset } = pagination(request);
  try {
    const where = "FROM payment_orders po JOIN pay_merchants pm ON pm.id = po.merchant_id WHERE pm.user_id = ?";
    const [rows, count] = await Promise.all([
      context.db.prepare(
        "SELECT po.id, po.out_trade_no AS merchant_order_no, po.subject, " +
        "COALESCE(po.amount_micro, po.amount_cents * 10000) AS amount_micro, po.currency, po.status, " +
        "po.method AS payment_channel, po.created_at, po.paid_at " + where +
        " ORDER BY po.created_at DESC, po.id DESC LIMIT ? OFFSET ?"
      ).bind(context.user.id, pageSize, offset).all(),
      context.db.prepare("SELECT COUNT(*) AS total " + where).bind(context.user.id).first()
    ]);
    const total = Number(count?.total || 0);
    return json({
      items: rows.results || [],
      pagination: { page, page_size: pageSize, total, pages: Math.ceil(total / pageSize) }
    });
  } catch (error) {
    console.error("[merchant/orders]", String(error?.message || error).slice(0, 180));
    return json({ error: "暂时无法读取商户订单，请稍后重试。" }, 503);
  }
}
