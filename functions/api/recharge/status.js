import { json, currentUser } from "../../_lib/auth.js";
import { formatUsdt, creditWallet } from "../../_lib/wallet.js";
import { queryAlipayOrder } from "../../_lib/payment.js";
export async function onRequestGet({request,env}) {
  const user=await currentUser(request,env.AUTH_DB);
  if(!user) return json({error:"请先登录。"},401);
  const tradeNo=new URL(request.url).searchParams.get("trade_no")||"";
  if(!tradeNo) return json({error:"缺少订单号。"},400);
  const row=await env.AUTH_DB.prepare("SELECT * FROM recharge_orders WHERE trade_no=? AND user_id=? LIMIT 1").bind(tradeNo,user.id).first();
  if(!row) return json({error:"充值订单不存在。"},404);
  if(row.channel==="alipay"&&row.status==="pending") {
    try {
      const confirmed=await queryAlipayOrder(tradeNo,env);
      if(confirmed.paid&&confirmed.amountCents===Number(row.fiat_cents)) {
        const now=Math.floor(Date.now()/1000);
        await env.AUTH_DB.prepare("UPDATE recharge_orders SET status='paid',provider_trade_no=?,paid_at=? WHERE trade_no=? AND status='pending' AND fiat_cents=?")
          .bind(String(confirmed.providerTradeNo||""),now,tradeNo,row.fiat_cents).run();
        const latest=await env.AUTH_DB.prepare("SELECT status,paid_at FROM recharge_orders WHERE trade_no=?").bind(tradeNo).first();
        if(latest?.status==="paid") await creditWallet({db:env.AUTH_DB,userId:user.id,sourceKey:"alipay:"+tradeNo,sourceType:"alipay_recharge",amountMicro:Number(row.credit_micro),description:"支付宝充值 "+tradeNo,now:Number(latest.paid_at||now)});
        row.status=latest?.status||row.status;
      }
    } catch(error) { console.warn("[recharge/status]",String(error?.message||error).slice(0,140)); }
  }
  return json({trade_no:row.trade_no,channel:row.channel,status:row.status,credit_micro:row.credit_micro,amount_usdt:formatUsdt(row.credit_micro),fiat_cents:row.fiat_cents,fiat_amount:row.fiat_cents==null?null:(row.fiat_cents/100).toFixed(2),created_at:row.created_at,paid_at:row.paid_at});
}
