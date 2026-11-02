import { json, randomHex } from "../../../_lib/auth.js";
import { userContext, parseUsdtMicro } from "../../../_lib/wallet.js";
import { createAlipayOrder } from "../../../_lib/payment.js";

const centsFor = (amountMicro,rateMicro) => Number((BigInt(amountMicro)*BigInt(rateMicro)+5000000000n)/10000000000n);
export async function onRequestPost({request,env}) {
  const ctx=await userContext(request,env); if(ctx.response) return ctx.response;
  const body=await request.json().catch(()=>({}));
  const creditMicro=parseUsdtMicro(body.amount_usdt);
  const rateText=String(env.CNY_PER_USDT||"").trim();
  if(!creditMicro) return json({error:"请输入有效的 USDT 充值金额（最多 6 位小数）。"},400);
  if(!/^\d{1,3}(?:\.\d{1,6})?$/.test(rateText)) return json({error:"人民币兑 USDT 汇率尚未配置。"},503);
  const [rw,rf=""]=rateText.split(".");
  const rateMicro=Number(BigInt(rw)*1000000n+BigInt((rf+"000000").slice(0,6)));
  if(!Number.isSafeInteger(rateMicro)||rateMicro<=0) return json({error:"人民币兑 USDT 汇率配置无效。"},503);
  const fiatCents=centsFor(creditMicro,rateMicro);
  if(!Number.isSafeInteger(fiatCents)||fiatCents<1||fiatCents>100000000) return json({error:"换算后的人民币金额超出范围。"},400);
  const tradeNo="QTR"+Date.now().toString(36).toUpperCase()+randomHex(8).toUpperCase();
  const now=Math.floor(Date.now()/1000);
  try {
    await ctx.db.prepare("INSERT INTO recharge_orders (id,trade_no,user_id,channel,status,credit_micro,fiat_cents,fiat_currency,fx_rate_micros,created_at) VALUES (?,?,?,'alipay','pending',?,?,'CNY',?,?)")
      .bind(randomHex(16),tradeNo,ctx.user.id,creditMicro,fiatCents,rateMicro,now).run();
  } catch(error) {
    console.error("[wallet/alipay/save]",String(error?.message||error).slice(0,140));
    return json({error:"订单保存失败，请稍后重试。"},503);
  }
  try {
    const pay=await createAlipayOrder({tradeNo,amountCents:fiatCents,subject:"晴天支付账户充值",env});
    if(pay.providerTradeNo) await ctx.db.prepare("UPDATE recharge_orders SET provider_trade_no=? WHERE trade_no=? AND status='pending'").bind(pay.providerTradeNo,tradeNo).run();
    return json({trade_no:tradeNo,channel:"alipay",status:"pending",credit_usdt_micro:creditMicro,credit_usdt:(creditMicro/1e6).toFixed(6),fiat_cny_cents:fiatCents,fiat_cny:(fiatCents/100).toFixed(2),fx_rate:(rateMicro/1e6).toFixed(6),pay_url:pay.payUrl,pay_info:pay.payInfo});
  } catch(error) {
    console.error("[wallet/alipay/create]",String(error?.message||error).slice(0,160));
    await ctx.db.prepare("UPDATE recharge_orders SET status='cancelled' WHERE trade_no=? AND status='pending'").bind(tradeNo).run().catch(()=>{});
    return json({error:"支付宝渠道暂不可用，请稍后重试。"},503);
  }
}
