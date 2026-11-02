import { json } from "../../_lib/auth.js";
import { userContext, walletBalance, formatUsdt } from "../../_lib/wallet.js";
export async function onRequestGet({request,env}) {
  const ctx=await userContext(request,env); if(ctx.response) return ctx.response;
  const balance=await walletBalance(ctx.db,ctx.user.id);
  return json({currency:"USDT",balance_micro:balance,balance:formatUsdt(balance)});
}
