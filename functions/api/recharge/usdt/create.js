import { json, randomHex } from "../../../_lib/auth.js";
import { userContext, parseUsdtMicro, formatUsdt } from "../../../_lib/wallet.js";
export async function onRequestPost({request,env}) {
  const ctx=await userContext(request,env); if(ctx.response) return ctx.response;
  const body=await request.json().catch(()=>({}));
  const requested=parseUsdtMicro(body.amount_usdt);
  const address=String(env.USDT_TRC20_ADDRESS||""), contract=String(env.USDT_TRC20_CONTRACT||"");
  if(!requested) return json({error:"请输入有效的 USDT 金额（最多 6 位小数）。"},400);
  if(!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)||!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(contract)) return json({error:"USDT TRC20 收款通道尚未配置。"},503);
  for(let attempt=0;attempt<60;attempt++) {
    const suffix=1+Math.floor(Math.random()*999), expectedMicro=requested+suffix;
    const tradeNo="QTU"+Date.now().toString(36).toUpperCase()+randomHex(6).toUpperCase();
    try {
      const now=Math.floor(Date.now()/1000), expires=now+600;
      await ctx.db.prepare("INSERT INTO recharge_orders (id,trade_no,user_id,channel,status,credit_micro,expected_micro,expires_at,created_at) VALUES (?,?,?,'usdt_trc20','pending',?,?,?,?)")
        .bind(randomHex(16),tradeNo,ctx.user.id,requested,expectedMicro,expires,now).run();
      return json({trade_no:tradeNo,channel:"usdt_trc20",network:"TRON (TRC20)",address,contract,credit_micro:requested,amount_micro:expectedMicro,amount_usdt:formatUsdt(expectedMicro),credit_usdt:formatUsdt(requested),expires_at:expires,status:"pending",note:"请在订单创建后 10 分钟（600 秒）内按显示的精确金额转账；超时到账作废，多出的微量尾数仅用于识别订单，不计入余额。"},201);
    } catch(error) {
      if(attempt===59) return json({error:"暂时无法生成唯一充值金额，请重试。"},503);
    }
  }
  return json({error:"暂时无法生成充值订单。"},503);
}
