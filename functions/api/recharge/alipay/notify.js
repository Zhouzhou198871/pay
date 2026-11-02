import { jsonBody, queryAlipayOrder } from "../../../_lib/payment.js";
import { creditWallet } from "../../../_lib/wallet.js";
export async function onRequestPost({request,env}) {
  const fail=(status=400)=>new Response("fail",{status,headers:{"Content-Type":"text/plain"}});
  const params=await jsonBody(request);
  const tradeNo=String(params.out_trade_no||"").trim();
  if(!tradeNo||!env.AUTH_DB) return fail();
  const order=await env.AUTH_DB.prepare("SELECT * FROM recharge_orders WHERE trade_no=? AND channel='alipay' LIMIT 1").bind(tradeNo).first();
  if(!order) return fail(404);
  try {
    if(order.status!=="paid") {
      const confirmed=await queryAlipayOrder(tradeNo,env);
      if(!confirmed.paid||confirmed.amountCents!==Number(order.fiat_cents)) return fail(409);
      const now=Math.floor(Date.now()/1000);
      await env.AUTH_DB.prepare("UPDATE recharge_orders SET status='paid',provider_trade_no=?,paid_at=? WHERE trade_no=? AND status='pending' AND fiat_cents=?")
        .bind(String(confirmed.providerTradeNo||""),now,tradeNo,order.fiat_cents).run();
    }
    const latest=await env.AUTH_DB.prepare("SELECT status,paid_at FROM recharge_orders WHERE trade_no=?").bind(tradeNo).first();
    if(latest?.status!=="paid") return fail(503);
    await creditWallet({db:env.AUTH_DB,userId:order.user_id,sourceKey:"alipay:"+tradeNo,sourceType:"alipay_recharge",amountMicro:Number(order.credit_micro),description:"支付宝充值 "+tradeNo,now:Number(latest.paid_at||Math.floor(Date.now()/1000))});
    return new Response("success",{headers:{"Content-Type":"text/plain"}});
  } catch(error) {
    console.error("[wallet/alipay/notify]",String(error?.message||error).slice(0,160));
    return fail(503);
  }
}
