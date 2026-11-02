import { randomHex, sha256, safeEqual, currentUser } from "./auth.js";
export { randomHex } from "./auth.js";

const enc = new TextEncoder();
const hex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (value) => Uint8Array.from(atob(value), c => c.charCodeAt(0));

export const amountToCents = (value) => {
  const s = String(value ?? "").trim();
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const n = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};
export const centsToYuan = (n) => (n / 100).toFixed(2);
export const jsonBody = async (request) => {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) return await request.json();
  if (type.includes("application/x-www-form-urlencoded")) return Object.fromEntries(new URLSearchParams(await request.text()));
  return {};
};
export const validPublicHttpsUrl = async (value) => {
  try {
    const u = new URL(String(value || ""));
    if (u.protocol !== "https:" || !u.hostname || u.username || u.password || u.port && u.port !== "443") return false;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;
    if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host === "::1" || host.startsWith("fc") || host.startsWith("fd")) return false;
    return true;
  } catch { return false; }
};

// RFC 1321 MD5, retained solely for compatibility with the legacy merchant gateway protocol.
export const md5 = (input) => {
  const bytes = enc.encode(input), bitLen = bytes.length * 8;
  const data = [...bytes, 128];
  while (data.length % 64 !== 56) data.push(0);
  for (let i = 0; i < 8; i++) data.push(Math.floor(bitLen / (2 ** (8 * i))) & 255);
  let a0=0x67452301, b0=0xefcdab89, c0=0x98badcfe, d0=0x10325476;
  const shifts=[7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21];
  const K=Array.from({length:64},(_,i)=>Math.floor(Math.abs(Math.sin(i+1))*4294967296)>>>0);
  const rot=(x,n)=>(x<<n)|(x>>>(32-n));
  for(let off=0;off<data.length;off+=64){
    const M=[]; for(let j=0;j<16;j++) M[j]=(data[off+j*4]|(data[off+j*4+1]<<8)|(data[off+j*4+2]<<16)|(data[off+j*4+3]<<24))>>>0;
    let A=a0,B=b0,C=c0,D=d0;
    for(let i=0;i<64;i++){
      let F,g,s;
      if(i<16){F=(B&C)|(~B&D);g=i;s=shifts[i%4];}
      else if(i<32){F=(D&B)|(~D&C);g=(5*i+1)%16;s=shifts[4+i%4];}
      else if(i<48){F=B^C^D;g=(3*i+5)%16;s=shifts[8+i%4];}
      else{F=C^(B|~D);g=(7*i)%16;s=shifts[12+i%4];}
      const t=D; D=C; C=B; B=(B+rot((A+F+K[i]+M[g])|0,s))|0; A=t;
    }
    a0=(a0+A)|0;b0=(b0+B)|0;c0=(c0+C)|0;d0=(d0+D)|0;
  }
  return [a0,b0,c0,d0].map(n=>[0,8,16,24].map(s=>((n>>>s)&255).toString(16).padStart(2,"0")).join("")).join("");
};
const canonical = (params) => Object.keys(params).filter(k=>k!=="sign" && params[k]!==undefined && params[k]!==null && String(params[k])!=="").sort().map(k=>k+"="+String(params[k])).join("&");
export const merchantSign = (params, secret) => md5(canonical(params)+secret);
export const verifyMerchant = (params, secret) => safeEqual(String(params.sign||"").toLowerCase(), merchantSign(params,secret));

