import { json, sha256 } from "../../../_lib/auth.js";
import { jsonBody, queryAlipayOrder, settleConfirmedOrder } from "../../../_lib/payment.js";
import { creditWallet } from "../../../_lib/wallet.js";

export async function onRequestPost({request,env,waitUntil}) {
  const params=await jsonBody(request);
  const tradeNo=String(params.out_trade_no||"").trim();
  if(!tradeNo) return new Response("fail",{status:400,headers:{"Content-Type":"text/plain"}});
  const walletOrder=await env.AUTH_DB.prepare("SELECT * FROM recharge_orders WHERE trade_no=? AND channel='alipay' LIMIT 1").bind(tradeNo).first();
  if(walletOrder) {
    try {
      if(walletOrder.status!=="paid") {
        const confirmed=await queryAlipayOrder(tradeNo,env);
        if(!confirmed.paid||confirmed.amountCents!==Number(walletOrder.fiat_cents)) return new Response("fail",{status:409,headers:{"Content-Type":"text/plain"}});
        const now=Math.floor(Date.now()/1000);
        await env.AUTH_DB.prepare("UPDATE recharge_orders SET status='paid',provider_trade_no=?,paid_at=? WHERE trade_no=? AND status='pending' AND fiat_cents=?")
          .bind(String(confirmed.providerTradeNo||""),now,tradeNo,walletOrder.fiat_cents).run();
      }
      const latest=await env.AUTH_DB.prepare("SELECT status,paid_at FROM recharge_orders WHERE trade_no=?").bind(tradeNo).first();
      if(latest?.status!=="paid") return new Response("fail",{status:503,headers:{"Content-Type":"text/plain"}});
      await creditWallet({db:env.AUTH_DB,userId:walletOrder.user_id,sourceKey:"alipay:"+tradeNo,sourceType:"alipay_recharge",amountMicro:Number(walletOrder.credit_micro),description:"支付宝充值 "+tradeNo,now:Number(latest.paid_at||Math.floor(Date.now()/1000))});
      return new Response("success",{headers:{"Content-Type":"text/plain"}});
    } catch(error) {
      console.error("[wallet/alipay/notify]",String(error?.message||error).slice(0,180));
      return new Response("fail",{status:503,headers:{"Content-Type":"text/plain"}});
    }
  }
  const order=await env.AUTH_DB.prepare("SELECT trade_no,status,amount_cents FROM payment_orders WHERE trade_no=? LIMIT 1").bind(tradeNo).first();
  if(!order) return new Response("fail",{status:404,headers:{"Content-Type":"text/plain"}});
  if(order.status==="paid") {
    try { await settleConfirmedOrder(env,tradeNo,"",await sha256(JSON.stringify(params))); return new Response("success",{headers:{"Content-Type":"text/plain"}}); }
    catch { return new Response("fail",{status:503,headers:{"Content-Type":"text/plain"}}); }
  }
  try {
    const confirmed=await queryAlipayOrder(tradeNo,env);
    if(!confirmed.paid||confirmed.amountCents!==Number(order.amount_cents)) return new Response("fail",{status:409,headers:{"Content-Type":"text/plain"}});
    const result=await settleConfirmedOrder(env,tradeNo,confirmed.providerTradeNo,await sha256(JSON.stringify(params)));
    if(!result.ok) return new Response("fail",{status:503,headers:{"Content-Type":"text/plain"}});
    if(waitUntil) waitUntil(deliverPendingNotice(env,tradeNo));
    return new Response("success",{headers:{"Content-Type":"text/plain"}});
  } catch(error) {
    console.error("[payment/notify]",String(error?.message||error).slice(0,180));
    return new Response("fail",{status:503,headers:{"Content-Type":"text/plain"}});
  }
}
async function deliverPendingNotice(env,tradeNo) {
  const row=await env.AUTH_DB.prepare("SELECT * FROM payment_webhook_deliveries WHERE trade_no=? AND status='pending' ORDER BY created_at LIMIT 1").bind(tradeNo).first();
  if(!row) return;
  try {
    const u=new URL(row.target_url);
    if(u.protocol!=="https:") throw new Error("HTTPS required");
    const response=await fetch(u,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams(JSON.parse(row.payload_json)),redirect:"error",signal:AbortSignal.timeout(8000)});
    if(!response.ok) throw new Error("merchant HTTP "+response.status);
    await env.AUTH_DB.prepare("UPDATE payment_webhook_deliveries SET status='delivered',attempts=attempts+1,last_status_code=?,delivered_at=? WHERE id=? AND status='pending'").bind(response.status,Math.floor(Date.now()/1000),row.id).run();
  } catch(error) {
    const attempts=row.attempts+1, now=Math.floor(Date.now()/1000), status=attempts>=8?"failed":"pending";
    await env.AUTH_DB.prepare("UPDATE payment_webhook_deliveries SET status=?,attempts=?,next_attempt_at=?,last_error=? WHERE id=? AND status='pending'").bind(status,attempts,now+Math.min(3600,30*2**attempts),String(error?.message||error).slice(0,180),row.id).run();
  }
}
