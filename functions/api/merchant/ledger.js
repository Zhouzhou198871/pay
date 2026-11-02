import { merchantContext, pagination } from "../../_lib/merchant.js";
import { json } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const context=await merchantContext(request,env);
  if(context.response) return context.response;
  const {page,pageSize,offset}=pagination(request);
  const union=`
    SELECT id,entry_no,direction,amount_micro,balance_after_micro,currency,category,description,related_type,related_id,created_at
    FROM merchant_ledger WHERE user_id=?
    UNION ALL
    SELECT id,source_key AS entry_no,direction,amount_micro,balance_after_micro,currency,source_type AS category,description,
           'wallet' AS related_type,source_key AS related_id,created_at
    FROM wallet_ledger WHERE user_id=?
  `;
  try {
    const [rows,count]=await Promise.all([
      context.db.prepare(`SELECT * FROM (${union}) ORDER BY created_at DESC LIMIT ? OFFSET ?`)
        .bind(context.user.id,context.user.id,pageSize,offset).all(),
      context.db.prepare(`SELECT (SELECT COUNT(*) FROM merchant_ledger WHERE user_id=?)+(SELECT COUNT(*) FROM wallet_ledger WHERE user_id=?) AS total`)
        .bind(context.user.id,context.user.id).first()
    ]);
    const total=Number(count?.total||0);
    return json({items:rows.results||[],pagination:{page,page_size:pageSize,total,pages:Math.ceil(total/pageSize)}});
  } catch(error) {
    console.error("[merchant/ledger]",String(error?.message||error).slice(0,180));
    return json({error:"暂时无法读取 USDT 资金明细。"},503);
  }
}
