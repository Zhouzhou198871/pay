import { adminContext } from "../../_lib/admin.js";
import { json } from "../../_lib/auth.js";
export async function onRequestGet({request,env}){
 const c=await adminContext(request,env);if(c.response)return c.response;
 try{
  const [orders,fees,tickets,merchants]=await Promise.all([
   c.db.prepare("SELECT COALESCE(SUM(amount_cents),0) AS amount_cents,COUNT(*) AS count FROM payment_orders WHERE status='paid' AND paid_at>=UNIXEPOCH('now','start of day')").first(),
   c.db.prepare("SELECT COALESCE(SUM(fee_cents),0) AS fee_cents FROM payment_orders WHERE status='paid' AND paid_at>=UNIXEPOCH('now','start of day')").first(),
   c.db.prepare("SELECT COUNT(*) AS count FROM support_tickets WHERE status IN ('open','pending')").first(),
   c.db.prepare("SELECT COUNT(*) AS count FROM pay_merchants").first()
  ]);
  return json({today_amount_cents:Number(orders?.amount_cents||0),today_orders:Number(orders?.count||0),today_fee_cents:Number(fees?.fee_cents||0),pending_tickets:Number(tickets?.count||0),merchant_count:Number(merchants?.count||0)});
 }catch(error){console.error("[admin:overview]",String(error?.message||error).slice(0,140));return json({error:"后台数据总览读取失败。"},503)}
}
