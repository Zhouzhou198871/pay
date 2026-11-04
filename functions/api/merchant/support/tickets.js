import { currentUser, json, randomHex } from "../../../_lib/auth.js";
function sameOrigin(request){const origin=request.headers.get("Origin");if(!origin)return true;try{return new URL(origin).origin===new URL(request.url).origin}catch{return false}}
async function getMerchant(db,userId){return db.prepare("SELECT id,api_access_granted FROM pay_merchants WHERE user_id=? ORDER BY created_at DESC LIMIT 1").bind(userId).first()}
export async function onRequestGet({request,env}){
 if(!env.AUTH_DB)return json({error:"客服工单服务暂不可用。"},503);
 const user=await currentUser(request,env.AUTH_DB);if(!user)return json({error:"请先登录。"},401);
 try{
  const merchant=await getMerchant(env.AUTH_DB,user.id);if(!merchant)return json({error:"商户资料尚未初始化。"},400);
  const ticket=await env.AUTH_DB.prepare("SELECT id,subject,status,created_at,updated_at FROM support_tickets WHERE user_id=? AND merchant_id=? ORDER BY updated_at DESC LIMIT 1").bind(user.id,merchant.id).first();
  if(!ticket)return json({ticket:null,messages:[],api_access_granted:Boolean(merchant.api_access_granted)});
  const rows=await env.AUTH_DB.prepare("SELECT id,sender_role,message_type,content,metadata_json,created_at FROM chat_messages WHERE ticket_id=? ORDER BY created_at ASC,rowid ASC LIMIT 300").bind(ticket.id).all();
  return json({ticket,messages:rows.results||[],api_access_granted:Boolean(merchant.api_access_granted)});
 }catch(error){console.error("[merchant/support:get]",String(error?.message||error).slice(0,160));return json({error:"客服消息读取失败。"},503)}
}
export async function onRequestPost({request,env}){
 if(!sameOrigin(request))return json({error:"请求来源校验失败。"},403);
 if(!env.AUTH_DB)return json({error:"客服工单服务暂不可用。"},503);
 const user=await currentUser(request,env.AUTH_DB);if(!user)return json({error:"请先登录。"},401);
 if(!request.headers.get("content-type")?.toLowerCase().includes("application/json"))return json({error:"请使用 application/json。"},415);
 let body;try{body=await request.json()}catch{return json({error:"请求格式错误。"},400)}
 const type=String(body?.type||"text");
 let content=String(body?.content||"").trim(),metadata={};
 if(type==="permission_request"){
  const appType=String(body?.app_type||"");
  const appName=String(body?.app_name||"").trim();
  const websiteUrl=String(body?.website_url||"").trim();
  if(!["website","bot","app"].includes(appType))return json({error:"请选择网站、机器人或 APP 类型。"},400);
  if(appName.length<2||appName.length>100)return json({error:"应用名称需为 2 至 100 个字符。"},400);
  if(appType==="website"){
   try{const u=new URL(websiteUrl);if(!["http:","https:"].includes(u.protocol)||u.username||u.password)return json({error:"请填写有效的网站 URL。"},400)}catch{return json({error:"网站权限申请需要有效的网址。"},400)}
  }else if(websiteUrl){try{const u=new URL(websiteUrl);if(!["http:","https:"].includes(u.protocol)||u.username||u.password)return json({error:"网址格式无效。"},400)}catch{return json({error:"网址格式无效。"},400)}}
  content="申请调用 API 权限："+appName+(websiteUrl?"（"+websiteUrl+"）":"");
  metadata={app_type:appType,app_name:appName,website_url:websiteUrl};
 }else if(type==="text"){
  if(!content||content.length>2000)return json({error:"消息内容需为 1 至 2000 个字符。"},400);
 }else return json({error:"不支持的消息类型。"},400);
 try{
  const db=env.AUTH_DB,merchant=await getMerchant(db,user.id);if(!merchant)return json({error:"商户资料尚未初始化。"},400);
  const now=Math.floor(Date.now()/1000);
  let ticket=await db.prepare("SELECT id FROM support_tickets WHERE user_id=? AND merchant_id=? AND status!='closed' ORDER BY updated_at DESC LIMIT 1").bind(user.id,merchant.id).first();
  const created=!ticket;
  if(!ticket)ticket={id:randomHex(16)};
  const messageId=randomHex(16),applicationId=type==="permission_request"?randomHex(16):"";
  if(applicationId)metadata.application_id=applicationId;
  const statements=[];
  if(created)statements.push(db.prepare("INSERT INTO support_tickets(id,user_id,merchant_id,subject,status,created_at,updated_at) VALUES(?,?,?,'商户客服咨询','open',?,?)").bind(ticket.id,user.id,merchant.id,now,now));
  else statements.push(db.prepare("UPDATE support_tickets SET updated_at=?,status='open' WHERE id=?").bind(now,ticket.id));
  if(applicationId)statements.push(db.prepare("INSERT INTO api_access_requests(id,ticket_id,user_id,merchant_id,app_type,app_name,website_url,status,created_at) VALUES(?,?,?,?,?,?,?,'pending',?)").bind(applicationId,ticket.id,user.id,merchant.id,metadata.app_type,metadata.app_name,metadata.website_url||"",now));
  statements.push(db.prepare("INSERT INTO chat_messages(id,ticket_id,sender_user_id,sender_role,message_type,content,metadata_json,created_at) VALUES(?,?,?,'merchant',?,?,?,?)").bind(messageId,ticket.id,user.id,type,content,JSON.stringify(metadata),now));
  await db.batch(statements);
  return json({success:true,ticket_id:ticket.id,message:{id:messageId,sender_role:"merchant",message_type:type,content,metadata_json:JSON.stringify(metadata),created_at:now},message_text:"消息已提交至客服工单。"},201);
 }catch(error){console.error("[merchant/support:post]",String(error?.message||error).slice(0,160));return json({error:"消息提交失败，请稍后重试。"},503)}
}
