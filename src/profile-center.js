import "./profile-center.css";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const request = async (method, body) => {
  const response = await fetch("/api/merchant/profile", { method, credentials:"same-origin", headers:{Accept:"application/json", ...(body?{"Content-Type":"application/json"}:{})}, ...(body?{body:JSON.stringify(body)}:{}) });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error("网络繁忙，请稍后重试。");
  return data;
};
const toast = (message, ok=false) => {
  let el=document.querySelector("#toast");
  if(!el){el=document.createElement("div");el.id="toast";el.className="toast";document.body.append(el);}
  el.textContent=message;el.dataset.type=ok?"success":"error";el.classList.add("visible");
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("visible"),3200);
};
async function renderProfileCenter() {
  const panel=document.querySelector("#merchant-panel-content");
  if(!panel)return;
  panel.innerHTML='<div class="section-loading">正在读取商户资料…</div>';
  let data;
  try{data=await request("GET");}
  catch(error){panel.innerHTML='<div class="section-empty"><h3>资料读取暂不可用</h3><p>网络繁忙，请稍后重试。</p><button class="record-retry" id="qtpc-retry">重新读取</button></div>';panel.querySelector("#qtpc-retry")?.addEventListener("click",renderProfileCenter);return;}
  const user=data.user||{},merchant=data.merchant||{};
  const apiBase=location.origin;
  panel.innerHTML=`
  <section class="qtpc-wrap">
    <nav class="qtpc-tabs" role="tablist" aria-label="个人资料分类">
      <button class="qtpc-tab active" type="button" role="tab" aria-selected="true" data-tab="api">API 信息</button>
      <button class="qtpc-tab" type="button" role="tab" aria-selected="false" data-tab="settings">修改资料</button>
    </nav>
    <div class="qtpc-pane" data-pane="api">
      <section class="qtpc-section">
        <h3>API 接入信息</h3>
        <div class="qtpc-field"><label>接口地址</label><div class="qtpc-copy"><code>${esc(apiBase)}</code><button type="button" data-copy="${esc(apiBase)}" aria-label="复制接口地址">▢</button></div></div>
        <div class="qtpc-field"><label>商户 ID</label><div class="qtpc-copy"><code id="qtpc-merchant-no">${esc(merchant.merchant_no||"")}</code><button type="button" data-copy-target="#qtpc-merchant-no">▢</button></div></div>
      </section>
      <hr class="qtpc-divider">
      <section class="qtpc-section">
        <h3>V1 接口（MD5 签名方式）</h3>
        <div class="qtpc-field"><label>商户 MD5 密钥（40 位）</label><div class="qtpc-copy"><code id="qtpc-api-key" class="qtpc-secret">${esc(merchant.api_key||"")}</code><button type="button" data-copy-target="#qtpc-api-key">▢</button></div><p class="qtpc-help">密钥仅对当前登录商户展示。重置后旧密钥立即失效，请同步更新调用方配置。</p></div>
        <div class="qtpc-actions"><a class="qtpc-btn" href="/docs/V1_MERCHANT_API.md" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;text-decoration:none">查看 V1 开发文档</a><button class="qtpc-btn danger" type="button" id="qtpc-rotate">重置商户 MD5 密钥</button></div>
      </section>
      <hr class="qtpc-divider">
      <section class="qtpc-section" id="qtpc-v2-section">
        <h3>V2 接口（RSA-2048 签名方式）</h3>
        <p class="qtpc-help">使用 SHA256withRSA（RSASSA-PKCS1-v1_5）进行请求签名。商户私钥仅在生成或重置时展示一次；平台保存加密副本，平台使用对应商户公钥验签。</p>
        <div class="qtpc-field"><label>商户公钥（平台验签用）</label><div class="qtpc-keyblock"><code id="qtpc-v2-public">${esc(merchant.v2_public_key||"尚未生成 RSA 密钥对")}</code><button type="button" data-copy-target="#qtpc-v2-public" ${merchant.v2_public_key?"":"disabled"}>复制公钥</button></div></div>
        <div class="qtpc-field"><label>商户私钥（仅生成时展示一次）</label><div class="qtpc-note"><strong>${merchant.v2_key_configured?"私钥已加密保存，出于安全原因不再提供读取。":"尚未生成 V2 密钥对"}</strong>${merchant.v2_key_configured?"如未妥善保存私钥，请重置密钥对；重置后旧私钥立即失效。":"点击下方生成按钮后，请立即复制并安全保管私钥。不要发送给任何人或放入前端代码。"}</div><div id="qtpc-v2-private-wrap" hidden style="margin-top:10px"><textarea class="qtpc-input qtpc-secret" id="qtpc-v2-private" rows="8" readonly spellcheck="false"></textarea><button class="qtpc-btn secondary" type="button" id="qtpc-v2-copy-private" style="margin-top:8px">复制本次生成的私钥</button></div></div>
        <div class="qtpc-actions"><button class="qtpc-btn" type="button" id="qtpc-v2-generate">${merchant.v2_key_configured?"重置 V2 RSA 密钥对":"生成 V2 RSA 密钥对"}</button><a class="qtpc-btn secondary" href="/docs/V2_MERCHANT_API.md" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;text-decoration:none">查看 V2 开发文档</a></div>
        <p class="qtpc-help">V2 接口地址：<code>${esc(apiBase)}/api/v2/payments</code></p>
      </section>
      <hr class="qtpc-divider">
      <section class="qtpc-section" id="qtpc-platform-key-section">
        <h3>平台回调验签公钥</h3>
        <p class="qtpc-help">平台使用独立的平台 RSA-2048 私钥对异步支付通知签名。所有商户使用同一平台公钥验签，平台私钥不会向商户公开。</p>
        <div class="qtpc-field"><label>平台公钥（商户验签用）</label><div class="qtpc-keyblock"><code id="qtpc-platform-public">${esc(merchant.platform_public_key||"平台公钥暂不可用")}</code><button type="button" data-copy-target="#qtpc-platform-public" ${merchant.platform_public_key?"":"disabled"}>复制平台公钥</button></div></div>
        <p class="qtpc-help">SHA256withRSA（RSASSA-PKCS1-v1_5 + SHA-256），签名字段 sign，sign_type 为 RSA2。</p>
      </section>
      <hr class="qtpc-divider">
      <section class="qtpc-section"><h3>签名与安全说明</h3><div class="qtpc-note"><strong>商户凭据安全</strong>商户 ID 用于标识接入账户；MD5 密钥用于服务端请求签名校验。请仅在您自己的服务端保存密钥，不要写入网页、公开代码仓库或客户端应用。平台登录会话使用 HttpOnly Cookie，与商户 API 密钥相互独立。</div></section>
    </div>
    <div class="qtpc-pane" data-pane="settings" hidden>
      <section class="qtpc-section">
        <h3>账户资料</h3>
        <form id="qtpc-account">
          <div class="qtpc-field"><label for="qtpc-name">商户昵称</label><input class="qtpc-input" id="qtpc-name" name="display_name" maxlength="40" required value="${esc(user.display_name||"")}"></div>
          <div class="qtpc-field"><label>登录邮箱</label><div class="qtpc-copy"><code>${esc(user.email||"")}</code></div></div>
          <div class="qtpc-field"><label for="qtpc-current-password">当前登录密码（修改密码时填写）</label><input class="qtpc-input" id="qtpc-current-password" type="password" autocomplete="current-password" placeholder="修改登录密码时填写"></div>
          <div class="qtpc-field"><label for="qtpc-new-password">新登录密码</label><input class="qtpc-input" id="qtpc-new-password" type="password" minlength="8" maxlength="128" autocomplete="new-password" placeholder="留空表示不修改登录密码"></div>
          <button class="qtpc-btn block" type="submit">保存账户资料</button><p class="qtpc-help" id="qtpc-account-message" aria-live="polite"></p>
        </form>
      </section>
      <hr class="qtpc-divider">
      <section class="qtpc-section">
        <h3>收款账号设置</h3>
        <form id="qtpc-payout">
          <div class="qtpc-field"><label>结算方式</label><div class="qtpc-copy"><code>USDT 结算</code></div></div>
          <div class="qtpc-field"><label for="qtpc-address">USDT 提款地址</label><input class="qtpc-input" id="qtpc-address" name="usdt_address" maxlength="128" autocomplete="off" placeholder="请输入 USDT 提款地址" value="${esc(merchant.usdt_address||"")}" required></div>
          <div class="qtpc-field"><label for="qtpc-network">USDT 网络</label><select class="qtpc-select" id="qtpc-network" name="usdt_network"><option value="USDT-TRC20" ${merchant.usdt_network==="USDT-TRC20"?"selected":""}>USDT-TRC20</option><option value="USDT-ERC20" ${merchant.usdt_network==="USDT-ERC20"?"selected":""}>USDT-ERC20</option><option value="USDT-BEP20" ${merchant.usdt_network==="USDT-BEP20"?"selected":""}>USDT-BEP20</option></select></div>
          <button class="qtpc-btn block" type="submit">确定修改</button><p class="qtpc-help" id="qtpc-payout-message" aria-live="polite">请确认地址与网络一致，错误地址可能造成资产无法找回。</p>
        </form>
      </section>
      <hr class="qtpc-divider">
      <section class="qtpc-section">
        <h3>支付密码</h3>
        <p><span class="qtpc-state ${merchant.withdraw_password_set?"":"off"}" id="qtpc-password-state">${merchant.withdraw_password_set?"已设置":"未设置"}</span></p>
        <div class="qtpc-note" id="qtpc-password-hint"><strong>${merchant.usdt_address?"提现安全验证":"请先绑定 USDT 提款地址"}</strong>${merchant.usdt_address?"设置支付密码后，用于后续 USDT 提现身份校验。":"请先绑定并保存 USDT 提款地址，再设置支付密码。"}</div>
        <form id="qtpc-withdraw-password" style="margin-top:16px" ${merchant.usdt_address?"":"hidden"}>
          ${merchant.withdraw_password_set?'<div class="qtpc-field"><label for="qtpc-current-withdraw-password">当前支付密码</label><input class="qtpc-input" id="qtpc-current-withdraw-password" type="password" autocomplete="current-password" required></div>':""}
          <div class="qtpc-field"><label for="qtpc-withdraw-password-value">${merchant.withdraw_password_set?"新支付密码":"设置支付密码"}</label><input class="qtpc-input" id="qtpc-withdraw-password-value" type="password" minlength="8" maxlength="64" autocomplete="new-password" required placeholder="8 至 64 位"></div>
          <button class="qtpc-btn block" type="submit">${merchant.withdraw_password_set?"修改支付密码":"设置支付密码"}</button>
        </form>
      </section>
    </div>
  </section>`;
  panel.querySelectorAll("[data-tab]").forEach(btn=>btn.addEventListener("click",()=>{
    panel.querySelectorAll("[data-tab]").forEach(x=>{const active=x===btn;x.classList.toggle("active",active);x.setAttribute("aria-selected",String(active));});
    panel.querySelectorAll("[data-pane]").forEach(p=>p.hidden=p.dataset.pane!==btn.dataset.tab);
  }));
  panel.querySelectorAll("[data-copy],[data-copy-target]").forEach(btn=>btn.addEventListener("click",async()=>{
    const target=btn.dataset.copyTarget?panel.querySelector(btn.dataset.copyTarget):null;
    const value=btn.dataset.copy||target?.textContent?.trim()||"";
    try{await navigator.clipboard.writeText(value);btn.textContent="已复制";setTimeout(()=>btn.textContent="▢",1400);}catch{toast("复制失败，请检查浏览器权限。");}
  }));
  panel.querySelector("#qtpc-account")?.addEventListener("submit",async e=>{
    e.preventDefault();const form=e.currentTarget,button=form.querySelector("button[type=submit]"),msg=form.querySelector("#qtpc-account-message");
    const display_name=form.display_name.value.trim(),current_password=$("#qtpc-current-password",panel).value,new_password=$("#qtpc-new-password",panel).value;
    if(!display_name){msg.className="qtpc-error";msg.textContent="请输入商户昵称。";return;}
    if(new_password&&new_password.length<8){msg.className="qtpc-error";msg.textContent="新登录密码至少 8 位。";return;}
    if(new_password&&!current_password){msg.className="qtpc-error";msg.textContent="修改登录密码需要填写当前密码。";return;}
    button.disabled=true;button.textContent="保存中…";
    try{await request("PATCH",{action:"account",display_name,current_password,new_password});msg.className="qtpc-success";msg.textContent="账户资料已保存。";toast("账户资料已保存",true);if(new_password){form.reset();$("#qtpc-name",panel).value=display_name;}}
    catch(err){msg.className="qtpc-error";msg.textContent="网络繁忙，请稍后重试。";toast("网络繁忙，请稍后重试。");}
    finally{button.disabled=false;button.textContent="保存账户资料";}
  });
  panel.querySelector("#qtpc-payout")?.addEventListener("submit",async e=>{
    e.preventDefault();const form=e.currentTarget,button=form.querySelector("button[type=submit]"),msg=form.querySelector("#qtpc-payout-message");
    button.disabled=true;button.textContent="保存中…";
    try{await request("PATCH",{action:"payout",usdt_address:form.usdt_address.value.trim(),usdt_network:form.usdt_network.value});msg.className="qtpc-success";msg.textContent="USDT 提款地址已保存。";toast("USDT 提款地址已保存",true);const hint=panel.querySelector("#qtpc-password-hint");hint.innerHTML="<strong>提现安全验证</strong>已绑定提款地址，可设置支付密码。";panel.querySelector("#qtpc-withdraw-password").hidden=false;}
    catch(err){msg.className="qtpc-error";msg.textContent="网络繁忙，请稍后重试。";toast("网络繁忙，请稍后重试。");}
    finally{button.disabled=false;button.textContent="确定修改";}
  });
  panel.querySelector("#qtpc-withdraw-password")?.addEventListener("submit",async e=>{
    e.preventDefault();const form=e.currentTarget,button=form.querySelector("button[type=submit]"),password=$("#qtpc-withdraw-password-value",panel).value,current=$("#qtpc-current-withdraw-password",panel)?.value||"";
    button.disabled=true;button.textContent="保存中…";
    try{await request("PATCH",{action:"withdraw_password",withdraw_password:password,current_withdraw_password:current});panel.querySelector("#qtpc-password-state").textContent="已设置";panel.querySelector("#qtpc-password-state").classList.remove("off");form.reset();toast("支付密码已安全保存",true);}
    catch(err){toast("网络繁忙，请稍后重试。");}
    finally{button.disabled=false;button.textContent=merchant.withdraw_password_set?"修改支付密码":"设置支付密码";}
  });
  panel.querySelector("#qtpc-v2-generate")?.addEventListener("click",async()=>{
    const configured=Boolean(merchant.v2_key_configured);
    if(configured&&!confirm("重置后旧 V2 私钥立即失效，原私钥将无法继续签名。确认继续？"))return;
    const button=panel.querySelector("#qtpc-v2-generate");button.disabled=true;button.textContent="生成中…";
    try{
      const result=await request("PATCH",{action:configured?"reset_v2_keys":"generate_v2_keys"});
      panel.querySelector("#qtpc-v2-public").textContent=result.v2_public_key;
      panel.querySelector("#qtpc-v2-public").parentElement.querySelector("button").disabled=false;
      const wrap=panel.querySelector("#qtpc-v2-private-wrap");wrap.hidden=false;
      panel.querySelector("#qtpc-v2-private").value=result.v2_private_key_once;
      button.textContent="重置 V2 RSA 密钥对";
      toast("V2 密钥对已生成。私钥仅展示本次，请立即复制保存。",true);
    }catch(err){toast("网络繁忙，请稍后重试。");button.textContent=configured?"重置 V2 RSA 密钥对":"生成 V2 RSA 密钥对";}
    finally{button.disabled=false;}
  });
  panel.querySelector("#qtpc-v2-copy-private")?.addEventListener("click",async()=>{
    try{await navigator.clipboard.writeText(panel.querySelector("#qtpc-v2-private").value);toast("V2 私钥已复制，请妥善保管。",true);}
    catch{toast("复制失败，请手动选择私钥文本复制。");}
  });
  panel.querySelector("#qtpc-rotate")?.addEventListener("click",async()=>{
    if(!confirm("重置后旧 MD5 密钥立即失效，确认继续？"))return;
    const button=panel.querySelector("#qtpc-rotate");button.disabled=true;button.textContent="重置中…";
    try{const result=await request("PATCH",{action:"rotate_api_key"});panel.querySelector("#qtpc-api-key").textContent=result.api_key;toast("商户 MD5 密钥已重置",true);}
    catch(err){toast("网络繁忙，请稍后重试。");}
    finally{button.disabled=false;button.textContent="重置商户 MD5 密钥";}
  });
}
function $(selector,root=document){return root.querySelector(selector);}
function openProfile(event){
  const target=event.target instanceof Element?event.target:null;
  if(!target)return;
  const direct=target.closest("#open-profile,[data-section='profile']");
  if(!direct)return;
  event.preventDefault();event.stopImmediatePropagation();
  document.querySelector("#merchant-drawer")?.classList.remove("open");
  document.querySelector("#merchant-backdrop")?.classList.remove("visible");
  document.body.classList.remove("merchant-menu-open");
  const heading=document.querySelector("#merchant-greeting");if(heading)heading.textContent="个人资料";
  const title=document.querySelector("#merchant-panel-title");if(title)title.textContent="个人资料";
  const subtitle=document.querySelector("#merchant-panel-subtitle");if(subtitle)subtitle.textContent="账户资料、商户 API 凭据与 USDT 提款设置";
  document.querySelectorAll(".drawer-link").forEach(x=>x.classList.toggle("active",x.dataset.section==="profile"));
  renderProfileCenter();
}
document.addEventListener("click",openProfile,true);
