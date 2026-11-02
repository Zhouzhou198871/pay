import { json } from "../../../../_lib/auth.js";
import { merchantForRequest, centsToYuan } from "../../../../_lib/payment.js";
export async function onRequestGet({request,env}) {
  const auth=await merchantForRequest(request,env); if(auth.response) return auth.response;
  const {merchant,params}=auth;
  const order=await env.AUTH_DB.prepare("SELECT trade_no,out_trade_no,amount_cents,status,created_at,paid_at FROM payment_orders WHERE merchant_id=? AND out_trade_no=? LIMIT 1").bind(merchant.id,String(params.out_trade_no||"")).first();
  if(!order) return json({code:404,msg:"订单不存在"},404);
  return json({code:0,msg:"success",data:{trade_no:order.trade_no,out_trade_no:order.out_trade_no,money:centsToYuan(order.amount_cents),status:order.status==="paid"?1:0,trade_status:order.status==="paid"?"TRADE_SUCCESS":"WAIT_PAY",created_at:order.created_at,paid_at:order.paid_at}});
}
