const html = (body, status = 200) => new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } });
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export async function onRequestGet({ params, env }) {
  if (!env.AUTH_DB) return html('Service unavailable', 503);
  const orderNo = String(params.order_no || '');
  if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(orderNo)) return html('订单不存在', 404);
  const order = await env.AUTH_DB.prepare(
    "SELECT trade_no, out_trade_no, amount_cents, amount_micro, currency, method, subject, status, pay_url, pay_info, created_at FROM payment_orders WHERE trade_no = ? OR out_trade_no = ? ORDER BY created_at DESC LIMIT 1"
  ).bind(orderNo, orderNo).first();
  if (!order) return html('订单不存在', 404);

  let payInfo = {};
  try { payInfo = JSON.parse(order.pay_info || '{}'); } catch {}
  const isInternalDemoRecord = String(order.out_trade_no || '').startsWith('TEST_UI_');
  const currency = String(order.currency || 'USDT').toUpperCase();
  const rawAmount = currency === 'USDT' && order.amount_micro != null
    ? Number(order.amount_micro) / 1000000
    : Number(order.amount_cents || 0) / 100;
  const amount = Number.isFinite(rawAmount) ? rawAmount.toFixed(currency === 'USDT' ? 6 : 2).replace(/0+$/, '').replace(/\.$/, '') : '0.00';
  const amountLabel = payInfo.amount_cny ? '¥' + esc(payInfo.amount_cny) : currency === 'CNY' ? '¥' + amount : amount + ' ' + currency;
  const subject = isInternalDemoRecord && /UI\s*测试订单/i.test(String(order.subject || ''))
    ? '订单支付'
    : String(order.subject || '订单支付');
  const orderJson = JSON.stringify(order.out_trade_no || orderNo).replace(/</g, '\\u003c');
  const statusJson = JSON.stringify(String(order.status || 'pending'));
  const createdAt = Number(order.created_at || 0);
  const initialCreatedAt = Number.isFinite(createdAt) && createdAt > 0 ? createdAt : 0;
  const displayDate = initialCreatedAt > 0 ? new Date(initialCreatedAt * 1000) : new Date();
  const safeDisplayDate = Number.isNaN(displayDate.getTime()) || displayDate.getTime() > Date.now() + 60000 ? new Date() : displayDate;
  const createdAtLabel = safeDisplayDate.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
  const displayOrderNo = isInternalDemoRecord ? '—' : String(order.out_trade_no || orderNo);
  const method = String(order.method || '');
  const methodLabel = method === 'alipay' || method === 'nzzf' ? '支付宝' : method === 'alipay_h5' ? '支付宝 H5' : method || '—';

  // Internal/demo rows must never turn a placeholder URL into a scannable payment code.
  const qrContent = isInternalDemoRecord ? '' : String(payInfo.qrcode_content || order.pay_url || '').trim();
  const safeQr = /^https:\/\//i.test(qrContent) ? qrContent : '';
  const status = String(order.status || 'pending').toLowerCase();
  const paid = status === 'paid';
  const terminalFailure = ['failed', 'cancelled', 'expired'].includes(status);
  const statusLabel = paid ? '支付成功' : status === 'expired' ? '订单已超时' : status === 'cancelled' ? '订单已关闭' : terminalFailure ? '支付未成功' : '等待支付';
  const content = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#f4f7fb"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><title>收银台 - 晴天支付</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:linear-gradient(145deg,#f3f7ff,#f8fbff 55%,#edf5ff);color:#17243b;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}.top{height:70px;background:rgba(255,255,255,.92);border-bottom:1px solid #e8eef6;display:flex;align-items:center;justify-content:space-between;padding:0 max(20px,calc((100vw - 1040px)/2))}.brand{display:flex;align-items:center;gap:10px;font-weight:750;font-size:19px;color:#142746}.brand-mark{width:34px;height:34px;border-radius:11px;background:linear-gradient(135deg,#2478ff,#12b8d6);display:grid;place-items:center;color:#fff;font-size:18px}.secure{font-size:12px;color:#718096}.secure i{display:inline-block;width:7px;height:7px;background:#18b77a;border-radius:50%;margin-right:7px}main{max-width:940px;margin:44px auto;padding:0 18px}.heading{text-align:center;margin-bottom:26px}.heading h1{font-size:25px;margin:0 0 8px}.heading p{margin:0;color:#78869a;font-size:13px}.layout{display:grid;grid-template-columns:1.1fr .9fr;gap:18px}.card{background:#fff;border:1px solid #e8eef6;border-radius:18px;box-shadow:0 14px 45px #29466c0d;padding:26px}.amount-label{font-size:13px;color:#8592a5}.amount{font-size:38px;font-weight:800;color:#142746;margin:8px 0 18px;overflow-wrap:anywhere}.status{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:99px;background:#fff7e8;color:#a96b0b;font-size:12px;font-weight:700}.status i{width:8px;height:8px;border-radius:50%;background:#efa92e;animation:pulse 1.25s ease-in-out infinite;transform-origin:center}.status.success{background:#e9fbf3;color:#13865b}.status.success i{background:#18a66d;animation:none}.status.failed{background:#fff0ef;color:#c4534b}.status.failed i{background:#d65b52;animation:none}@keyframes pulse{0%,100%{transform:scale(1);opacity:1;box-shadow:0 0 0 0 #efa92e55}50%{transform:scale(1.35);opacity:.65;box-shadow:0 0 0 6px #efa92e00}}.order-meta{border-top:1px solid #edf1f6;margin-top:17px;padding-top:16px;display:grid;gap:13px}.meta-row{display:flex;justify-content:space-between;gap:12px;font-size:13px}.meta-row span{color:#8491a3;flex:0 0 auto}.meta-row strong{text-align:right;overflow-wrap:anywhere;font-weight:600;color:#263851}.pay-title{font-size:17px;margin:0 0 7px}.pay-desc{font-size:12px;color:#8290a3;margin:0 0 18px}.qrbox{width:230px;height:230px;margin:0 auto 16px;border:1px solid #edf1f6;border-radius:13px;display:grid;place-items:center;padding:10px}.qrbox img{max-width:202px;max-height:202px}.scan{text-align:center;font-size:13px;color:#4c5c72}.scan b{color:#1f66d6}.poll{text-align:center;color:#8a97a8;font-size:11px;margin-top:17px}.unavailable{width:100%;min-height:190px;display:grid;place-items:center;text-align:center;padding:22px;color:#77869a;font-size:13px;line-height:1.8}.unavailable svg{margin-bottom:10px}.foot{text-align:center;color:#a0aaba;font-size:11px;margin:24px 0}@media(max-width:680px){.top{height:62px;padding:0 17px}main{margin:27px auto;padding:0 13px}.layout{grid-template-columns:1fr}.pay-card{order:-1}.card{padding:21px}.amount{font-size:32px}.qrbox{width:216px;height:216px}}
