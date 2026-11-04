import { adminContext, sameOrigin } from "../../../../../_lib/admin.js";
import { json, randomHex } from "../../../../../_lib/auth.js";
export async function onRequestPost({request,env,params}){
 if(!sameOrigin(request))return json({error:"请求来源校验失败。"},403);
 const c=await adminContext(request,env);if(c.response)return c.response;
 let body;try{body=await request.json()}catch{return json({error:"请求格式错误。"},400)}
 const id=String(params?.id||""),action=String(body?.action||""),note=String(body?.note||"").trim().slice(0,500);
 if(!/^[a-f0-9]{32}$/i.test(id)||!["approve","reject"].includes(action))return json({error:"审批参数无效。"},400);
 if(action==="reject"&&note.length<3)return json({error:"拒绝申请请填写至少 3 个字符的原因。"},400);
 const now=Math.floor(Date.now()/1000),messageId=randomHex(16);
 try{
  const ticket=await c.db.prepare("SELECT id,user_id,merchant_id FROM support_tickets WHERE id=?").bind(id).first();
  if(!ticket)return json({error:"工单不存在。"},404);
  const application=await c.db.prepare("SELECT id FROM api_access_requests WHERE ticket_id=? AND status='pending' ORDER BY created_at DESC LIMIT 1").bind(id).first();
  if(!application)return json({error:"该工单没有待审批的权限申请。"},409);
  const granted=action==="approve"?1:0;
  const content=action==="approve"?"权限申请已审批通过，API 调用权限已开通。":"权限申请未获批准："+note;
  const result=await c.db.batch([
   c.db.prepare("UPDATE api_access_requests SET status=?,reviewed_by=?,reviewed_at=?,review_note=? WHERE id=? AND status='pending'").bind(action==="approve"?"approved":"rejected",c.user.id,now,note,application.id),
   c.db.prepare("UPDATE pay_merchants SET api_access_granted=? WHERE id=?").bind(granted,ticket.merchant_id),
   c.db.prepare("INSERT INTO chat_messages(id,ticket_id,sender_user_id,sender_role,message_type,content,metadata_json,created_at) VALUES(?,?,?,'system','approval_result',?,?,?)").bind(messageId,id,c.user.id,content,JSON.stringify({decision:action,note,application_id:application.id}),now),
   c.db.prepare("UPDATE support_tickets SET updated_at=?,status='open' WHERE id=?").bind(now,id)
  ]);
  if(Number(result?.[0]?.meta?.changes||0)!==1)return json({error:"该权限申请已处理，请刷新工单。"},409);
  return json({success:true,api_access_granted:Boolean(granted),message:action==="approve"?"审批通过，已开通 API 权限。":"已拒绝权限申请并通知商户。"});
 }catch(error){console.error("[admin/support:review]",String(error?.message||error).slice(0,150));return json({error:"权限审批失败。"},503)}
}
