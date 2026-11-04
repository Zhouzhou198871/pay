import { merchantContext } from "../../_lib/merchant.js";
import { json } from "../../_lib/auth.js";

const SUMMARY_SQL = `
SELECT
  (SELECT COUNT(*)
   FROM payment_orders po
   JOIN pay_merchants pm ON pm.id = po.merchant_id
   WHERE pm.user_id = ? AND po.status = 'paid') AS total_orders,
  (SELECT COUNT(*)
   FROM payment_orders po
   JOIN pay_merchants pm ON pm.id = po.merchant_id
   WHERE pm.user_id = ? AND po.status = 'paid'
     AND DATE(po.created_at, 'unixepoch') = DATE('now')) AS today_orders
`;

const BALANCES_SQL = `
WITH currencies AS (
  SELECT currency FROM merchant_ledger WHERE user_id = ?
  UNION SELECT currency FROM merchant_withdrawals WHERE user_id = ?
  UNION SELECT 'USDT'
),
latest_ledger AS (
  SELECT currency, balance_after_micro,
         ROW_NUMBER() OVER (PARTITION BY currency ORDER BY created_at DESC, rowid DESC) AS rn
  FROM merchant_ledger WHERE user_id = ?
),
pending AS (
  SELECT currency, SUM(amount_micro) AS pending_micro
  FROM merchant_withdrawals
  WHERE user_id = ? AND status IN ('pending', 'approved', 'processing')
  GROUP BY currency
)
SELECT currencies.currency,
       COALESCE(latest_ledger.balance_after_micro, 0) AS available_micro,
       COALESCE(pending.pending_micro, 0) AS pending_micro,
       COALESCE(latest_ledger.balance_after_micro, 0) + COALESCE(pending.pending_micro, 0) AS total_micro
FROM currencies
LEFT JOIN latest_ledger ON latest_ledger.currency = currencies.currency AND latest_ledger.rn = 1
LEFT JOIN pending ON pending.currency = currencies.currency
ORDER BY CASE currencies.currency WHEN 'USDT' THEN 0 WHEN 'CNY' THEN 1 ELSE 2 END, currencies.currency
`;

const CHANNELS_SQL = `
WITH owned_merchants AS (
  SELECT id FROM pay_merchants WHERE user_id = ?
),
channel_sources AS (
  SELECT channel_code, display_name, status
  FROM merchant_payment_channels WHERE user_id = ?
  UNION
  SELECT DISTINCT po.method,
         CASE po.method WHEN 'alipay' THEN '支付宝' WHEN 'wechat' THEN '微信支付' ELSE po.method END,
         'observed'
  FROM payment_orders po
  JOIN owned_merchants om ON om.id = po.merchant_id
  WHERE NOT EXISTS (
    SELECT 1 FROM merchant_payment_channels c
    WHERE c.user_id = ? AND lower(c.channel_code) = lower(po.method)
  )
)
SELECT c.channel_code, c.display_name, c.status,
       COALESCE(SUM(CASE WHEN po.status = 'paid' AND DATE(po.paid_at, 'unixepoch') = DATE('now')
                         THEN po.amount_cents ELSE 0 END), 0) AS today_amount_cents,
       COALESCE(SUM(CASE WHEN po.status = 'paid' AND DATE(po.paid_at, 'unixepoch') = DATE('now', '-1 day')
                         THEN po.amount_cents ELSE 0 END), 0) AS yesterday_amount_cents,
       COALESCE(100.0 * SUM(CASE WHEN po.status = 'paid' THEN 1 ELSE 0 END)
                / NULLIF(COUNT(po.id), 0), 0) AS success_rate,
       COALESCE(100.0 * SUM(CASE WHEN po.status = 'paid' THEN po.fee_cents ELSE 0 END)
                / NULLIF(SUM(CASE WHEN po.status = 'paid' THEN po.amount_cents ELSE 0 END), 0), 0) AS fee_rate
FROM channel_sources c
LEFT JOIN owned_merchants om ON 1 = 1
LEFT JOIN payment_orders po ON po.merchant_id = om.id AND lower(po.method) = lower(c.channel_code)
GROUP BY c.channel_code, c.display_name, c.status
ORDER BY c.display_name
`;

const TREND_SQL = `
WITH RECURSIVE days(day, idx) AS (
  SELECT DATE('now', '-6 days'), 0
  UNION ALL SELECT DATE(day, '+1 day'), idx + 1 FROM days WHERE idx < 6
),
daily AS (
  SELECT DATE(po.paid_at, 'unixepoch') AS day,
         SUM(po.amount_cents) AS amount_cents,
         COUNT(*) AS orders
  FROM payment_orders po
  JOIN pay_merchants pm ON pm.id = po.merchant_id
  WHERE pm.user_id = ? AND po.status = 'paid'
    AND po.paid_at >= UNIXEPOCH('now', '-6 days', 'start of day')
  GROUP BY DATE(po.paid_at, 'unixepoch')
)
SELECT days.day,
       COALESCE(daily.amount_cents, 0) AS amount_cents,
       COALESCE(daily.orders, 0) AS orders
FROM days LEFT JOIN daily ON daily.day = days.day
ORDER BY days.day
`;

export async function onRequestGet({ request, env }) {
  const context = await merchantContext(request, env);
  if (context.response) return context.response;
  const userId = context.user.id;

  try {
    const [summary, balances, channels, trend] = await Promise.all([
      context.db.prepare(SUMMARY_SQL).bind(userId, userId).first(),
      context.db.prepare(BALANCES_SQL).bind(userId, userId, userId, userId).all(),
      context.db.prepare(CHANNELS_SQL).bind(userId, userId, userId).all(),
      context.db.prepare(TREND_SQL).bind(userId).all()
    ]);

    const days = trend.results || [];
    const totalAmountCents = days.reduce((sum, day) => sum + Number(day.amount_cents || 0), 0);
    const totalTrendOrders = days.reduce((sum, day) => sum + Number(day.orders || 0), 0);

    return json({
      user: {
        display_name: context.user.display_name || null,
        username: context.user.username || null
      },
      summary: {
        total_orders: Number(summary?.total_orders || 0),
        today_orders: Number(summary?.today_orders || 0)
      },
      balances: balances.results || [],
      channels: channels.results || [],
      trend: {
        total_amount_cents: totalAmountCents,
        total_orders: totalTrendOrders,
        days
      }
    });
  } catch (error) {
    console.error("[merchant/dashboard]", String(error?.message || error).slice(0, 240));
    return json({ error: "暂时无法读取 Dashboard 统计，请稍后重试。" }, 503);
  }
}