const masterKey = async (env) => {
  if (!env.PAY_MERCHANT_MASTER_KEY) throw new Error("PAY_MERCHANT_MASTER_KEY is not configured");
  const raw=unb64(env.PAY_MERCHANT_MASTER_KEY);
  if(raw.length!==32) throw new Error("PAY_MERCHANT_MASTER_KEY must be base64-encoded 32 bytes");
  return crypto.subtle.importKey("raw",raw,{name:"AES-GCM"},false,["encrypt","decrypt"]);
};
export const encryptSecret = async (secret,env) => {
  const iv=crypto.getRandomValues(new Uint8Array(12)), key=await masterKey(env);
  const ciphertext=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,enc.encode(secret));
  return b64(new Uint8Array([...iv,...new Uint8Array(ciphertext)]));
};
export const decryptSecret = async (value,env) => {
  const all=unb64(value), key=await masterKey(env);
  const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:all.slice(0,12)},key,all.slice(12));
  return new TextDecoder().decode(plain);
};
export const merchantForRequest = async (request,env) => {
  const body=await jsonBody(request), params={...Object.fromEntries(new URL(request.url).searchParams),...body};
  const merchant=await env.AUTH_DB.prepare("SELECT * FROM pay_merchants WHERE app_id=? AND status='active' LIMIT 1").bind(String(params.app_id||"")).first();
  if(!merchant) return {response:json({code:401,msg:"商户不存在或未启用"},401)};
  const timestamp=Number(params.timestamp||0), now=Math.floor(Date.now()/1000);
  if(!Number.isSafeInteger(timestamp)||Math.abs(now-timestamp)>300) return {response:json({code:401,msg:"请求时间戳无效"},401)};
  let secret;
  try{secret=await decryptSecret(merchant.app_secret_ciphertext,env);}catch{return {response:json({code:503,msg:"商户密钥服务未配置"},503)};}
  if(!verifyMerchant(params,secret)) return {response:json({code:401,msg:"签名错误"},401)};
  return {merchant,params,body};
};
export const providerConfigReady = (env) => Boolean(env.ALIPAY_PID && env.ALIPAY_CREATE_URL && env.ALIPAY_QUERY_URL && env.ALIPAY_PRIVATE_KEY && env.ALIPAY_NOTIFY_URL);
const privateKey = async (env) => {
  const pem=String(env.ALIPAY_PRIVATE_KEY||"").replace(/\\n/g,"\n");
  const raw=unb64(pem.replace(/-----[^-]+-----/g,"").replace(/\s/g,""));
  return crypto.subtle.importKey("pkcs8",raw,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
};
const rsaSign = async (params,env) => {
  const signature=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",await privateKey(env),enc.encode(canonical(params)));
  return b64(signature);
};
const providerRequest = async (url,params) => {
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),12000);
  try{
    const res=await fetch(url,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams(params),signal:controller.signal,redirect:"error"});
    if(!res.ok) throw new Error("支付渠道 HTTP "+res.status);
    const data=await res.json(); if(!data||typeof data!=="object") throw new Error("支付渠道响应无效");
    return data;
  }finally{clearTimeout(timer);}
};
export const createAlipayOrder = async ({tradeNo,amountCents,subject,env}) => {
  if(!providerConfigReady(env)) throw new Error("支付宝渠道尚未完成 Cloudflare Secrets 配置");
  const params={pid:env.ALIPAY_PID,type:"alipay",out_trade_no:tradeNo,notify_url:env.ALIPAY_NOTIFY_URL,return_url:env.ALIPAY_RETURN_URL||"",name:subject,money:centsToYuan(amountCents),timestamp:String(Math.floor(Date.now()/1000))};
  params.sign=await rsaSign(params,env); params.sign_type="RSA";
  const result=await providerRequest(env.ALIPAY_CREATE_URL,params);
  if(Number(result.code)!==0) throw new Error(String(result.msg||"上游创建支付订单失败").slice(0,160));
  return {payUrl:String(result.payurl||result.qrcode||""),payInfo:String(result.pay_info||result.qrcode||""),providerTradeNo:String(result.trade_no||"")};
};
export const queryAlipayOrder = async (tradeNo,env) => {
  if(!providerConfigReady(env)) throw new Error("支付宝渠道尚未完成 Cloudflare Secrets 配置");
  const params={pid:env.ALIPAY_PID,out_trade_no:tradeNo,timestamp:String(Math.floor(Date.now()/1000))};
  params.sign=await rsaSign(params,env);params.sign_type="RSA";
  const result=await providerRequest(env.ALIPAY_QUERY_URL,params);
  const d=result.data||{};
  const status=String(d.trade_status||d.status||result.trade_status||result.status||"").toLowerCase();
  return {paid:["1","trade_success","success","paid","finish"].includes(status),providerTradeNo:String(d.trade_no||d.trade_id||"")};
};
export const queueMerchantNotice = async (env,order) => {
  const db=env.AUTH_DB;
  if(!order.notify_url) return;
  const payload={out_trade_no:order.out_trade_no,trade_no:order.trade_no,amount:centsToYuan(order.amount_cents),status:"TRADE_SUCCESS",timestamp:String(Math.floor(Date.now()/1000))};
  const merchant=await db.prepare("SELECT app_secret_ciphertext FROM pay_merchants WHERE id=?").bind(order.merchant_id).first();
  const secret=await decryptSecret(merchant.app_secret_ciphertext,env);
  payload.sign=merchantSign(payload,secret);
  await db.prepare("INSERT OR IGNORE INTO payment_webhook_deliveries (id,trade_no,target_url,payload_json,status,attempts,next_attempt_at,created_at) VALUES (?,?,?,?,'pending',0,?,?)")
    .bind(randomHex(16),order.trade_no,order.notify_url,JSON.stringify(payload),Math.floor(Date.now()/1000),Math.floor(Date.now()/1000)).run();
};
export const settleConfirmedOrder = async (env,tradeNo,providerTradeNo,payloadHash) => {
  const db=env.AUTH_DB, now=Math.floor(Date.now()/1000);
  const order=await db.prepare("SELECT * FROM payment_orders WHERE trade_no=? LIMIT 1").bind(tradeNo).first();
  if(!order) return {ok:false,reason:"order_not_found"};
  if(order.status==="paid") return {ok:true,duplicate:true};
  const eventId=randomHex(16);
  const update=await db.prepare("UPDATE payment_orders SET status='paid',provider_trade_no=?,paid_at=? WHERE trade_no=? AND status='pending'")
    .bind(providerTradeNo||null,now,tradeNo).run();
  if((update.meta?.changes||0)!==1) {
    const latest=await db.prepare("SELECT status FROM payment_orders WHERE trade_no=?").bind(tradeNo).first();
    return {ok:latest?.status==="paid",duplicate:latest?.status==="paid"};
  }
  await db.prepare("INSERT INTO payment_events (id,event_key,trade_no,event_type,payload_hash,created_at) VALUES (?,?,?,'provider_paid',?,?)")
    .bind(eventId,"paid:"+tradeNo,tradeNo,payloadHash,now).run();
  const fresh={...order,provider_trade_no:providerTradeNo||"",paid_at:now};
  await queueMerchantNotice(db,fresh,env);
  return {ok:true,duplicate:false};
};
export const userMerchant = async (request,env) => {
  const user=await currentUser(request,env.AUTH_DB);
  if(!user) return {response:json({error:"请先登录。"},401)};
  return {user};
};
