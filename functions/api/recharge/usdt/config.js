import { json } from "../../../_lib/auth.js";
import { DEFAULT_USDT_TRC20_CONTRACT } from "../../../_lib/tron.js";
export async function onRequestGet({env}) {
  const address=String(env.USDT_TRC20_ADDRESS||"");
  const contract=String(env.USDT_TRC20_CONTRACT||DEFAULT_USDT_TRC20_CONTRACT);
  if(!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)||!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(contract)) return json({error:"USDT TRC20 收款通道尚未配置。"},503);
  return json({channel:"usdt_trc20",network:"TRON (TRC20)",currency:"USDT",address,contract});
}
