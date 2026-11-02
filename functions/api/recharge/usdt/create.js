import { json, randomHex } from "../../../_lib/auth.js";
import { userContext, parseUsdtMicro, formatUsdt } from "../../../_lib/wallet.js";
export async function onRequestPost({request,env}) {
  const ctx=await userContext(request,env); if(ctx.response) return ctx.response;
  const body=await request.json().catch(()=>({}));
  const requested=parseUsdtMicro(body.amount_usdt);
  const address=String(env.USDT_TRC20_ADDRESS||""), contract=String(env.USDT_TRC20_CONTRACT||"");
  if(!requested) return json({error:"请输入有效的 USDT 金额（最多 6 位小数）。"},400);
  if(!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)||!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(contract)) return json({error:"USDT TRC20 收款通道尚未配置。"},503);
  // A tiny unique micro-unit suffix attributes a shared-wallet transfer to exactly one user.
  for(let attempt=0;attempt<30;attempt++) {
    const suffix=1+Math.floor(Math.random()*999);
    const payMicro=requested+suffix;
    const tradeNo="QTU"+Date.now().toString(36).toUpperCase()+randomHex(6).toUpperCase();
    try {
      const now=Math.floor(Date.now()/1000);
      await ctx.db.prepare("INSERT INTO recharge_orders (id,trade_no,user_id,channel,status,credit_micro,created_at) VALUES (?,?,?,'usdt_trc20','pending',?,?)")
        .bind(randomHex(16),tradeNo,ctx.user.id,payMicro,now).run();
      return json({trade_no:tradeNo,channel:"usdt_trc20",network:"TRON (TRC20)",address,contract,amount_micro:payMicro,amount_usdt:formatUsdt(payMicro),status:"pending",note:"请按显示的精确金额转账；到账确认后自动入账。"},201);
    } catch(error) {
      if(attempt===29) return json({error:"暂时无法生成唯一充值金额，请重试。"},503);
    }
  }
  return json({error:"暂时无法生成充值订单。"},503);
}
