import { json, currentUser } from "../../../../_lib/auth.js";
import { validPublicHttpsUrl } from "../../../../_lib/payment.js";
export async function onRequestPost({request,env}) {
  const user=await currentUser(request,env.AUTH_DB);
  if(!user) return json({error:"请先登录。"},401);
  const body=await request.json().catch(()=>({}));
  const notifyUrl=String(body.notify_url||"").trim(), siteUrl=String(body.site_url||"").trim();
  if(notifyUrl && !await validPublicHttpsUrl(notifyUrl)) return json({error:"回调地址必须是公网 HTTPS 地址。"},400);
  if(siteUrl && !await validPublicHttpsUrl(siteUrl)) return json({error:"站点地址必须是公网 HTTPS 地址。"},400);
  const result=await env.AUTH_DB.prepare("UPDATE pay_merchants SET notify_url=?,site_url=? WHERE user_id=? AND status='active'").bind(notifyUrl,siteUrl,user.id).run();
  if((result.meta?.changes||0)!==1) return json({error:"商户未通过审核或资料不存在。"},403);
  return json({success:true});
}
