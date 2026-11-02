import { json, randomHex } from "../../../../../_lib/auth.js";
export async function onRequestPost({request,env}) {
  if(!env.PAY_ADMIN_SECRET) return json({error:"管理审核密钥未配置。"},503);
  const supplied=(request.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  if(supplied.length!==env.PAY_ADMIN_SECRET.length || !crypto.subtle) return json({error:"无权操作。"},403);
  const a=new TextEncoder().encode(supplied),b=new TextEncoder().encode(env.PAY_ADMIN_SECRET);let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
  if(diff!==0) return json({error:"无权操作。"},403);
  const body=await request.json().catch(()=>({}));
  const id=String(body.merchant_id||""), action=String(body.action||"");
  const statuses={approve:"active",reject:"rejected",suspend:"suspended",revoke:"revoked"};
  if(!id||!statuses[action]) return json({error:"参数无效。"},400);
  const now=Math.floor(Date.now()/1000);
  const result=await env.AUTH_DB.prepare("UPDATE pay_merchants SET status=?,reviewed_at=? WHERE id=?").bind(statuses[action],now,id).run();
  if((result.meta?.changes||0)!==1) return json({error:"商户不存在。"},404);
  return json({success:true,status:statuses[action]});
}
