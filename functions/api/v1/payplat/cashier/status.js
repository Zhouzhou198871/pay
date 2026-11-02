import { json } from "../../../../_lib/auth.js";
export async function onRequestGet({request,env}) {
  const tradeNo=new URL(request.url).searchParams.get("trade_no")||"";
  if(!tradeNo) return json({code:400,msg:"缺少订单号"},400);
  const order=await env.AUTH_DB.prepare("SELECT trade_no,amount_cents,method,subject,status,pay_info,pay_url,created_at,paid_at FROM payment_orders WHERE trade_no=? LIMIT 1").bind(tradeNo).first();
  if(!order) return json({code:404,msg:"订单不存在"},404);
  return json({code:0,msg:"success",data:{trade_no:order.trade_no,amount:(order.amount_cents/100).toFixed(2),method:order.method,name:order.subject,status:order.status,paid:order.status==="paid",pay_info:order.pay_info,payurl:order.pay_url,created_at:order.created_at,paid_at:order.paid_at}});
}
