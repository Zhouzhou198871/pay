import { json, currentUser } from "../../../../_lib/auth.js";
export async function onRequestGet({request,env}) {
  const user=await currentUser(request,env.AUTH_DB);
  if(!user) return json({error:"请先登录。"},401);
  const merchant=await env.AUTH_DB.prepare("SELECT id,site_name,site_url,contact,notify_url,status,app_id,created_at,reviewed_at FROM pay_merchants WHERE user_id=? LIMIT 1").bind(user.id).first();
  return json({merchant:merchant||null});
}
