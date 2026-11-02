import { json, randomHex } from "../../../_lib/auth.js";
import { creditWallet } from "../../../_lib/wallet.js";

// Protect this endpoint with a long random Cloudflare Secret; invoke it from a scheduled external worker/Cron.
export async function onRequestPost({request,env}) {
  const supplied=(request.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  const expected=String(env.USDT_SCAN_SECRET||"");
  if(!expected||supplied.length!==expected.length) return json({error:"无权访问。"},403);
  let diff=0; for(let i=0;i<supplied.length;i++) diff|=supplied.charCodeAt(i)^expected.charCodeAt(i);
  if(diff!==0) return json({error:"无权访问。"},403);
  const address=String(env.USDT_TRC20_ADDRESS||"");
  const contract=String(env.USDT_TRC20_CONTRACT||"");
  if(!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)||!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(contract)) return json({error:"USDT TRC20 收款配置无效。"},503);
  const base=String(env.TRONGRID_API_URL||"https://api.trongrid.io").replace(/\/$/,"");
  const url=new URL(base+"/v1/accounts/"+address+"/transactions/trc20");
  url.searchParams.set("only_confirmed","true"); url.searchParams.set("limit","200"); url.searchParams.set("contract_address",contract);
  const headers={Accept:"application/json"}; if(env.TRONGRID_API_KEY) headers["TRON-PRO-API-KEY"]=env.TRONGRID_API_KEY;
  const response=await fetch(url,{headers,signal:AbortSignal.timeout(12000)});
  if(!response.ok) return json({error:"链上数据源暂不可用。"},503);
  const payload=await response.json();
  const rows=Array.isArray(payload.data)?payload.data:[];
  let credited=0,ignored=0;
  for(const tx of rows) {
    const info=tx.token_info||{};
    if(String(tx.to||"").toLowerCase()!==address.toLowerCase()||String(tx.token_info?.address||"").toLowerCase()!==contract.toLowerCase()) {ignored++;continue;}
    if(tx.type!=="Transfer"||!tx.transaction_id||tx.block_timestamp==null) {ignored++;continue;}
    const decimals=Number(info.decimals);
    if(!Number.isInteger(decimals)||decimals<0||decimals>18) {ignored++;continue;}
    const raw=BigInt(String(tx.value||"0"));
    const micro=decimals>=6?raw/(10n**BigInt(decimals-6)):raw*(10n**BigInt(6-decimals));
    if(micro<=0n||micro>9000000000000000n) {ignored++;continue;}
    const txHash=String(tx.transaction_id), eventIndex=Number(tx.token_info?.event_index??tx.event_index??0);
    const sourceKey="usdt-trc20:"+txHash+":"+eventIndex;
    const existing=await env.AUTH_DB.prepare("SELECT id FROM recharge_orders WHERE channel='usdt_trc20' AND tx_hash=? AND tx_event_index=?").bind(txHash,eventIndex).first();
    if(existing){ignored++;continue;}
    const memo=String(tx.from||"").slice(0,64);
    // Deposit ownership must be explicit: users generate a pending deposit order and supply its unique memo/address.
    // A shared address without a reliable per-user reference cannot safely attribute transfers to a user.
    const deposit=await env.AUTH_DB.prepare("SELECT * FROM recharge_orders WHERE channel='usdt_trc20' AND status='pending' AND tx_hash=? LIMIT 1").bind(txHash).first();
    if(!deposit){ignored++;continue;}
    const now=Math.floor(Date.now()/1000);
    await env.AUTH_DB.prepare("UPDATE recharge_orders SET status='paid',tx_hash=?,tx_event_index=?,paid_at=? WHERE id=? AND status='pending'").bind(txHash,eventIndex,now,deposit.id).run();
    const result=await creditWallet({db:env.AUTH_DB,userId:deposit.user_id,sourceKey,sourceType:"usdt_deposit",amountMicro:Number(micro),description:"USDT TRC20 链上充值 "+txHash,now});
    if(result.credited) credited++; else ignored++;
  }
  return json({success:true,scanned:rows.length,credited,ignored,next:payload.meta?.fingerprint||null});
}
