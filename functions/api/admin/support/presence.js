import { adminContext } from "../../../_lib/admin.js";
import { json } from "../../../_lib/auth.js";
export async function onRequestPost({request,env}){
 const c=await adminContext(request,env);if(c.response)return c.response;
 const origin=request.headers.get("Origin");if(origin){try{if(new URL(origin).origin!==new URL(request.url).origin)return json({error:"请求来源校验失败。"},403)}catch{return json({error:"请求来源校验失败。"},403)}}
 try{await c.db.prepare("INSERT INTO support_admin_presence(admin_user_id,last_seen_at) VALUES(?,?) ON CONFLICT(admin_user_id) DO UPDATE SET last_seen_at=excluded.last_seen_at").bind(c.user.id,Math.floor(Date.now()/1000)).run();return json({success:true})}
 catch(error){console.error("[admin/support:presence]",String(error?.message||error).slice(0,120));return json({error:"客服在线状态更新失败。"},503)}
}
