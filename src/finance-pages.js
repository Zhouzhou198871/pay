import "./merchant-workspace.css";
const API={orders:"/api/merchant/orders",withdrawals:"/api/merchant/withdrawals",ledger:"/api/merchant/ledger",withdraw:"/api/merchant/withdraw"};
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=(v,c="USDT")=>{if(v==null||!Number.isFinite(Number(v)))return "—";let n=BigInt(Math.trunc(Number(v))),neg=n<0n;if(neg)n=-n;return(neg?"-":"")+(n/1000000n).toLocaleString("en-US")+"."+String(n%1000000n).padStart(6,"0")+" "+c};
const yuan=v=>v==null||!Number.isFinite(Number(v))?"—":"¥ "+(Number(v)/100).toLocaleString("zh-CN",{minimumFractionDigits:2,maximumFractionDigits:2});
const date=v=>{let n=Number(v);return!Number.isFinite(n)||n<=0?"—":new Intl.DateTimeFormat("zh-CN",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(n*1000))};
const labels={pending:"待审核",paid:"已打款",failed:"失败",cancelled:"已取消",refunded:"已退款",approved:"已通过",processing:"打款处理中",rejected:"已拒绝"};
const status=v=>labels[v]||(v?String(v):"—");
function toast(msg,type="error"){let e=$("#qt-finance-toast");if(!e){e=document.createElement("div");e.id="qt-finance-toast";e.className="qt-finance-toast";document.body.append(e)}e.dataset.type=type;e.textContent=msg;e.classList.add("is-visible");clearTimeout(e._timer);e._timer=setTimeout(()=>e.classList.remove("is-visible"),2600)}
function cell(v,cls=""){let e=document.createElement("td");e.className=cls;e.textContent=v==null||v===""?"—":String(v);return e}
function table(items,heads,row,cls="qt-finance-table"){let w=document.createElement("div");w.className="qt-finance-table-wrap";let t=document.createElement("table");t.className=cls;let h=document.createElement("thead"),r=document.createElement("tr");heads.forEach(x=>{let e=document.createElement("th");e.textContent=x;r.append(e)});h.append(r);let b=document.createElement("tbody");items.forEach(x=>b.append(row(x)));t.append(h,b);w.append(t);return w}
function pages(root,p,load){let n=Number(p?.page||1),max=Math.max(1,Number(p?.pages||1)),f=document.createElement("div");f.className="record-pagination";let l=document.createElement("span");l.textContent="共 "+Number(p?.total||0)+" 条 · 第 "+n+" / "+max+" 页";let c=document.createElement("div");[["上一页",n<=1,n-1],["下一页",n>=max,n+1]].forEach(([s,d,v])=>{let b=document.createElement("button");b.type="button";b.textContent=s;b.disabled=d;b.onclick=()=>load(v);c.append(b)});f.append(l,c);root.append(f)}
function showDetail(x,dlg,panel){let rate=x.status==="paid"&&Number(x.amount_cents)>0?Number(x.fee_cents||0)/Number(x.amount_cents)*100:null,rows=[["系统订单",x.system_order_no],["商户订单",x.merchant_order_no],["商品名称",x.subject],["支付方式",x.payment_channel],["商品金额",money(x.amount_micro,x.currency||"USDT")],["实际支付",yuan(x.actual_paid_cents)],["扣费后金额",x.credit_micro==null?"—":money(x.credit_micro,x.currency||"USDT")],["费率",rate==null?"—":rate.toFixed(2)+"%"],["USDT 入账",x.credit_micro==null?"—":money(x.credit_micro)],["状态",x.status?(x.status==="pending"?"未支付":status(x.status)):"—"],["创建时间",date(x.created_at)],["支付时间",date(x.paid_at)],["退款时间",date(x.refunded_at)]];let root=$("#qt-order-detail-list",panel);root.replaceChildren();rows.forEach(([k,v])=>{let r=document.createElement("div");r.className="qt-detail-row";let a=document.createElement("span"),b=document.createElement("b");a.textContent=k;b.textContent=v==null||v===""?"—":String(v);r.append(a,b);root.append(r)});dlg.showModal()}
function renderOrders(panel){
panel.innerHTML='<section class="qt-finance-page"><form id="qto-filter" class="qt-filter-card"><div class="qt-filter-grid"><label>订单号类型<select name="search_type"><option value="trade_no">系统订单号</option><option value="out_trade_no">商户订单号</option><option value="subject">商品名称</option></select></label><label class="qt-filter-wide">搜索内容<input name="keyword" placeholder="输入订单号或商品名称"></label><label>开始日期<input name="start_date" type="date"></label><label>结束日期<input name="end_date" type="date"></label><label>支付方式<select name="method"><option value="">全部方式</option><option value="alipay">支付宝</option><option value="alipay_h5">支付宝 H5</option></select></label><label>订单状态<select name="status"><option value="">全部状态</option><option value="pending">未支付</option><option value="paid">已支付</option><option value="failed">失败</option><option value="cancelled">已取消</option><option value="refunded">已退款</option></select></label></div><div class="qt-filter-actions"><button class="qt-primary-button">搜索</button><button type="reset" class="qt-outline-button">重置</button></div></form><section class="qt-data-card"><div class="qt-data-card-head"><div><h3>订单记录</h3><p>payment_orders 与入账账本真实数据</p></div><span id="qto-count" class="qt-data-count">—</span></div><div id="qto-table"></div></section></section><dialog class="qt-detail-dialog" id="qto-detail"><div class="qt-dialog-heading"><div><small>ORDER DETAILS</small><h3>订单详情</h3></div><button type="button" class="qt-dialog-close" data-qto-close>×</button></div><div class="qt-detail-list" id="qt-order-detail-list"></div><div class="qt-dialog-actions"><button type="button" class="qt-primary-button" data-qto-close>关闭</button></div></dialog>';
let form=$("#qto-filter",panel),root=$("#qto-table",panel),dlg=$("#qto-detail",panel);
async function load(p=1){root.innerHTML='<div class="section-loading">正在读取订单…</div>';let q=new URLSearchParams(new FormData(form));q.set("page",p);q.set("page_size",20);try{let r=await fetch(API.orders+"?"+q,{credentials:"same-origin",headers:{Accept:"application/json"}}),d=await r.json().catch(()=>({}));if(r.status===401){location.href="/";return}if(!r.ok)throw Error(d.error||"订单读取失败");let xs=Array.isArray(d.items)?d.items:[];$("#qto-count",panel).textContent=Number(d.pagination?.total||0)+" 笔";if(!xs.length){root.innerHTML='<div class="qt-finance-empty">暂无符合条件的订单记录</div>';return}
let w=table(xs,["订单编号 / 商户订单号","商品名称","商品金额","实际支付","扣费后金额 / 费率","状态","操作"],x=>{let tr=document.createElement("tr"),o=document.createElement("td");o.innerHTML="<strong>"+esc(x.system_order_no||"—")+"</strong><small>商户："+esc(x.merchant_order_no||"—")+"</small>";tr.append(o,cell(x.subject,"qt-nowrap"),cell(money(x.amount_micro,x.currency||"USDT")),cell(yuan(x.actual_paid_cents)));let rate=Number(x.amount_cents)>0?Number(x.fee_cents||0)/Number(x.amount_cents)*100:null,n=document.createElement("td");n.innerHTML="<strong>"+esc(x.credit_micro==null?"—":money(x.credit_micro,x.currency||"USDT"))+"</strong><small>费率 "+(rate==null?"—":rate.toFixed(2)+"%")+"</small>";tr.append(n);let st=document.createElement("td"),badge=document.createElement("span");badge.className="qt-status-pill qt-status-"+esc(x.status||"unknown");badge.textContent=x.status?(x.status==="pending"?"未支付":status(x.status)):"—";st.append(badge);tr.append(st);let a=document.createElement("td"),b=document.createElement("button");b.type="button";b.className="qt-row-action";b.textContent="明细";b.onclick=()=>showDetail(x,dlg,panel);a.append(b);tr.append(a);return tr},"qt-finance-table qt-order-table");root.replaceChildren(w);pages(root,d.pagination,n=>load(n))}catch(e){root.textContent=e.message||"订单读取失败"}}
form.onsubmit=e=>{e.preventDefault();load(1)};form.onreset=()=>setTimeout(()=>load(1),0);panel.querySelectorAll("[data-qto-close]").forEach(b=>b.onclick=()=>dlg.close());load()}
function renderWithdrawals(panel){
panel.innerHTML='<section class="qt-finance-page"><div class="qt-asset-grid"><article><span>可提现余额</span><strong id="qtw-available">—</strong></article><article><span>待提现</span><strong id="qtw-pending">—</strong></article><article><span>审核中</span><strong id="qtw-review">—</strong></article><article><span>已打款</span><strong id="qtw-paid">—</strong></article></div><section class="qt-data-card"><div class="qt-data-card-head"><div><h3>申请提现</h3><p>USDT 与法币双通道，提交前实时计算手续费和预计到账</p></div></div><div class="qt-withdraw-type-tabs" role="tablist" aria-label="提现方式"><button type="button" class="active" data-withdraw-type="usdt">USDT 提现</button><button type="button" data-withdraw-type="fiat">法币提现（支持白资/司法）</button></div><div class="qt-payout-bound" id="qtw-bound">正在读取提现资料…</div><form id="qtw-form" class="qt-withdraw-page-form"><label>提现金额（USDT）<div class="qt-amount-input"><input name="amount" id="qtw-amount" inputmode="decimal" placeholder="0.000000" required><button type="button" id="qtw-all">全部提现</button></div></label><div id="qtw-usdt-fields"><small>USDT 收款网络和地址使用个人资料中已绑定的信息。</small></div><div id="qtw-fiat-fields" hidden><div class="qt-fiat-channel-heading"><strong>法币提现（支持白资/司法）</strong><span>下款支持微信/支付宝</span></div><label>法币收款方式<select name="fiat_method" id="qtw-fiat-method"><option value="wechat">微信收款</option><option value="alipay">支付宝收款</option></select></label><label>真实姓名<input name="real_name" id="qtw-real-name" maxlength="40" autocomplete="name" placeholder="填写收款账户实名"><small class="qt-fiat-field-hint">用于微信/支付宝转账核对收款人身份，请务必填写正确</small></label><label>收款码图片<input name="qr_image_file" id="qtw-qr-file" type="file" accept="image/png,image/jpeg,image/webp"></label><div class="qt-qr-preview" id="qtw-qr-preview" hidden><img id="qtw-qr-image" alt="收款码预览"><button type="button" id="qtw-qr-remove">移除图片</button></div><small class="qt-fiat-field-hint">请从手机相册上传清晰、可识别的本人微信或支付宝收款码图片。提交后由后端保存至仅管理员可查看的私有收款资料。</small></div><div class="qt-withdraw-calculation"><div><span>预计手续费</span><b id="qtw-fee">—</b></div><div><span>预计实际到账</span><strong id="qtw-net">—</strong></div><small id="qtw-rate-note">费率按当前提现方式自动计算</small></div><label>支付密码<input name="withdraw_password" type="password" minlength="8" maxlength="64" autocomplete="current-password" required></label><p class="qt-withdraw-rule" id="qtw-rule">USDT 提现：不足 500 USDT 收取 5 USDT 手续费，达到 500 USDT 免手续费。</p><button class="qt-primary-button" type="submit">提交提现申请</button><p class="qt-withdraw-feedback" id="qtw-feedback" role="status"></p></form></section><section class="qt-data-card"><div class="qt-data-card-head"><div><h3>提现记录</h3><p>包含提现方式、手续费和实际到账金额</p></div></div><form id="qtw-filter" class="qt-inline-filter"><label>状态<select name="status"><option value="all">全部状态</option><option value="pending">待审核</option><option value="approved">已通过</option><option value="processing">打款中</option><option value="paid">已打款</option><option value="rejected">已拒绝</option><option value="cancelled">已取消</option></select></label><button class="qt-primary-button">搜索</button><button class="qt-outline-button" type="reset">重置</button></form><div id="qtw-table"></div></section><section class="qt-data-card" id="qtw-admin-panel" hidden><div class="qt-data-card-head"><div><h3>管理员审核与打款</h3><p>仅 ADMIN_USER_IDS 白名单管理员可见；拒绝申请将自动退回原扣款</p></div><button class="qt-outline-button" type="button" id="qtw-admin-refresh">刷新审核列表</button></div><div id="qtw-admin-list"><div class="section-loading">正在验证管理员权限…</div></div></section><dialog class="qt-detail-dialog" id="qtw-admin-payout-dialog"><form id="qtw-admin-payout-form"><div class="qt-dialog-heading"><div><small>ADMIN PAYOUT CONFIRMATION</small><h3>确认完成打款</h3></div><button type="button" class="qt-dialog-close" id="qtw-admin-dialog-close">×</button></div><p id="qtw-admin-payout-target" class="qt-withdraw-rule"></p><label>打款凭证 / 交易参考号<input id="qtw-admin-reference" minlength="4" maxlength="128" required></label><label>审核备注（选填）<input id="qtw-admin-note" maxlength="500"></label><div class="qt-dialog-actions"><button type="button" class="qt-outline-button" id="qtw-admin-dialog-cancel">取消</button><button class="qt-primary-button" type="submit">确认已打款</button></div><p id="qtw-admin-payout-feedback" role="status"></p></form></dialog></section>';
let form=$("#qtw-form",panel),filter=$("#qtw-filter",panel),root=$("#qtw-table",panel),input=$("#qtw-amount",panel),available=0,withdrawType="usdt",rate=0,usdtAddress="",qrData="",adminPayoutId="";
const fiatFields=$("#qtw-fiat-fields",panel),usdtFields=$("#qtw-usdt-fields",panel);
const fmt=(n,d=2)=>Number(n||0).toLocaleString("zh-CN",{minimumFractionDigits:d,maximumFractionDigits:d});
const feeFor=(micro)=>withdrawType==="usdt"?(micro<500000000?5000000:0):Math.round(micro*600/10000);
function updateEstimate(){
 const raw=input.value.trim(),valid=/^\d{1,10}(?:\.\d{1,6})?$/.test(raw),micro=valid?Math.round(Number(raw)*1e6):0;
 const fee=feeFor(micro),net=withdrawType==="usdt"?micro:Math.max(0,micro-fee);
 $("#qtw-fee",panel).textContent=valid&&micro>0?fmt(fee/1e6,6)+" USDT":"—";
 $("#qtw-net",panel).textContent=valid&&micro>0?(withdrawType==="usdt"?fmt(net/1e6,6)+" USDT":(rate>0?"¥ "+fmt(net/1e6*rate,2):"汇率待配置")):"—";
 $("#qtw-rate-note",panel).textContent=withdrawType==="usdt"?"手续费：不足 500 USDT 固定 5 USDT；达到 500 USDT 免手续费。":"白资/法币通道手续费：6%；预计到账按配置汇率 "+(rate>0?rate.toFixed(4):"未配置")+" CNY/USDT 换算。";
}
function setType(type){
 withdrawType=type==="fiat"?"fiat":"usdt";
 panel.querySelectorAll("[data-withdraw-type]").forEach(b=>b.classList.toggle("active",b.dataset.withdrawType===withdrawType));
 fiatFields.hidden=withdrawType!=="fiat";usdtFields.hidden=withdrawType!=="usdt";$("#qtw-real-name",panel).required=withdrawType==="fiat";$("#qtw-qr-file",panel).required=withdrawType==="fiat";
 $("#qtw-rule",panel).textContent=withdrawType==="usdt"?"USDT 提现：不足 500 USDT 收取 5 USDT 手续费，达到 500 USDT 免手续费。":"白资/法币通道手续费：6%。按 USDT 余额扣除 6% 后，使用 WITHDRAW_USDT_CNY_RATE 配置汇率折算人民币；下款支持微信/支付宝。";
 updateEstimate();
}
panel.querySelectorAll("[data-withdraw-type]").forEach(b=>b.addEventListener("click",()=>setType(b.dataset.withdrawType)));
input.addEventListener("input",updateEstimate);
$("#qtw-all",panel).onclick=()=>{
 let max=available;
 if(withdrawType==="usdt"&&available<500000000)max=Math.max(0,available-5000000);
 input.value=(max/1e6).toFixed(6);updateEstimate();
};
async function compressQr(file){
 if(!file||!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>8*1024*1024)throw Error("请选择 PNG、JPG 或 WebP 图片，原图不超过 8MB。");
 const src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error("图片读取失败"));reader.readAsDataURL(file)});
 const img=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error("图片格式无法读取"));image.src=src});
 const scale=Math.min(1,1000/Math.max(img.width,img.height)),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
 const ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",.9));if(!blob)throw Error("收款码图片压缩失败");
 const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error("图片转换失败"));reader.readAsDataURL(blob)});
 if(String(data).length>320000)throw Error("图片过大，请裁剪为清晰的收款码后重新上传。");return data;
}
$("#qtw-qr-file",panel).addEventListener("change",async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{qrData=await compressQr(file);$("#qtw-qr-image",panel).src=qrData;$("#qtw-qr-preview",panel).hidden=false;}
 catch(err){e.target.value="";qrData="";toast(err.message||"图片处理失败");}
});
function clearQr(){$("#qtw-qr-file",panel).value="";$("#qtw-qr-image",panel).removeAttribute("src");$("#qtw-qr-preview",panel).hidden=true;qrData=""}
$("#qtw-qr-remove",panel).onclick=clearQr;
async function load(p=1){
 root.innerHTML='<div class="section-loading">正在读取提现记录…</div>';
 const q=new URLSearchParams({page:p,page_size:20,status:filter.elements.status.value||"all"});
 try{
  const r=await fetch(API.withdrawals+"?"+q,{credentials:"same-origin",headers:{Accept:"application/json"}}),d=await r.json().catch(()=>({}));
  if(r.status===401){location.href="/";return}if(!r.ok)throw Error(d.error||"提现记录读取失败");
  const s=d.summary||{};available=Number(s.available_micro||0);
  $("#qtw-available",panel).textContent=money(s.available_micro);$("#qtw-pending",panel).textContent=money(s.pending_micro);$("#qtw-review",panel).textContent=money(s.reviewing_micro);$("#qtw-paid",panel).textContent=money(s.paid_micro);
  const payout=d.payout||{};usdtAddress=String(payout.address||"");rate=Number(d.withdrawal_config?.usdt_cny_rate||0);
  $("#qtw-bound",panel).textContent=withdrawType==="usdt"?(usdtAddress?String(payout.network||"USDT-TRC20")+" · "+usdtAddress:"未设置 USDT 地址，请先到个人资料绑定"):("法币折算汇率："+(rate>0?rate.toFixed(4)+" CNY/USDT":"未配置，暂不可提交"));
  input.max=(available/1e6).toFixed(6);updateEstimate();
  const xs=Array.isArray(d.items)?d.items:[];
  if(!xs.length){root.innerHTML='<div class="qt-finance-empty">暂无提现记录</div>';}
  else{
   const w=table(xs,["提现方式","收款信息","申请金额","手续费","预计到账","状态","申请时间"],x=>{
    const type=x.withdraw_type==="fiat"?"法币":"USDT";
    const payoutText=x.withdraw_type==="fiat"?"¥ "+fmt(Number(x.payout_amount_cents||0)/100,2):money(x.payout_amount_micro??x.amount_micro,x.currency||"USDT");
    const tr=document.createElement("tr");
    [type,x.destination_masked||"—",money(x.amount_micro,x.currency||"USDT"),money(x.fee_amount??x.fee_micro,x.currency||"USDT"),payoutText,(x.status==="pending"?"待审核":status(x.status)),date(x.requested_at)].forEach(v=>tr.append(cell(v)));
    return tr;
   },"qt-finance-table qt-withdraw-table");
   root.replaceChildren(w);pages(root,d.pagination,n=>load(n));
  }
 }catch(e){root.textContent=e.message||"提现记录读取失败"}
}
filter.onsubmit=e=>{e.preventDefault();load(1)};filter.onreset=()=>setTimeout(()=>load(1),0);
form.onsubmit=async e=>{
 e.preventDefault();const raw=input.value.trim(),micro=/^\d{1,10}(?:\.\d{1,6})?$/.test(raw)?Math.round(Number(raw)*1e6):0;
 if(!micro||micro>available){toast("请输入有效金额，且不能超过当前余额");return}
 if(withdrawType==="usdt"&&!usdtAddress){toast("未绑定 USDT 地址，请先到个人资料填写");return}
 if(withdrawType==="fiat"){
  if(!rate){toast("法币提现汇率尚未配置，请联系平台客服");return}
  if($("#qtw-real-name",panel).value.trim().length<2){toast("请填写真实姓名");return}
  if(!qrData){toast("请上传微信或支付宝收款码图片");return}
 }
 const fee=feeFor(micro),totalDebit=withdrawType==="usdt"?micro+fee:micro;
 if(totalDebit>available){toast("可提现余额不足（已计入手续费）");return}
 const pw=form.elements.withdraw_password.value;if(pw.length<8||pw.length>64){toast("请输入 8 至 64 位支付密码");return}
 const b=form.querySelector('[type="submit"]');b.disabled=true;$("#qtw-feedback",panel).textContent="正在提交申请…";
 try{
  const payload={amount:raw,withdraw_type:withdrawType,withdraw_password:pw};
  if(withdrawType==="fiat")Object.assign(payload,{fiat_method:$("#qtw-fiat-method",panel).value,real_name:$("#qtw-real-name",panel).value.trim(),qr_image:qrData});
  const r=await fetch(API.withdraw,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(payload)}),d=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(d.error||"提现申请失败");
  toast(d.message||"提现申请已提交","success");form.reset();clearQr();input.value="";$("#qtw-feedback",panel).textContent="";setType("usdt");await load(1);
 }catch(err){$("#qtw-feedback",panel).textContent=err.message||"提现申请失败";toast(err.message||"提现申请失败")}
 finally{b.disabled=false}
};
async function loadAdmin(){
 const section=$("#qtw-admin-panel",panel),list=$("#qtw-admin-list",panel);
 try{
  const access=await fetch("/api/admin/access",{credentials:"same-origin",headers:{Accept:"application/json"}});
  if(!access.ok){section.hidden=true;return}
  const info=await access.json();if(!info.is_admin){section.hidden=true;return}
  section.hidden=false;list.innerHTML='<div class="section-loading">正在读取待审核申请…</div>';
  const response=await fetch("/api/admin/withdrawals?status=actionable&page=1&page_size=50",{credentials:"same-origin",headers:{Accept:"application/json"}});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||"审核列表读取失败");
  const items=Array.isArray(data.items)?data.items:[];
  if(!items.length){list.innerHTML='<div class="qt-finance-empty">暂无待审核提现申请</div>';return}
  list.replaceChildren();
  items.forEach(item=>{
   let bank={};try{bank=JSON.parse(item.bank_account_info||"{}")}catch{}
   const card=document.createElement("article");card.className="qt-withdraw-review-card";
   const heading=document.createElement("div");heading.className="qt-withdraw-review-head";
   const title=document.createElement("strong");title.textContent=(item.withdraw_type==="fiat"?"法币提现":"USDT 提现")+" · "+item.request_no;
   const state=document.createElement("span");state.textContent=item.status==="pending"?"待审核":item.status==="approved"?"已通过待打款":"打款处理中";heading.append(title,state);
   const details=document.createElement("div");details.className="qt-withdraw-review-details";
   const rows=[["用户",item.email||item.user_id],["申请金额",money(item.amount_micro,item.currency||"USDT")],["手续费",money(item.fee_amount??item.fee_micro,item.currency||"USDT")],["实际到账",item.withdraw_type==="fiat"?"¥ "+fmt(Number(item.payout_amount_cents||0)/100,2):money(item.payout_amount_micro??item.amount_micro)],["收款信息",item.withdraw_type==="fiat"?(String(bank.method||"")+"/"+String(bank.real_name||"")):(String(item.payout_network||"USDT")+" · "+String(item.payout_address||item.destination_masked||""))],["申请时间",date(item.requested_at)]];
   rows.forEach(([k,v])=>{const row=document.createElement("div"),label=document.createElement("span"),value=document.createElement("b");label.textContent=k;value.textContent=String(v??"—");row.append(label,value);details.append(row)});
   card.append(heading,details);
   if(item.withdraw_type==="fiat"&&/^data:image\/(?:png|jpeg|webp);base64,/.test(bank.qr_image_url||"")){
    const img=document.createElement("img");img.className="qt-withdraw-receipt-image";img.src=bank.qr_image_url;img.alt="商户提交的收款码（管理员可见）";card.append(img);
   }
   const actions=document.createElement("div");actions.className="qt-withdraw-review-actions";
   if(item.status==="pending"){
    const approve=document.createElement("button");approve.type="button";approve.className="qt-primary-button";approve.textContent="审核通过";
    const reject=document.createElement("button");reject.type="button";reject.className="qt-outline-button";reject.textContent="拒绝并退回余额";
    approve.onclick=()=>review(item.id,"approve");reject.onclick=()=>{const note=window.prompt("请输入拒绝原因（必填）","");if(note===null)return;if(!note.trim()){toast("请填写拒绝原因");return}review(item.id,"reject",note.trim())};
    actions.append(approve,reject);
   }
   if(["approved","processing","pending"].includes(item.status)){
    const paid=document.createElement("button");paid.type="button";paid.className="qt-outline-button";paid.textContent="登记已打款";paid.onclick=()=>{adminPayoutId=String(item.id);$("#qtw-admin-payout-target",panel).textContent=title.textContent+" · "+(item.withdraw_type==="fiat"?"法币收款":"USDT 收款");$("#qtw-admin-reference",panel).value="";$("#qtw-admin-note",panel).value="";$("#qtw-admin-payout-dialog",panel).showModal()};
    actions.append(paid);
   }
   card.append(actions);list.append(card);
  });
 }catch(e){list.textContent=e.message||"管理员审核列表读取失败"}
}
async function review(id,action,note=""){
 try{const r=await fetch("/api/admin/withdrawals/"+encodeURIComponent(id)+"/review",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({action,note})}),d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"审核操作失败");toast(d.message||"审核状态已更新","success");await loadAdmin();await load(1)}
 catch(e){toast(e.message||"审核操作失败")}
}
$("#qtw-admin-refresh",panel).onclick=loadAdmin;
const dlg=$("#qtw-admin-payout-dialog",panel);
$("#qtw-admin-dialog-close",panel).onclick=()=>dlg.close();$("#qtw-admin-dialog-cancel",panel).onclick=()=>dlg.close();
$("#qtw-admin-payout-form",panel).onsubmit=async e=>{
 e.preventDefault();const b=e.currentTarget.querySelector('[type="submit"]');b.disabled=true;
 try{const r=await fetch("/api/admin/withdrawals/"+encodeURIComponent(adminPayoutId)+"/paid",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({payout_reference:$("#qtw-admin-reference",panel).value.trim(),note:$("#qtw-admin-note",panel).value.trim()})}),d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"打款登记失败");toast(d.message||"已登记打款","success");dlg.close();await loadAdmin();await load(1)}
 catch(err){$("#qtw-admin-payout-feedback",panel).textContent=err.message||"操作失败"}
 finally{b.disabled=false}
};
setType("usdt");load();loadAdmin();
}
function renderLedger(panel){
panel.innerHTML='<section class="qt-finance-page"><form id="qtl-filter" class="qt-filter-card"><div class="qt-filter-grid"><label>操作类型<select name="direction"><option value="">全部类型</option><option value="credit">收入</option><option value="debit">支出</option></select></label><label class="qt-filter-wide">搜索内容<input name="keyword" placeholder="流水号、说明或关联订单号"></label></div><div class="qt-filter-actions"><button class="qt-primary-button">搜索</button><button class="qt-outline-button" type="reset">重置</button></div></form><section class="qt-data-card"><div class="qt-data-card-head"><div><h3>资金明细</h3><p>真实账本记录，按时间倒序</p></div></div><div id="qtl-table"></div></section></section>';
let form=$("#qtl-filter",panel),root=$("#qtl-table",panel);
async function load(p=1){root.innerHTML='<div class="section-loading">正在读取账本…</div>';let q=new URLSearchParams(new FormData(form));q.set("page",p);q.set("page_size",20);try{let r=await fetch(API.ledger+"?"+q,{credentials:"same-origin",headers:{Accept:"application/json"}}),d=await r.json().catch(()=>({}));if(r.status===401){location.href="/";return}if(!r.ok)throw Error(d.error||"资金明细读取失败");let xs=Array.isArray(d.items)?d.items:[];if(!xs.length){root.innerHTML='<div class="qt-finance-empty">暂无资金流水记录</div>';return}let w=table(xs,["操作类型","变更金额","变更前金额","变更后金额","时间","说明"],x=>{let n=Number(x.amount_micro||0),after=Number(x.balance_after_micro),before=Number.isFinite(after)?(x.direction==="credit"?after-n:after+n):null,tr=document.createElement("tr");tr.append(cell(x.direction==="credit"?"收入":x.direction==="debit"?"支出":"—"),cell((x.direction==="credit"?"+":x.direction==="debit"?"−":"")+money(n,x.currency||"USDT"),x.direction==="credit"?"qt-money-in":"qt-money-out"),cell(before==null?"—":money(before,x.currency||"USDT")),cell(Number.isFinite(after)?money(after,x.currency||"USDT"):"—"),cell(date(x.created_at)),cell(x.description||x.category));return tr},"qt-finance-table qt-ledger-table");root.replaceChildren(w);pages(root,d.pagination,n=>load(n))}catch(e){root.textContent=e.message||"资金明细读取失败"}}
form.onsubmit=e=>{e.preventDefault();load(1)};form.onreset=()=>setTimeout(()=>load(1),0);load()}
export function renderFinancePage(key,panel=document.querySelector("#merchant-panel-content")){if(key==="orders")renderOrders(panel);if(key==="withdrawals")renderWithdrawals(panel);if(key==="ledger")renderLedger(panel)}
