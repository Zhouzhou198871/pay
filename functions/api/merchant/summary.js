import { merchantContext } from "../../_lib/merchant.js";
import { json } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const context = await merchantContext(request, env);
  if (context.response) return context.response;
  const now = Math.floor(Date.now() / 1000);
  const startOfDay = Math.floor(now / 86400) * 86400;
  try {
    const [balance,today,totals] = await Promise.all([
      context.db.prepare("SELECT balance_micro FROM wallet_accounts WHERE user_id=?").bind(context.user.id).first(),
      context.db.prepare(`SELECT COUNT(*) AS order_count,COALESCE(SUM(amount_micro),0) AS amount_micro FROM (
        SELECT amount_micro,paid_at FROM merchant_orders WHERE user_id=? AND status='paid' AND currency='USDT'
        UNION ALL
        SELECT credit_micro AS amount_micro,paid_at FROM recharge_orders WHERE user_id=? AND status='paid'
      ) WHERE paid_at>=?`).bind(context.user.id,context.user.id,startOfDay).first(),
      context.db.prepare("SELECT (SELECT COUNT(*) FROM merchant_orders WHERE user_id=?)+(SELECT COUNT(*) FROM recharge_orders WHERE user_id=?) AS order_count")
        .bind(context.user.id,context.user.id).first()
    ]);
    return json({
      balance_micro: balance?.balance_micro ?? 0,
      currency: "USDT",
      today_paid_orders: today?.order_count || 0,
      today_paid_amount_micro: today?.amount_micro || 0,
      total_orders: totals?.order_count || 0
    });
  } catch (error) {
    console.error("[merchant/summary]", String(error?.message || error).slice(0, 180));
    return json({ error: "暂时无法读取账户汇总。" }, 503);
  }
}
