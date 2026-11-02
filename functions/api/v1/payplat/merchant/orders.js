import { json, currentUser } from "../../../../_lib/auth.js";
export async function onRequestGet({request,env}) {
  const user=await currentUser(request,env.AUTH_DB);
  if(!user) return json({error:"请先登录。"},401);
  const url=new URL(request.url),page=Math.max(1,Math.min(10000,Number(url.searchParams.get("page")||1))),size=Math.max(1,Math.min(50,Number(url.searchParams.get("page_size")||20)));
  const merchant=await env.AUTH_DB.prepare("SELECT id FROM pay_merchants WHERE user_id=? LIMIT 1").bind(user.id).first();
  if(!merchant) return json({items:[],pagination:{page,page_size:size,total:0}});
  const [rows,count]=await Promise.all([
    env.AUTH_DB.prepare("SELECT trade_no,out_trade_no,amount_cents,method,subject,status,created_at,paid_at FROM payment_orders WHERE merchant_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?").bind(merchant.id,size,(page-1)*size).all(),
    env.AUTH_DB.prepare("SELECT COUNT(*) AS total FROM payment_orders WHERE merchant_id=?").bind(merchant.id).first()
  ]);
  return json({items:(rows.results||[]).map(x=>({...x,amount:(x.amount_cents/100).toFixed(2)})),pagination:{page,page_size:size,total:count?.total||0}});
}
