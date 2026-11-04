import { adminContext } from "../../../../_lib/admin.js";
import { json } from "../../../../_lib/auth.js";
export async function onRequestGet({request,env,params}){
 const c=await adminContext(request,env);if(c.response)return c.response;
 const id=String(params?.id||"");if(!/^[a-f0-9]{32}$/i.test(id))return json({error:"工单编号无效。"},400);
 try{
  const ticket=await c.db.prepare("SELECT t.*,u.email,pm.merchant_no,pm.site_name,pm.api_access_granted FROM support_tickets t JOIN users u ON u.id=t.user_id JOIN pay_merchants pm ON pm.id=t.merchant_id WHERE t.id=?").bind(id).first();
  if(!ticket)return json({error:"工单不存在。"},404);
  const rows=await c.db.prepare("SELECT id,sender_role,message_type,content,metadata_json,created_at FROM chat_messages WHERE ticket_id=? ORDER BY created_at ASC,rowid ASC LIMIT 300").bind(id).all();
  return json({ticket,messages:rows.results||[]});
 }catch(error){console.error("[admin/support:detail]",String(error?.message||error).slice(0,150));return json({error:"工单详情读取失败。"},503)}
}
