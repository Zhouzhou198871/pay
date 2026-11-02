import { json, currentUser } from "../../../_lib/auth.js";
import { formatUsdt } from "../../../_lib/wallet.js";
export async function onRequestGet({request,env}) {
  const user=await currentUser(request,env.AUTH_DB);
  if(!user) return json({error:"请先登录。"},401);
  const tradeNo=new URL(request.url).searchParams.get("trade_no")||"";
  if(!tradeNo) return json({error:"缺少订单号。"},400);
  const row=await env.AUTH_DB.prepare("SELECT trade_no,channel,status,credit_micro,fiat_cents,fiat_currency,created_at,paid_at FROM recharge_orders WHERE trade_no=? AND user_id=? LIMIT 1").bind(tradeNo,user.id).first();
  if(!row) return json({error:"充值订单不存在。"},404);
  return json({...row,amount_usdt:formatUsdt(row.credit_micro),fiat_amount:row.fiat_cents==null?null:(row.fiat_cents/100).toFixed(2)});
}
