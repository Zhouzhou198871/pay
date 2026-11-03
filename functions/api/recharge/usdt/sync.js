import { json } from "../../../_lib/auth.js";
import { creditWallet } from "../../../_lib/wallet.js";
import { findTransferEventIndex, selectUniqueDepositCandidate, isTransferWithinOrderWindow } from "../../../_lib/tron.js";

export async function onRequestPost({request,env}) {
  const supplied=(request.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  const expected=String(env.USDT_SCAN_SECRET||"");
  if(!expected||supplied.length!==expected.length) return json({error:"无权访问。"},403);
  let diff=0; for(let i=0;i<supplied.length;i++) diff|=supplied.charCodeAt(i)^expected.charCodeAt(i);
  if(diff!==0) return json({error:"无权访问。"},403);
  const address=String(env.USDT_TRC20_ADDRESS||""), contract=String(env.USDT_TRC20_CONTRACT||"");
  if(!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)||!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(contract)) return json({error:"USDT TRC20 收款配置无效。"},503);
  const db=env.AUTH_DB, now=Math.floor(Date.now()/1000);
  await db.prepare("UPDATE recharge_orders SET status='expired' WHERE channel='usdt_trc20' AND status='pending' AND expires_at IS NOT NULL AND expires_at<?").bind(now).run();
  const state=await db.prepare("SELECT fingerprint FROM wallet_scan_state WHERE scanner_key='usdt_trc20'").first();
  let backlogCursor=String(state?.fingerprint||""), scanned=0, credited=0, ignored=0, pages=0;
  const base=String(env.TRONGRID_API_URL||"https://api.trongrid.io").replace(/\/$/,"");
  const headers={Accept:"application/json"}; if(env.TRONGRID_API_KEY) headers["TRON-PRO-API-KEY"]=env.TRONGRID_API_KEY;
  const eventCache=new Map(), usedEventIndexes=new Map();
  const resolveEventIndex=async tx=>{
    const txHash=String(tx.transaction_id||"");
    const direct=tx.event_index;
    if(direct!==undefined&&direct!==null&&direct!=="") {
      const index=Number(direct);
      if(!Number.isSafeInteger(index)||index<0) throw new Error("invalid_event_index");
      return index;
    }
    if(!eventCache.has(txHash)) {
      const eventUrl=new URL(base+"/v1/transactions/"+encodeURIComponent(txHash)+"/events");
      eventUrl.searchParams.set("only_confirmed","true");
      const response=await fetch(eventUrl,{headers,signal:AbortSignal.timeout(12000)});
      if(!response.ok) throw new Error("event_lookup_http_"+response.status);
      const payload=await response.json();
      if(!Array.isArray(payload.data)) throw new Error("event_lookup_invalid_payload");
      eventCache.set(txHash,payload.data);
    }
    let used=usedEventIndexes.get(txHash);
    if(!used){used=new Set();usedEventIndexes.set(txHash,used);}
    const index=findTransferEventIndex(eventCache.get(txHash),{
      contract,from:tx.from,to:tx.to,value:String(tx.value||""),used
    });
    if(index===null) throw new Error("transfer_event_index_not_found");
    return index;
  };

  // Every invocation rescans the newest page first. The saved fingerprint is
  // reserved for walking older history, so a growing backlog cannot hide new deposits.
  for(let page=0;page<5;page++) {
    if(page>0&&!backlogCursor) break;
    const url=new URL(base+"/v1/accounts/"+address+"/transactions/trc20");
    url.searchParams.set("only_confirmed","true");
    url.searchParams.set("only_to","true");
    url.searchParams.set("limit","200");
    url.searchParams.set("contract_address",contract);
    url.searchParams.set("order_by","block_timestamp,desc");
    if(page>0) url.searchParams.set("fingerprint",backlogCursor);
    const response=await fetch(url,{headers,signal:AbortSignal.timeout(12000)});
    if(!response.ok) return json({error:"链上数据源暂不可用，扫描游标已保留。"},503);
    const payload=await response.json(), rows=Array.isArray(payload.data)?payload.data:[];
    scanned+=rows.length; pages++;
    for(const tx of rows) {
      const info=tx.token_info||{};
      if(String(tx.to||"").toLowerCase()!==address.toLowerCase()||
         String(info.address||"").toLowerCase()!==contract.toLowerCase()||
         tx.type!=="Transfer"||!tx.transaction_id||tx.block_timestamp==null||
         Number(info.decimals)!==6) {ignored++;continue;}
      let raw;
      try { raw=BigInt(String(tx.value||"0")); } catch { ignored++;continue; }
      if(raw<=0n||raw>9000000000000000n) {ignored++;continue;}
      const amountMicro=Number(raw), txHash=String(tx.transaction_id);
      const txTime=Math.floor(Number(tx.block_timestamp)/1000);
      if(!Number.isSafeInteger(txTime)||txTime<=0){ignored++;continue;}

      let deposit=await db.prepare("SELECT * FROM recharge_orders WHERE channel='usdt_trc20' AND tx_hash=? AND expected_micro=? LIMIT 1")
        .bind(txHash,amountMicro).first();
      let eventIndex=deposit?Number(deposit.tx_event_index):null;
      if(!deposit) {
        // An order may be marked expired when the scanner catches up, but it is
        // creditable only if the confirmed on-chain block timestamp is within
        // its exact 600-second quote window. Transfers after expires_at are void.
        const matching=await db.prepare("SELECT * FROM recharge_orders WHERE channel='usdt_trc20' AND status IN ('pending','expired') AND expected_micro=? AND created_at<=? AND (expires_at IS NULL OR expires_at>=?) ORDER BY created_at LIMIT 2")
          .bind(amountMicro,txTime,txTime).all();
        const candidates=(Array.isArray(matching?.results)?matching.results:[]).filter(order=>isTransferWithinOrderWindow(order,txTime));
        // Never guess which user owns a transfer if a quote amount was reused.
        deposit=selectUniqueDepositCandidate(candidates);
        if(!deposit){ignored++;continue;}
        try { eventIndex=await resolveEventIndex(tx); }
        catch(error) {
          console.error("[usdt/sync] event index lookup failed",String(error?.message||error).slice(0,120));
          return json({error:"无法确认链上 Transfer 事件序号，扫描游标已保留。"},503);
        }
        await db.prepare("UPDATE recharge_orders SET status='paid',tx_hash=?,tx_event_index=?,paid_at=? WHERE id=? AND status IN ('pending','expired') AND expected_micro=? AND created_at<=? AND (expires_at IS NULL OR expires_at>=?)")
          .bind(txHash,eventIndex,txTime,deposit.id,amountMicro,txTime,txTime).run();
        deposit=await db.prepare("SELECT * FROM recharge_orders WHERE id=?").bind(deposit.id).first();
      }
      if(deposit?.status!=="paid"||deposit.tx_hash!==txHash||
         Number(deposit.expected_micro)!==amountMicro||
         !Number.isSafeInteger(eventIndex)||eventIndex<0||
         Number(deposit.tx_event_index)!==eventIndex) {ignored++;continue;}
      const result=await creditWallet({
        db,userId:deposit.user_id,sourceKey:"usdt-trc20:"+txHash+":"+eventIndex,
        sourceType:"usdt_deposit",amountMicro:Number(deposit.credit_micro),
        description:"USDT TRC20 充值 "+txHash,now:Number(deposit.paid_at||txTime)
      });
      if(result.credited) credited++; else ignored++;
    }
    const nextFingerprint=String(payload.meta?.fingerprint||"");
    if(page===0) {
      if(!backlogCursor) backlogCursor=nextFingerprint;
    } else backlogCursor=nextFingerprint;
    await db.prepare("INSERT INTO wallet_scan_state (scanner_key,fingerprint,updated_at) VALUES ('usdt_trc20',?,?) ON CONFLICT(scanner_key) DO UPDATE SET fingerprint=excluded.fingerprint,updated_at=excluded.updated_at")
      .bind(backlogCursor||null,now).run();
  }
  return json({success:true,scanned,credited,ignored,pages,has_more:Boolean(backlogCursor),next:backlogCursor||null});
}
