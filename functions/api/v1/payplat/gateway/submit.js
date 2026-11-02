import { json } from "../../../../_lib/auth.js";
import { amountToCents, merchantForRequest, createAlipayOrder, randomHex } from "../../../../_lib/payment.js";

export async function onRequestPost({request,env}) {
  if(!env.AUTH_DB) return json({code:503,msg:"支付数据库不可用"},503);
  const auth=await merchantForRequest(request,env); if(auth.response) return auth.response;
  const {merchant,params}=auth;
  const amount=amountToCents(params.money??params.amount);
  const outNo=String(params.out_trade_no||"").trim();
  const subject=String(params.name||"商品订单").trim().slice(0,120);
  const method=String(params.type||"alipay").toLowerCase();
  const notifyUrl=String(params.notify_url||merchant.notify_url||"").trim();
  if(!outNo||outNo.length>128||!amount||!subject) return json({code:400,msg:"订单号、金额或商品名称无效"},400);
  if(method!=="alipay") return json({code:400,msg:"该支付渠道尚未在 Cloudflare 完成安全迁移"},400);
  if(notifyUrl && !await (await import("../../../../_lib/payment.js")).validPublicHttpsUrl(notifyUrl)) return json({code:400,msg:"通知地址必须是公网 HTTPS 地址"},400);
  const existing=await env.AUTH_DB.prepare("SELECT * FROM payment_orders WHERE merchant_id=? AND out_trade_no=?").bind(merchant.id,outNo).first();
  if(existing) {
    if(existing.amount_cents!==amount) return json({code:409,msg:"商户订单号已存在且金额不一致"},409);
    return json({code:0,msg:"success",data:{trade_no:existing.trade_no,payurl:existing.pay_url,pay_info:existing.pay_info,money:(existing.amount_cents/100).toFixed(2),status:existing.status}});
  }
  const tradeNo="QT"+Date.now().toString(36).toUpperCase()+randomHex(8).toUpperCase();
  let payment;
  try { payment=await createAlipayOrder({tradeNo,amountCents:amount,subject,env}); }
  catch(error) { console.error("[payment/create]",String(error?.message||error).slice(0,180)); return json({code:503,msg:"支付渠道暂不可用，请稍后重试"},503); }
  const now=Math.floor(Date.now()/1000);
  try {
    await env.AUTH_DB.prepare("INSERT INTO payment_orders (id,trade_no,merchant_id,app_id,out_trade_no,amount_cents,method,subject,status,provider_trade_no,pay_url,pay_info,notify_url,created_at) VALUES (?,?,?,?,?,?,? ,?,'pending',?,?,?,?,?)")
      .bind(randomHex(16),tradeNo,merchant.id,merchant.app_id,outNo,amount,method,subject,payment.providerTradeNo,payment.payUrl,payment.payInfo,notifyUrl,now).run();
  } catch(error) {
    const duplicate=await env.AUTH_DB.prepare("SELECT * FROM payment_orders WHERE merchant_id=? AND out_trade_no=?").bind(merchant.id,outNo).first();
    if(duplicate) return json({code:409,msg:"重复订单请求，请使用原订单查询"});
    console.error("[payment/order-insert]",String(error?.message||error).slice(0,160)); return json({code:503,msg:"订单保存失败，请勿重复支付"},503);
  }
  return json({code:0,msg:"success",data:{trade_no:tradeNo,payurl:payment.payUrl,pay_info:payment.payInfo,money:(amount/100).toFixed(2),status:"pending"}});
}
