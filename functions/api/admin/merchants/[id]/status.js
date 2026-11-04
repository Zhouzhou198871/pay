import { adminContext, sameOrigin } from "../../../../_lib/admin.js";
import { json } from "../../../../_lib/auth.js";
export async function onRequestPost({request,env,params}){
 if(!sameOrigin(request))return json({error:"请求来源校验失败。"},403);
 const c=await adminContext(request,env);if(c.response)return c.response;
 let body;try{body=await request.json()}catch{return json({error:"请求格式错误。"},400)}
 const id=String(params?.id||""),action=String(body?.action||"");
 if(!/^[a-f0-9]{32}$/i.test(id)||!["freeze","unfreeze"].includes(action))return json({error:"商户状态参数无效。"},400);
 try{
  const target=action==="freeze"?"suspended":"active",expected=action==="freeze"?"active":"suspended";
  const result=await c.db.prepare("UPDATE pay_merchants SET status=? WHERE id=? AND status=?").bind(target,id,expected).run();
  if(Number(result?.meta?.changes||0)!==1)return json({error:"商户不存在，或当前状态不允许该操作。"},409);
  return json({success:true,status:target,message:action==="freeze"?"商户已冻结。":"商户已解冻。"});
 }catch(error){console.error("[admin:merchant-status]",String(error?.message||error).slice(0,140));return json({error:"商户状态更新失败。"},503)}
}
