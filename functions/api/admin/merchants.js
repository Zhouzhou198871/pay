import { adminContext } from "../../_lib/admin.js";
import { json } from "../../_lib/auth.js";
export async function onRequestGet({request,env}){
 const c=await adminContext(request,env);if(c.response)return c.response;
 const u=new URL(request.url),page=Math.max(1,Number(u.searchParams.get("page")||1)),size=Math.min(100,Math.max(1,Number(u.searchParams.get("page_size")||30))),offset=(page-1)*size;
 try{
  const [rows,count]=await Promise.all([
   c.db.prepare("SELECT pm.id,pm.user_id,pm.merchant_no,pm.site_name,pm.status,pm.api_access_granted,pm.created_at,u.email,u.display_name,(SELECT l.balance_after_micro FROM merchant_ledger l WHERE l.user_id=pm.user_id ORDER BY l.created_at DESC,l.rowid DESC LIMIT 1) AS balance_micro,(SELECT l.currency FROM merchant_ledger l WHERE l.user_id=pm.user_id ORDER BY l.created_at DESC,l.rowid DESC LIMIT 1) AS balance_currency FROM pay_merchants pm JOIN users u ON u.id=pm.user_id ORDER BY pm.created_at DESC LIMIT ? OFFSET ?").bind(size,offset).all(),
   c.db.prepare("SELECT COUNT(*) AS total FROM pay_merchants").first()
  ]);
  const total=Number(count?.total||0);return json({items:rows.results||[],pagination:{page,page_size:size,total,pages:Math.ceil(total/size)}});
 }catch(error){console.error("[admin:merchants]",String(error?.message||error).slice(0,140));return json({error:"商户列表读取失败。"},503)}
}
