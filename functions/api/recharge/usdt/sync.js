import { json } from "../../../_lib/auth.js";
import { creditWallet } from "../../../_lib/wallet.js";

export async function onRequestPost({request,env}) {
  const supplied=(request.headers.get("Authorization")||"").replace(/^Bearer\\s+/i,"");
  const expected=String(env.USDT_SCAN_SECRET||"");
  if(!expected||supplied.length!==expected.length) return json({error:"无权访问。"},403);
  let diff=0; for(let i=0;i<supplied.length;i++) diff|=supplied.charCodeAt(i)^expected.charCodeAt(i);
  if(diff!==0) return json({error:"无权访问。"},403);
  const address=String(env.USDT_TRC20_ADDRESS||""), contract=String(env.USDT_TRC20_CONTRACT||"");
  if(!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)||!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(contract)) return json({error:"USDT TRC20 收款配置无效。"},503);
  const db=env.AUTH_DB, now=Math.floor(Date.now()/1000);
  await db.prepare("UPDATE recharge_orders SET status='expired' WHERE channel='usdt_trc20' AND status='pending' AND expires_at IS NOT NULL AND expires_at<?").bind(now).run();
  const base=String(env.TRONGRID_API_URL||"https://api.trongrid.io").replace(/\\/$/,"");
  const url=new URL(base+"/v1/accounts/"+address+"/transactions/trc20");
  url.searchParams.set("only_confirmed","true"); url.searchParams.set("limit","200"); url.searchParams.set("contract_address",contract);
  const headers={Accept:"application/json"}; if(env.TRONGRID_API_KEY) headers["TRON-PRO-API-KEY"]=env.TRONGRID_API_KEY;
  const response=await fetch(url,{headers,signal:AbortSignal.timeout(12000)});
  if(!response.ok) return json({error:"链上数据源暂不可用。"},503);
  const payload=await response.json(), rows=Array.isArray(payload.data)?payload.data:[];
  let credited=0,ignored=0;
  for(const tx of rows) {
    const info=tx.token_info||{};
    if(String(tx.to||"").toLowerCase()!==address.toLowerCase()||String(info.address||"").toLowerCase()!==contract.toLowerCase()||tx.type!=="Transfer"||!tx.transaction_id||tx.block_timestamp==null||Number(info.decimals)!==6) {ignored++;continue;}
    const raw=BigInt(String(tx.value||"0"));
    if(raw<=0n||raw>9000000000000000n) {ignored++;continue;}
    const expectedMicro=Number(raw), txHash=String(tx.transaction_id);
    const eventIndex=Number(tx.event_index??0), txTime=Math.floor(Number(tx.block_timestamp)/1000);
    if(!Number.isSafeInteger(eventIndex)||!Number.isSafeInteger(txTime)||txTime<=0){ignored++;continue;}
    const existing=await db.prepare("SELECT * FROM recharge_orders WHERE channel='usdt_trc20' AND tx_hash=? AND tx_event_index=? LIMIT 1").bind(txHash,eventIndex).first();
    let deposit=existing;
    if(!deposit) {
      deposit=await db.prepare("SELECT * FROM recharge_orders WHERE channel='usdt_trc20' AND status='pending' AND expected_micro=? AND created_at<=? AND (expires_at IS NULL OR expires_at>=?) ORDER BY created_at LIMIT 1").bind(expectedMicro,txTime,txTime).first();
      if(!deposit){ignored++;continue;}
      await db.prepare("UPDATE recharge_orders SET status='paid',tx_hash=?,tx_event_index=?,paid_at=? WHERE id=? AND status='pending' AND expected_micro=?")
        .bind(txHash,eventIndex,txTime,deposit.id,expectedMicro).run();
      deposit=await db.prepare("SELECT * FROM recharge_orders WHERE id=?").bind(deposit.id).first();
    }
    if(deposit?.status!=="paid"||deposit.tx_hash!==txHash||Number(deposit.expected_micro)!==expectedMicro){ignored++;continue;}
    const result=await creditWallet({db,userId:deposit.user_id,sourceKey:"usdt-trc20:"+txHash+":"+eventIndex,sourceType:"usdt_deposit",amountMicro:Number(deposit.credit_micro),description:"USDT TRC20 充值 "+txHash,now:Number(deposit.paid_at||txTime)});
    if(result.credited) credited++; else ignored++;
  }
  return json({success:true,scanned:rows.length,credited,ignored,next:payload.meta?.fingerprint||null});
}
