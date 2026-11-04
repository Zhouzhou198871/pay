import { adminContext } from "../../../_lib/admin.js";
import { json, randomHex } from "../../../_lib/auth.js";
export async function onRequestGet({request,env}){
 const c=await adminContext(request,env);if(c.response)return c.response;
 const url=new URL(request.url),status=String(url.searchParams.get("status")||"open"),page=Math.max(1,Number(url.searchParams.get("page")||1)),size=Math.min(100,Math.max(1,Number(url.searchParams.get("page_size")||30))),offset=(page-1)*size;
 const filter=status==="all"?"":" WHERE t.status=?";
 const binds=status==="all"?[]:[status];
 try{
  const [rows,count]=await Promise.all([
   c.db.prepare("SELECT t.id,t.subject,t.status,t.created_at,t.updated_at,u.email,pm.merchant_no,pm.site_name,pm.api_access_granted,(SELECT cm.message_type FROM chat_messages cm WHERE cm.ticket_id=t.id ORDER BY cm.created_at DESC,cm.id DESC LIMIT 1) AS last_message_type,(SELECT cm.content FROM chat_messages cm WHERE cm.ticket_id=t.id ORDER BY cm.created_at DESC,cm.id DESC LIMIT 1) AS last_message,(SELECT cm.created_at FROM chat_messages cm WHERE cm.ticket_id=t.id ORDER BY cm.created_at DESC,cm.id DESC LIMIT 1) AS last_message_at FROM support_tickets t JOIN users u ON u.id=t.user_id JOIN pay_merchants pm ON pm.id=t.merchant_id"+filter+" ORDER BY t.updated_at DESC LIMIT ? OFFSET ?").bind(...binds,size,offset).all(),
   c.db.prepare("SELECT COUNT(*) AS total FROM support_tickets t"+filter).bind(...binds).first()
  ]);
  return json({items:rows.results||[],pagination:{page,page_size:size,total:Number(count?.total||0),pages:Math.ceil(Number(count?.total||0)/size)}});
 }catch(error){console.error("[admin/support:list]",String(error?.message||error).slice(0,150));return json({error:"客服工单列表读取失败。"},503)}
}
export async function onRequestPost({request,env}){
 const c=await adminContext(request,env);if(c.response)return c.response;
 const origin=request.headers.get("Origin");if(origin){try{if(new URL(origin).origin!==new URL(request.url).origin)return json({error:"请求来源校验失败。"},403)}catch{return json({error:"请求来源校验失败。"},403)}}
 let body;try{body=await request.json()}catch{return json({error:"请求格式错误。"},400)}
 const ticketId=String(body?.ticket_id||""),message=String(body?.message||"").trim();
 if(!/^[a-f0-9]{32}$/i.test(ticketId)||!message||message.length>2000)return json({error:"工单编号或回复内容无效。"},400);
 const now=Math.floor(Date.now()/1000),id=randomHex(16);
 try{
  const ticket=await c.db.prepare("SELECT id FROM support_tickets WHERE id=?").bind(ticketId).first();if(!ticket)return json({error:"工单不存在。"},404);
  await c.db.batch([
   c.db.prepare("INSERT INTO chat_messages(id,ticket_id,sender_user_id,sender_role,message_type,content,metadata_json,created_at) VALUES(?,?,?,'admin','text',?,'{}',?)").bind(id,ticketId,c.user.id,message,now),
   c.db.prepare("UPDATE support_tickets SET updated_at=?,status='open' WHERE id=?").bind(now,ticketId)
  ]);
  return json({success:true,message:"客服回复已发送。",id,created_at:now},201);
 }catch(error){console.error("[admin/support:reply]",String(error?.message||error).slice(0,150));return json({error:"客服回复发送失败。"},503)}
}
