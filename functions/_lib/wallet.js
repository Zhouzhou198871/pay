import { randomHex, json, currentUser } from "./auth.js";

export const parseUsdtMicro = (value) => {
  const s=String(value??"").trim();
  if(!/^\d{1,10}(?:\.\d{1,6})?$/.test(s)) return null;
  const [w,f=""]=s.split(".");
  const n=BigInt(w)*1000000n+BigInt((f+"000000").slice(0,6));
  return n>0n && n<=9000000000000000n ? Number(n) : null;
};
export const formatUsdt = (micro) => {
  const n=BigInt(String(micro||0));
  return (n/1000000n).toString()+"."+String(n%1000000n).padStart(6,"0").replace(/0+$/,"").padEnd(2,"0");
};
export const userContext = async (request,env) => {
  if(!env.AUTH_DB) return {response:json({error:"账户服务暂不可用。"},503)};
  const user=await currentUser(request,env.AUTH_DB);
  if(!user) return {response:json({error:"请先登录。"},401)};
  return {user,db:env.AUTH_DB};
};

// The unique source_key insert and balance mutation run in one D1 transaction.
export const creditWallet = async ({db,userId,sourceKey,sourceType,amountMicro,description,now=Math.floor(Date.now()/1000)}) => {
  if(!Number.isSafeInteger(amountMicro)||amountMicro<=0) throw new Error("invalid_credit_amount");
  await db.prepare("INSERT OR IGNORE INTO wallet_accounts (user_id,balance_micro,updated_at) VALUES (?,0,?)").bind(userId,now).run();
  const results=await db.batch([
    db.prepare("INSERT OR IGNORE INTO wallet_ledger (id,user_id,source_key,source_type,direction,amount_micro,balance_after_micro,currency,description,created_at) SELECT ?,?,?,?,'credit',?,balance_micro+?,'USDT',?,? FROM wallet_accounts WHERE user_id=?")
      .bind(randomHex(16),userId,sourceKey,sourceType,amountMicro,amountMicro,description,now,userId),
    db.prepare("UPDATE wallet_accounts SET balance_micro=balance_micro+?,updated_at=? WHERE user_id=? AND changes()=1")
      .bind(amountMicro,now,userId)
  ]);
  const credited=Number(results?.[0]?.meta?.changes||0)===1;
  const account=await db.prepare("SELECT balance_micro FROM wallet_accounts WHERE user_id=?").bind(userId).first();
  return {credited,balanceMicro:Number(account?.balance_micro||0)};
};
export const walletBalance = async (db,userId) => {
  const row=await db.prepare("SELECT balance_micro FROM wallet_accounts WHERE user_id=?").bind(userId).first();
  return Number(row?.balance_micro||0);
};