</style></head><body><header class="top"><div class="brand"><span class="brand-mark">晴</span><span>晴天支付</span></div><div class="secure"><i></i>安全加密连接</div></header><main><div class="heading"><h1>晴天支付收银台</h1><p>请核对订单信息</p></div><div class="layout"><section class="card"><div class="amount-label">订单应付金额</div><div class="amount" id="amount">${esc(amountLabel)}</div><span class="status ${paid ? 'success' : terminalFailure ? 'failed' : ''}" id="status"><i></i>${statusLabel}</span><div class="order-meta"><div class="meta-row"><span>商品名称</span><strong>${esc(subject)}</strong></div><div class="meta-row"><span>商户订单号</span><strong>${esc(displayOrderNo)}</strong></div><div class="meta-row"><span>支付方式</span><strong>${esc(methodLabel)}</strong></div><div class="meta-row"><span>创建时间</span><strong id="created-at">${esc(createdAtLabel)}</strong></div></div></section><section class="card pay-card"><h2 class="pay-title">${esc(methodLabel)}支付</h2><p class="pay-desc" id="pay-desc">${safeQr ? '请使用对应支付 App 扫描下方二维码' : '请核对订单状态与支付信息'}</p><div id="qr-area">${safeQr ? '<div class="qrbox" id="qrcode"></div><div class="scan">打开支付 App <b>扫一扫</b> 完成支付</div>' : '<div class="unavailable">当前订单暂未生成有效支付凭证。<br>请联系商户确认支付方式后再继续。</div>'}</div><div class="poll" id="poll-text">${paid ? '订单已完成' : '订单状态每 3 秒自动更新'}</div></section></div><div class="foot">晴天支付 · 让支付连接价值</div></main><script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script><script>
(function(){
  var orderNo=${orderJson}, status=${statusJson}, createdAt=${initialCreatedAt}, qr=${JSON.stringify(safeQr)};
  var createdNode=document.getElementById('created-at');
  var date=createdAt>0?new Date(createdAt*1000):new Date();
  if(Number.isNaN(date.getTime())||date.getTime()>Date.now()+60000)date=new Date();
  createdNode.textContent=date.toLocaleString('zh-CN',{hour12:false});
  if(qr&&window.QRCode){new QRCode(document.getElementById('qrcode'),{text:qr,width:202,height:202,colorDark:'#14243b',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});}
  else if(qr){document.getElementById('qr-area').innerHTML='<div class="unavailable">二维码暂时无法加载，请稍后刷新页面。</div>';}
  function showFailure(label){\n    var s=document.getElementById('status');s.className='status failed';s.innerHTML='<i></i>'+label;\n    document.getElementById('poll-text').textContent='如对订单状态有疑问，请联系商户核实。';\n    document.getElementById('pay-desc').textContent='本次支付未完成，请勿重复付款。';\n    clearInterval(timer);\n  }\n  function showPaid(){
    var s=document.getElementById('status');s.className='status success';s.innerHTML='<i></i>支付成功';
    document.getElementById('poll-text').textContent='支付已确认，正在跳转订单完成页…';
    document.getElementById('pay-desc').textContent='支付成功，感谢使用晴天支付';
    document.getElementById('qr-area').innerHTML='<div class="unavailable" style="color:#13865b;font-weight:650">✓<br>支付成功</div>';
    clearInterval(timer);setTimeout(function(){location.assign('/checkout/success?order_no='+encodeURIComponent(orderNo));},1200);
  }
  async function poll(){
    try{
      var response=await fetch('/api/checkout/'+encodeURIComponent(orderNo),{cache:'no-store',headers:{Accept:'application/json'}});
      if(!response.ok)return;
      var result=await response.json();
      if(result.code==='SUCCESS'&&result.data){if(result.data.status==='paid'){showPaid();}else if(['failed','cancelled','expired'].includes(result.data.status)){showFailure(result.data.status==='expired'?'订单已超时':result.data.status==='cancelled'?'订单已关闭':'支付未成功');}}
    }catch(_){}
  }
  var timer=null;
  if(status==='paid')showPaid();else if(terminalFailure)showFailure(status==='expired'?'订单已超时':status==='cancelled'?'订单已关闭':'支付未成功');else timer=setInterval(poll,3000);
})();
</script></body></html>`;
  return html(content);
}
