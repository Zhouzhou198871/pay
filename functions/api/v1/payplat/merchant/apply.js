import { json, randomHex, currentUser } from "../../../../_lib/auth.js";
import { encryptSecret, validPublicHttpsUrl } from "../../../../_lib/payment.js";

export async function onRequestPost({request,env}) {
  const user=await currentUser(request,env.AUTH_DB);
  if(!user) return json({error:"请先登录。"},401);
  const body=await request.json().catch(()=>({}));
  const siteName=String(body.site_name||"").trim().slice(0,128);
  const siteUrl=String(body.site_url||"").trim();
  const notifyUrl=String(body.notify_url||"").trim();
  const contact=String(body.contact||"").trim().slice(0,128);
  if(!siteName) return json({error:"请填写站点名称。"},400);
  if(siteUrl && !await validPublicHttpsUrl(siteUrl)) return json({error:"站点地址必须是公网 HTTPS 地址。"},400);
  if(notifyUrl && !await validPublicHttpsUrl(notifyUrl)) return json({error:"回调地址必须是公网 HTTPS 地址。"},400);
  const existing=await env.AUTH_DB.prepare("SELECT id,site_name,status,app_id,created_at FROM pay_merchants WHERE user_id=? LIMIT 1").bind(user.id).first();
  if(existing) return json({merchant:existing,message:"申请记录已存在；密钥仅在首次申请时显示。"},200);
  let secretCiphertext;
  try { secretCiphertext=await encryptSecret(randomHex(32),env); }
  catch(error) { console.error("[payplat/apply]",String(error?.message||error)); return json({error:"商户密钥服务未配置。"},503); }
  const id=randomHex(16), appId="QT"+randomHex(12).toUpperCase(), appSecret=randomHex(32), now=Math.floor(Date.now()/1000);
  secretCiphertext=await encryptSecret(appSecret,env);
  await env.AUTH_DB.prepare("INSERT INTO pay_merchants (id,user_id,site_name,site_url,contact,notify_url,status,app_id,app_secret_ciphertext,created_at) VALUES (?,?,?,?,?,?,'pending',?,?,?)")
    .bind(id,user.id,siteName,siteUrl,contact,notifyUrl,appId,secretCiphertext,now).run();
  return json({merchant:{id,site_name:siteName,site_url:siteUrl,notify_url:notifyUrl,status:"pending",app_id:appId,created_at:now},app_secret:appSecret,message:"请立即安全保存商户密钥；审核通过后可开始调用支付网关。"},201);
}
