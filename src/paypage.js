import "./paypage.css";
const app=document.querySelector("#app");
const params=new URLSearchParams(location.search);
const merchantNo=String(params.get("merchant")||"").trim();
const presetAmount=String(params.get("amount")||"").trim();
let submitting=false;
function showError(message){const n=document.querySelector("#qt-pay-error");if(n){n.textContent=message;n.hidden=false}}
async function createPayment(amount){
 if(submitting)return;
 if(!/^\d{6}$/.test(merchantNo)){showError("收款链接无效，请联系商户重新获取。");return}
 if(!/^\d{1,8}(?:\.\d{1,2})?$/.test(amount)||!Number.isFinite(Number(amount))||Number(amount)<.01||Number(amount)>1000000){showError("请输入 0.01 至 1,000,000 元之间的金额，最多两位小数。");return}
 submitting=true;const button=document.querySelector("#qt-pay-submit");button.disabled=true;button.textContent="正在创建订单…";document.querySelector("#qt-pay-error").hidden=true;
 try{const response=await fetch("/api/pay/create",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({merchant_no:merchantNo,amount})});const payload=await response.json().catch(()=>({}));if(!response.ok||payload.code!=="SUCCESS"||!payload.data?.checkout_url)throw new Error(payload.message||"暂时无法创建收款订单，请稍后重试。");location.assign(payload.data.checkout_url)}
 catch(error){showError(error.message||"网络异常，请稍后重试。");submitting=false;button.disabled=false;button.textContent="去支付"}
}
function render(){
 app.innerHTML=\`<main class="qt-paypage"><header class="qt-paypage-header"><a class="qt-paypage-brand" href="/"><span class="qt-paypage-logo">晴</span><b>晴天支付</b></a><span class="qt-paypage-secure"><i></i>安全加密连接</span></header><section class="qt-paypage-main"><div class="qt-paypage-intro"><span class="qt-paypage-eyebrow">SECURE PAYMENT</span><h1>快捷收款</h1><p>请输入本次需要支付的金额</p></div><section class="qt-paypage-card"><div class="qt-paypage-merchant"><span class="qt-paypage-merchant-icon">收</span><div><b>商户收款</b><small>订单将由晴天支付安全处理</small></div><span class="qt-paypage-shield">✓ 安全支付</span></div><form id="qt-pay-form" novalidate><label for="qt-pay-amount">付款金额（人民币）</label><div class="qt-pay-amount-input"><span>¥</span><input id="qt-pay-amount" name="amount" type="text" inputmode="decimal" autocomplete="off" maxlength="11" placeholder="0.00" required></div><div class="qt-pay-amount-hint">请与商户确认金额后再付款</div><p id="qt-pay-error" class="qt-pay-error" role="alert" hidden></p><button id="qt-pay-submit" class="qt-pay-submit" type="submit">去支付 <span>→</span></button></form><div class="qt-paypage-security"><span>♢</span> 请核对付款金额，支付成功后请勿重复付款</div></section><div class="qt-paypage-brand-foot"><span>晴天支付</span><span>安全 · 透明 · 高效</span></div></section></main>\`;
 const input=document.querySelector("#qt-pay-amount"),form=document.querySelector("#qt-pay-form");
 form.addEventListener("submit",e=>{e.preventDefault();createPayment(input.value.trim())});
 input.addEventListener("input",()=>{input.value=input.value.replace(/[^\d.]/g,"").replace(/(\..*)\./g,"$1");const [w,f]=input.value.split(".");if(f?.length>2)input.value=w+"."+f.slice(0,2);document.querySelector("#qt-pay-error").hidden=true});
 if(!/^\d{6}$/.test(merchantNo)){document.querySelector("#qt-pay-submit").disabled=true;showError("收款链接无效，请联系商户重新获取。");return}
 if(presetAmount){input.value=presetAmount;createPayment(presetAmount)}else input.focus({preventScroll:true});
}
render();