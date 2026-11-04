import { adminContext, sameOrigin } from "../../_lib/admin.js";
import { json } from "../../_lib/auth.js";
export async function onRequestPost({request,env}){
 if(!sameOrigin(request))return json({error:"请求来源校验失败。"},403);
 const c=await adminContext(request,env);if(c.response)return c.response;
 let body;try{body=await request.json()}catch{return json({error:"请求格式错误。"},400)}
 const id=String(body?.merchant_id||""),action=String(body?.action||"");
 if(!/^[a-f0-9]{32}$/i.test(id)||!["freeze","unfreeze"].includes(action))return json({error:"操作参数无效。"},400);
 try{
  const row=await c.db.prepare("SELECT status,suspended_previous_status FROM pay_merchants WHERE id=?").bind(id).first();
  if(!row)return json({error:"商户不存在。"},404);
  if(action==="freeze"){
   if(row.status==="suspended")return json({success:true,idempotent:true,status:"suspended"});
   await c.db.prepare("UPDATE pay_merchants SET suspended_previous_status=status,status='suspended' WHERE id=? AND status<>'suspended'").bind(id).run();
   return json({success:true,status:"suspended"});
  }
  if(row.status!=="suspended")return json({error:"该商户当前未冻结。"},409);
  await c.db.prepare("UPDATE pay_merchants SET status=COALESCE(NULLIF(suspended_previous_status,''),'active'),suspended_previous_status=NULL WHERE id=? AND status='suspended'").bind(id).run();
  return json({success:true,status:"restored"});
 }catch(e){console.error("[admin:merchant-status]",String(e?.message||e).slice(0,140));return json({error:"商户状态更新失败。"},503)}
}
