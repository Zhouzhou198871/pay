import { merchantContext, pagination } from "../../_lib/merchant.js";
import { json } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const context=await merchantContext(request,env);
  if(context.response) return context.response;
  const {page,pageSize,offset}=pagination(request);
  const union=`
    SELECT id,merchant_order_no,subject,amount_micro,currency,status,payment_channel,created_at,paid_at
    FROM merchant_orders WHERE user_id=?
    UNION ALL
    SELECT id,trade_no AS merchant_order_no,
      CASE channel WHEN 'alipay' THEN '支付宝充值' ELSE 'USDT TRC20 充值' END AS subject,
      credit_micro AS amount_micro,'USDT' AS currency,status,channel AS payment_channel,created_at,paid_at
    FROM recharge_orders WHERE user_id=?
  `;
  try {
    const [rows,count]=await Promise.all([
      context.db.prepare(`SELECT * FROM (${union}) ORDER BY created_at DESC LIMIT ? OFFSET ?`)
        .bind(context.user.id,context.user.id,pageSize,offset).all(),
      context.db.prepare(`SELECT (SELECT COUNT(*) FROM merchant_orders WHERE user_id=?)+(SELECT COUNT(*) FROM recharge_orders WHERE user_id=?) AS total`)
        .bind(context.user.id,context.user.id).first()
    ]);
    const total=Number(count?.total||0);
    return json({items:rows.results||[],pagination:{page,page_size:pageSize,total,pages:Math.ceil(total/pageSize)}});
  } catch(error) {
    console.error("[merchant/orders]",String(error?.message||error).slice(0,180));
    return json({error:"暂时无法读取订单记录。"},503);
  }
}
