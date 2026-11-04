import { adminContext } from "../../../../_lib/admin.js";
import { json } from "../../../../_lib/auth.js";
export async function onRequestGet({request,env,params}){
 const c=await adminContext(request,env);if(c.response)return c.response;
 const id=String(params?.id||"");if(!/^[a-f0-9]{32}$/i.test(id))return json({error:"工单编号无效。"},400);
 try{
  const ticket=await c.db.prepare("SELECT t.*,u.email,pm.merchant_no,pm.site_name,pm.api_access_granted FROM support_tickets t JOIN users u ON u.id=t.user_id JOIN pay_merchants pm ON pm.id=t.merchant_id WHERE t.id=?").bind(id).first();
  if(!ticket)return json({error:"工单不存在。"},404);
  const [rows,pending]=await Promise.all([
   c.db.prepare("SELECT id,sender_role,message_type,content,metadata_json,created_at FROM chat_messages WHERE ticket_id=? ORDER BY created_at DESC,id DESC LIMIT 100").bind(id).all(),
   c.db.prepare("SELECT id,app_type,app_name,website_url,created_at FROM api_access_requests WHERE ticket_id=? AND status='pending' ORDER BY created_at DESC LIMIT 1").bind(id).first()
  ]);
  return json({ticket,messages:(rows.results||[]).reverse(),pending_permission_request:pending||null,has_more:(rows.results||[]).length===100});
 }catch(error){console.error("[admin/support:detail]",String(error?.message||error).slice(0,150));return json({error:"工单详情读取失败。"},503)}
}
