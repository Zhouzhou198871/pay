import { randomHex, json, currentUser } from "./auth.js";

const USDT_SCALE = 1000000;
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

// D1 batch is transactional. changes() gates the balance mutation on a newly inserted unique ledger row.
export const creditWallet = async ({db,userId,sourceKey,sourceType,amountMicro,description,now=Math.floor(Date.now()/1000)}) => {
  if(!Number.isSafeInteger(amountMicro)||amountMicro<=0) throw new Error("invalid_credit_amount");
  const id=randomHex(16);
  await db.prepare("INSERT OR IGNORE INTO wallet_accounts (user_id,balance_micro,updated_at) VALUES (?,0,?)").bind(userId,now).run();
  const inserted=await db.prepare(
    "INSERT OR IGNORE INTO wallet_ledger (id,user_id,source_key,source_type,direction,amount_micro,balance_after_micro,currency,description,created_at) SELECT ?,?,?,?,'credit',?,balance_micro+?,'USDT',?,? FROM wallet_accounts WHERE user_id=?"
  ).bind(id,userId,sourceKey,sourceType,amountMicro,amountMicro,description,now,userId).run();
  const changes=Number(inserted.meta?.changes||0);
  if(changes===1){
    await db.prepare("UPDATE wallet_accounts SET balance_micro=balance_micro+?,updated_at=? WHERE user_id=?").bind(amountMicro,now,userId).run();
  }
  const account=await db.prepare("SELECT balance_micro FROM wallet_accounts WHERE user_id=?").bind(userId).first();
  return {credited:changes===1,balanceMicro:Number(account?.balance_micro||0)};
};
export const walletBalance = async (db,userId) => {
  const row=await db.prepare("SELECT balance_micro FROM wallet_accounts WHERE user_id=?").bind(userId).first();
  return Number(row?.balance_micro||0);
};
