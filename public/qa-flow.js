(async () => {
 const out = { api: [], legal: [] };
 const requests = [
  ["login","/api/auth/login",{email:"qa-flow@example.invalid",password:"Qa-Password-123",consent:true,captchaToken:"invalid-qa-token"}],
  ["register","/api/auth/register",{email:"qa-flow@example.invalid",password:"Qa-Password-123",code:"123456",consent:true,captchaToken:"invalid-qa-token"}],
  ["send-register-code","/api/auth/send-code",{email:"qa-flow@example.invalid",purpose:"register",captchaToken:"invalid-qa-token"}],
  ["send-reset-code","/api/auth/send-code",{email:"qa-flow@example.invalid",purpose:"reset",captchaToken:"invalid-qa-token"}],
  ["reset-password","/api/auth/reset-password",{email:"qa-flow@example.invalid",password:"Qa-Password-123",code:"123456",consent:true,captchaToken:"invalid-qa-token"}]
 ];
 const cfg=await fetch("/api/auth/config",{cache:"no-store"});
 out.api.push({name:"turnstile-config",status:cfg.status,body:await cfg.json()});
 const me=await fetch("/api/auth/me",{cache:"no-store"});
 out.api.push({name:"session-without-cookie",status:me.status,body:await me.json()});
 for(const [name,url,body] of requests){
  try { const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}); out.api.push({name,status:r.status,body:await r.json()}); }
  catch(e){out.api.push({name,error:String(e)});}
 }
 for(const kind of ["terms","privacy"]){
  document.querySelector('[data-legal="'+kind+'"]')?.click();
  const dlg=document.querySelector("#legal-dialog");
  out.legal.push({kind,title:document.querySelector("#legal-title")?.textContent,length:document.querySelector("#legal-body")?.textContent?.length,open:dlg?.open});
  dlg?.close();
 }
 const p=document.createElement("pre");p.id="qa-flow-result";p.textContent=JSON.stringify(out);document.body.appendChild(p);
})();