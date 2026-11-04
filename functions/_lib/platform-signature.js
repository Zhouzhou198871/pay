const enc = new TextEncoder();
const toHex = b => [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
const fromHex = s => new Uint8Array(s.match(/.{2}/g).map(x=>parseInt(x,16)));
const pem = (label,b) => { const s=btoa(String.fromCharCode(...new Uint8Array(b))); return '-----BEGIN '+label+'-----\\n'+s.match(/.{1,64}/g).join('\\n')+'\\n-----END '+label+'-----'; };
async function aes(secret,uses){const h=await crypto.subtle.digest('SHA-256',enc.encode(secret));return crypto.subtle.importKey('raw',h,'AES-GCM',false,uses);}
async function encrypt(value,secret){const iv=crypto.getRandomValues(new Uint8Array(12));const k=await aes(secret,['encrypt']);const d=await crypto.subtle.encrypt({name:'AES-GCM',iv},k,enc.encode(value));return toHex(iv)+'.'+toHex(d);}
async function decrypt(value,secret){const [iv,d]=String(value||'').split('.');if(!iv||!d)throw Error('平台私钥密文无效');const k=await aes(secret,['decrypt']);const p=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromHex(iv)},k,fromHex(d));return new TextDecoder().decode(p);}
export async function ensurePlatformKeyPair(db,secret){
 let row=await db.prepare("SELECT public_key,private_key_ciphertext FROM platform_system_keys WHERE key_name='callback_rsa_v1'").first();
 if(row?.public_key&&row?.private_key_ciphertext)return row.public_key;
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const [pr,pu]=await Promise.all([crypto.subtle.exportKey('pkcs8',pair.privateKey),crypto.subtle.exportKey('spki',pair.publicKey)]);
 const now=Math.floor(Date.now()/1000), priv=await encrypt(pem('PRIVATE KEY',pr),secret), pub=pem('PUBLIC KEY',pu);
 await db.prepare("INSERT OR IGNORE INTO platform_system_keys(key_name,public_key,private_key_ciphertext,created_at,updated_at) VALUES('callback_rsa_v1',?,?,?,?)").bind(pub,priv,now,now).run();
 row=await db.prepare("SELECT public_key,private_key_ciphertext FROM platform_system_keys WHERE key_name='callback_rsa_v1'").first();
 if(!row?.public_key||!row?.private_key_ciphertext)throw Error('平台密钥初始化失败');return row.public_key;
}
export function canonicalPlatformParams(p){return Object.keys(p||{}).filter(k=>k!=='sign'&&k!=='sign_type'&&p[k]!==undefined&&p[k]!==null).sort().map(k=>k+'='+String(p[k])).join('&');}
export async function signPlatformCallback(params,db,secret){
 const row=await db.prepare("SELECT private_key_ciphertext FROM platform_system_keys WHERE key_name='callback_rsa_v1'").first();
 if(!row?.private_key_ciphertext)throw Error('平台回调签名密钥未初始化');
 const keyPem=await decrypt(row.private_key_ciphertext,secret), b64=keyPem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\\s/g,'');
 const der=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey('pkcs8',der,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const sig=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,enc.encode(canonicalPlatformParams(params)));
 return btoa(String.fromCharCode(...new Uint8Array(sig)));
}
