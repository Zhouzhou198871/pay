import { json } from "../../../../_lib/auth.js";
import { jsonBody, queryAlipayOrder, sha256, settleConfirmedOrder } from "../../../../_lib/payment.js";

export async function onRequestPost({request,env,waitUntil}) {
  const params=await jsonBody(request);
  const tradeNo=String(params.out_trade_no||"").trim();
  if(!tradeNo) return new Response("fail",{status:400,headers:{"Content-Type":"text/plain"}});
  const order=await env.AUTH_DB.prepare("SELECT trade_no,status,amount_cents FROM payment_orders WHERE trade_no=? LIMIT 1").bind(tradeNo).first();
  if(!order) return new Response("fail",{status:404,headers:{"Content-Type":"text/plain"}});
  if(order.status==="paid") return new Response("success",{headers:{"Content-Type":"text/plain"}});
  try {
    const confirmed=await queryAlipayOrder(tradeNo,env);
    if(!confirmed.paid) return new Response("fail",{status:409,headers:{"Content-Type":"text/plain"}});
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
