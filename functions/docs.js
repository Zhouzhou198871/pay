const page = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#ffffff"><meta name="description" content="晴天支付开放平台 API 文档：商户接入、V1 MD5、V2 RSA2、统一下单、通知验签与错误码。">
<title>开发者文档 · 晴天支付</title>
<link rel="preconnect" href="https://cdnjs.cloudflare.com">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
<style>
:root{color-scheme:light;--ink:#172b4d;--muted:#66758b;--line:#e8edf4;--blue:#246bdb;--blue-soft:#eff6ff;--surface:#fff;--code:#f6f8fb}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:96px}body{margin:0;background:#fff;color:var(--ink);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;font-size:14px;line-height:1.75;-webkit-font-smoothing:antialiased}
a{color:var(--blue);text-decoration:none}a:hover{text-decoration:underline}.topbar{height:68px;position:fixed;z-index:30;inset:0 0 auto;background:rgba(255,255,255,.94);backdrop-filter:blur(16px);border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 34px}.brand{display:flex;align-items:center;gap:11px;color:#122644;font-size:17px;font-weight:760;letter-spacing:-.3px}.brand-mark{width:34px;height:34px;border-radius:11px;background:linear-gradient(135deg,#2478ff,#14b8cf);display:grid;place-items:center;color:#fff;font-weight:800}.toplinks{display:flex;align-items:center;gap:24px;color:#607089;font-size:13px}.toplinks a{color:inherit}.toplinks .primary{background:#1769d2;color:#fff;padding:8px 14px;border-radius:9px;font-weight:650}
.sidebar{position:fixed;top:68px;bottom:0;left:0;width:276px;border-right:1px solid var(--line);background:#fff;padding:27px 20px 36px 30px;overflow:auto}.side-caption{font-size:10px;font-weight:750;letter-spacing:1.25px;color:#9aa7b8;margin:0 0 12px 10px}.side-link{display:flex;align-items:center;min-height:35px;padding:6px 10px;border-radius:7px;color:#617087;font-size:13px;margin:2px 0}.side-link:hover,.side-link.active{background:#eff6ff;color:#145bc1;text-decoration:none}.side-sub{padding-left:15px;border-left:1px solid #edf1f6;margin:3px 0 15px 16px}.side-sub .side-link{font-size:12px;min-height:30px}.sidebar-foot{border-top:1px solid var(--line);margin-top:28px;padding:17px 10px;color:#96a2b2;font-size:11px}
main{margin-left:276px;padding:110px 7vw 100px;max-width:1500px}.content{max-width:900px}.eyebrow{font-size:11px;font-weight:750;letter-spacing:1.5px;color:#2471d8;text-transform:uppercase}.hero h1{font-size:42px;letter-spacing:-1.6px;line-height:1.18;margin:12px 0 16px;color:#142744}.hero p{font-size:16px;color:#65758d;max-width:700px;margin:0}.hero-meta{display:flex;gap:18px;flex-wrap:wrap;margin-top:24px;color:#8a98aa;font-size:12px}.hero-meta span{display:flex;align-items:center;gap:7px}.dot{width:6px;height:6px;border-radius:50%;background:#16a36a}.callout{margin:28px 0 42px;padding:16px 18px;border:1px solid #dceafe;background:#f7faff;border-radius:12px;color:#526985;font-size:13px}.callout strong{color:#244c83}.callout.warn{border-color:#f2e4bd;background:#fffaf0;color:#7d6537}.callout.warn strong{color:#8c5c10}
section{padding-top:18px;margin-top:52px;scroll-margin-top:92px}section:first-of-type{margin-top:38px}h2{font-size:27px;letter-spacing:-.7px;line-height:1.3;margin:0 0 12px;color:#172b4d}h3{font-size:18px;letter-spacing:-.25px;margin:31px 0 10px;color:#1d3557}h4{font-size:14px;margin:22px 0 8px;color:#29415f}p{margin:10px 0;color:#52637a}ul,ol{padding-left:22px;color:#52637a}li{padding:3px 0}.lead{font-size:15px;color:#65758d;margin:0 0 22px}.section-kicker{font-size:11px;font-weight:700;color:#8b99aa;letter-spacing:1px;margin-bottom:7px}.rule{height:1px;background:var(--line);margin:30px 0}
table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid var(--line);border-radius:11px;overflow:hidden;margin:17px 0 24px;font-size:12.5px}th{background:#f8fafc;color:#64748b;font-size:11px;font-weight:750;text-align:left;letter-spacing:.2px}th,td{padding:11px 13px;border-bottom:1px solid var(--line);vertical-align:top}td{color:#465a73}tr:last-child td{border-bottom:0}td code{font-size:11px}code:not(pre code){background:#f1f5f9;padding:2px 5px;border-radius:4px;color:#294c78;font-size:.91em}
pre{position:relative;margin:16px 0 23px;padding:19px 20px;overflow:auto;background:var(--code);border:1px solid #e8edf3;border-radius:12px;font-size:12px;line-height:1.7;tab-size:2}pre code{font-family:"SFMono-Regular",Consolas,"Liberation Mono",monospace!important;background:transparent!important;padding:0!important;color:#26364b}.copy{position:absolute;right:10px;top:10px;border:1px solid #dce3ec;background:#fff;border-radius:7px;padding:5px 9px;color:#66758b;font-size:11px;cursor:pointer}.copy:hover{border-color:#9bb8e7;color:#145bc1}.copy.done{color:#13865b;border-color:#a7e4c6}
.endpoint{display:flex;align-items:center;gap:10px;margin:18px 0 14px}.method{font-size:10px;font-weight:800;letter-spacing:.5px;color:#0b7a50;background:#e8f8f0;padding:5px 8px;border-radius:5px}.path{font-family:ui-monospace,Consolas,monospace;font-size:13px;font-weight:650;color:#263e5f}
.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:18px 0}.mini{border:1px solid var(--line);border-radius:12px;padding:16px}.mini strong{display:block;font-size:13px;color:#243b5b;margin-bottom:5px}.mini p{font-size:12px;margin:0;color:#738198}
.pill{display:inline-block;font-size:10px;font-weight:750;padding:3px 7px;border-radius:5px;background:#edf4ff;color:#2464b8}.pill.gray{background:#f1f3f6;color:#778397}.pill.amber{background:#fff5df;color:#9a6b17}
footer{margin-top:80px;padding-top:24px;border-top:1px solid var(--line);font-size:12px;color:#98a4b4}
@media(max-width:980px){.sidebar{width:230px;padding-left:20px}.topbar{padding:0 20px}main{margin-left:230px;padding:100px 35px 70px}.hero h1{font-size:36px}}
@media(max-width:720px){.topbar{height:60px;padding:0 15px}.toplinks a:not(.primary){display:none}.sidebar{position:sticky;top:60px;width:auto;height:auto;bottom:auto;border-right:0;border-bottom:1px solid var(--line);padding:8px 12px;display:flex;gap:5px;overflow:auto;white-space:nowrap}.side-caption,.side-sub,.sidebar-foot{display:none}.side-link{flex:0 0 auto;min-height:32px;font-size:11px;padding:5px 9px}.sidebar .side-link{margin:0}main{margin:0;padding:38px 18px 60px}.hero h1{font-size:32px}.hero p{font-size:14px}h2{font-size:23px}.grid2{grid-template-columns:1fr}table{display:block;overflow-x:auto;white-space:normal}pre{font-size:11px;padding:17px 14px}.copy{position:sticky;float:right;margin-bottom:-30px;z-index:2}}

/* SDK download and integration guide */
.sdk-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:22px 0 20px}
.sdk-card{min-width:0;padding:18px;border:1px solid #e7edf5;border-radius:15px;background:linear-gradient(180deg,#fff,#fbfdff);box-shadow:0 8px 22px rgba(32,68,112,.045)}
.sdk-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px}
.sdk-language{font-size:16px;font-weight:800;color:#1e385c}
.sdk-version{padding:5px 8px;border-radius:7px;font-size:10px;font-weight:800;white-space:nowrap}
.sdk-version.v1{background:#f0ebff;color:#7b62bb}.sdk-version.v2{background:#e8f3ff;color:#2672c8}
.sdk-card p{margin:0 0 13px;color:#8795a8;font-size:11px}
.sdk-card a{display:flex;align-items:center;justify-content:space-between;padding:9px 10px;margin:6px 0;border:1px solid #e7edf5;border-radius:9px;background:#fff;color:#2b70c7;font-size:11px;font-weight:700}
.sdk-card a:hover{background:#f2f7ff;text-decoration:none;border-color:#d4e5fa}
.step-card{display:grid;grid-template-columns:38px minmax(0,1fr);gap:14px;margin:13px 0;padding:18px;border:1px solid #e8eef5;border-radius:14px;background:#fff;box-shadow:0 5px 16px rgba(33,65,102,.035)}
.step-card>span{width:34px;height:34px;display:grid;place-items:center;border-radius:11px;background:#eaf3ff;color:#2c73c8;font-size:12px;font-weight:850}
.step-card h3{margin:2px 0 7px;font-size:15px;color:#213c60}
.step-card p{font-size:12px;line-height:1.85}
.step-card .step-note{padding:9px 11px;border-radius:8px;background:#fff8ed;color:#a4773d}
.step-card pre{margin-top:12px}
@media(max-width:760px){.sdk-grid{grid-template-columns:1fr}.sdk-card{padding:15px}.step-card{padding:14px;gap:10px}.step-card>span{width:30px;height:30px}}
</style>
</head>
<body>
<header class="topbar"><a class="brand" href="/" aria-label="晴天支付首页"><span class="brand-mark">晴</span><span>晴天支付 <span style="font-weight:450;color:#8b99aa">开发者中心</span></span></a><nav class="toplinks"><a href="#quickstart">快速接入</a><a href="#signature">签名规范</a><a href="/dashboard">商户工作台</a><a class="primary" href="/dashboard">进入控制台 ↗</a></nav></header>
<aside class="sidebar" aria-label="文档目录">
<div class="side-caption">GET STARTED</div>
<a class="side-link active" href="#overview">文档概览</a><a class="side-link" href="#quickstart">接入指引</a>
<div class="side-caption">API REFERENCE</div>
<a class="side-link" href="#signature">签名规范</a><div class="side-sub"><a class="side-link" href="#v1-sign">V1 · MD5</a><a class="side-link" href="#v2-sign">V2 · RSA2</a></div>
<a class="side-link" href="#create-order">统一下单 API</a><div class="side-sub"><a class="side-link" href="#v1-order">V1 下单</a><a class="side-link" href="#v2-order">V2 下单</a><a class="side-link" href="#response">响应结构</a></div>
<a class="side-link" href="#notify">异步通知与回调</a>
<a class="side-link" href="#errors">错误码</a>
<div class="side-caption">REFERENCE</div><a class="side-link" href="#security">安全与上线检查</a>
<div class="sidebar-foot">晴天支付开放平台<br>API 文档 · 版本 1.0</div>
</aside>
<main><div class="content">
<div class="hero" id="overview"><div class="eyebrow">DEVELOPER DOCUMENTATION</div><h1>把支付接入，变得简单。</h1><p>通过清晰、稳定的 API，将晴天支付接入您的业务。本文覆盖商户凭据、V1 MD5 与 V2 RSA2 签名、统一下单、上游支付通知及错误处理。</p><div class="hero-meta"><span><i class="dot"></i> HTTPS only</span><span>API Base URL：pay.lynli.me</span><span>文档版本 1.0</span></div></div>
<div class="callout warn"><strong>当前能力边界：</strong> V1/V2 下单接口已实现商户验签、时间戳校验、订单持久化与幂等检查。商户传入的 <code>notify_url</code> 当前仅随订单保存，平台尚未向商户主动投递支付结果通知；请勿将其视为已上线的 Webhook。支付宝及 NZZF 上游通知接收路由已实现，详见「异步通知与回调」。</div>

<section id="sdk-download"><div class="section-kicker">SDK · DOWNLOAD CENTER</div><h2>SDK 下载</h2><p class="lead">官方示例 SDK 覆盖 PHP、Node.js 与 Java；按接口版本选择压缩包。下载后请先阅读包内 README，并在服务端配置密钥。</p>
<div class="sdk-grid">
  <article class="sdk-card"><div class="sdk-card-head"><span class="sdk-language">PHP</span><span class="sdk-version v1">V1 · MD5</span></div><p>PHP 8.1+ · cURL / OpenSSL</p><a href="https://github.com/Zhouzhou198871/pay/releases/download/qingtian-merchant-sdk-v1.0.0/qingtian-php-v1-md5.zip">下载 PHP V1 ZIP ↗</a><div class="sdk-card-head"><span class="sdk-version v2">V2 · RSA</span></div><a href="https://github.com/Zhouzhou198871/pay/releases/download/qingtian-merchant-sdk-v1.0.0/qingtian-php-v2-rsa.zip">下载 PHP V2 ZIP ↗</a></article>
  <article class="sdk-card"><div class="sdk-card-head"><span class="sdk-language">Node.js</span><span class="sdk-version v1">V1 · MD5</span></div><p>Node.js 18+ · 原生 crypto</p><a href="https://github.com/Zhouzhou198871/pay/releases/download/qingtian-merchant-sdk-v1.0.0/qingtian-node-v1-md5.zip">下载 Node.js V1 ZIP ↗</a><div class="sdk-card-head"><span class="sdk-version v2">V2 · RSA</span></div><a href="https://github.com/Zhouzhou198871/pay/releases/download/qingtian-merchant-sdk-v1.0.0/qingtian-node-v2-rsa.zip">下载 Node.js V2 ZIP ↗</a></article>
  <article class="sdk-card"><div class="sdk-card-head"><span class="sdk-language">Java</span><span class="sdk-version v1">V1 · MD5</span></div><p>JDK 17+ · 标准库</p><a href="https://github.com/Zhouzhou198871/pay/releases/download/qingtian-merchant-sdk-v1.0.0/qingtian-java-v1-md5.zip">下载 Java V1 ZIP ↗</a><div class="sdk-card-head"><span class="sdk-version v2">V2 · RSA</span></div><a href="https://github.com/Zhouzhou198871/pay/releases/download/qingtian-merchant-sdk-v1.0.0/qingtian-java-v2-rsa.zip">下载 Java V2 ZIP ↗</a></article>
</div>
<div class="callout"><strong>安全提示：</strong> V1 API Key、V2 RSA 私钥只能保存在您自己的服务端环境变量或密钥管理系统。切勿写入网页、App、公开仓库或日志。SDK ZIP 发布后可通过同版本 Release 页面校验 SHA-256。</div>
</section>
<section id="integration-steps"><div class="section-kicker">02 · INTEGRATION WORKFLOW</div><h2>三步完成接入</h2><p class="lead">以下示例使用商户服务端调用；金额以 USDT 十进制字符串传递，所有订单号由商户系统保证唯一。</p>
<div class="step-card"><span>01</span><div><h3>第一步：生成密钥</h3><p>登录商户工作台，打开「个人资料 → API 信息」。确认商户号和 V1 MD5 API Key；如使用 V2，在 V2 接口区域生成 RSA-2048 密钥对，并将 PKCS#8 私钥安全保存。平台仅使用您登记的公钥验证 V2 请求。</p><p class="step-note">不要把任何私钥或 API Key 发给前端，也不要将其提交到 Git 仓库。</p></div></div>
<div class="step-card"><span>02</span><div><h3>第二步：拼装参数</h3><p>准备 <code>merchant_no</code>、<code>out_trade_no</code>、<code>amount</code>、<code>pay_type</code>、<code>notify_url</code>、<code>timestamp</code>。商户 SDK 会自动填充商户号和秒级时间戳并生成签名；<code>notify_url</code> 必须是 HTTPS 公网地址。</p><pre><code class="language-json">{
  "out_trade_no": "ORDER202611040001",
  "amount": "12.50",
  "pay_type": "alipay",
  "notify_url": "https://merchant.example.com/payment/notify"
}</code></pre></div></div>
<div class="step-card"><span>03</span><div><h3>第三步：发送请求</h3><p>调用 SDK 的 V1 或 V2 下单方法，请求会发送到对应版本接口。只有 HTTP 201 且响应 <code>code</code> 为 <code>SUCCESS</code> 才表示订单创建成功；订单创建不等同于用户已付款。请勿将当前尚未开放的商户异步通知当作已交付能力。</p><pre><code class="language-js">import { QingtianPayClient } from './index.js';

const client = new QingtianPayClient({
  merchantNo: process.env.QT_MERCHANT_NO,
  v1Key: process.env.QT_V1_KEY,
  v2PrivateKey: process.env.QT_V2_PRIVATE_KEY
});

const result = await client.createOrderV1({
  out_trade_no: 'ORDER202611040001',
  amount: '12.50',
  pay_type: 'alipay',
  notify_url: 'https://merchant.example.com/payment/notify'
});
console.log(result.data.trade_no);</code></pre></div></div>
</section>
<section id="quickstart"><div class="section-kicker">01 · GET STARTED</div><h2>接入指引</h2><p class="lead">完成商户身份初始化、保存密钥，并在服务端发起签名请求，即可接入下单接口。</p>
<h3>获取商户号与 V1 MD5 密钥</h3><ol><li>登录晴天支付，进入「商户工作台 → 个人资料 → API 信息」。</li><li>首次读取商户资料时，平台会为当前账户初始化商户记录，并分配六位 <code>merchant_no</code> 与 40 位十六进制 <code>api_key</code>。</li><li>商户号用于标识商户；V1 MD5 密钥用于请求签名。请只在您自己的后端服务保存密钥。</li><li>如需轮换 V1 密钥，在商户资料接口执行 <code>rotate_api_key</code>；旧密钥立即失效。</li></ol>
<div class="endpoint"><span class="method">GET</span><span class="path">/api/merchant/profile</span></div>
<pre><code class="language-bash">curl -sS https://pay.lynli.me/api/merchant/profile \
  -H "Cookie: __Host-qt_session=YOUR_SESSION"</code></pre>
<p>该资料接口使用登录态 Session Cookie，不是公开的商户凭据查询 API。读取结果包含 <code>merchant.merchant_no</code>、<code>merchant.api_key</code> 与 V2 公钥状态；不要将响应写入公开日志。</p>
<h3>生成 V2 RSA 密钥对</h3><p>在「个人资料 → API 信息 → V2 接口」生成 RSA-2048 密钥对。私钥采用 PKCS#8 PEM，公钥采用 SPKI PEM。平台仅保存 AES-GCM 加密后的私钥副本及公钥；生成/重置响应中的私钥仅展示一次。</p>
<div class="endpoint"><span class="method">PATCH</span><span class="path">/api/merchant/profile</span></div>
<pre><code class="language-json">{
  "action": "generate_v2_keys"
}</code></pre>
<p>重置时将 action 改为 <code>reset_v2_keys</code>。旧私钥会立即失效，必须同步更新调用方配置。严禁把私钥放入浏览器、移动端、前端仓库或日志。</p>
<div class="grid2"><div class="mini"><strong>V1 · MD5</strong><p>商户号 + 40 位随机十六进制 API 密钥。适合兼容既有接入系统。</p></div><div class="mini"><strong>V2 · RSA2</strong><p>商户持有私钥签名，平台使用商户公钥验签。推荐新接入使用。</p></div></div>
</section>

<section id="signature"><div class="section-kicker">02 · SIGNATURE</div><h2>签名规范</h2><p class="lead">签名必须在商户可信服务端生成。参与签名的参数值必须与实际提交的 JSON 值完全一致。</p>
<div id="v1-sign"><h3>V1 · MD5 拼接签名</h3><ol><li>取请求参数，排除 <code>sign</code>；过滤 null、undefined 与空字符串。</li><li>按参数名升序排列，生成 <code>key=value</code> 项。</li><li>使用 <code>&amp;</code> 拼接，并在末尾追加 <code>key=商户MD5密钥</code>。</li><li>对完整 UTF-8 字符串计算 MD5，输出 32 位小写十六进制。</li></ol>
<pre><code class="language-text">amount=12.50&amp;merchant_no=123456&amp;notify_url=https://merchant.example.org/pay/notify&amp;out_trade_no=ORDER202611040001&amp;pay_type=alipay&amp;timestamp=当前Unix秒级时间戳&amp;key=YOUR_V1_API_KEY</code></pre>
<pre><code class="language-javascript">import { createHash } from 'node:crypto';

function signV1(params, apiKey) {
  const canonical = Object.entries(params)
    .filter(([key, value]) =>
      key !== 'sign' &amp;&amp; value !== undefined &amp;&amp;
      value !== null &amp;&amp; String(value) !== ''
    )
    .sort(([a], [b]) => a &lt; b ? -1 : a &gt; b ? 1 : 0)
    .map(([key, value]) => key + '=' + String(value))
    .concat('key=' + apiKey)
    .join('&amp;');

  return createHash('md5').update(canonical, 'utf8').digest('hex');
}

const params = {
  merchant_no: '123456',
  out_trade_no: 'ORDER202611040001',
  amount: '12.50',
  pay_type: 'alipay',
  notify_url: 'https://merchant.example.org/pay/notify',
  timestamp: String(Math.floor(Date.now() / 1000))
};
params.sign = signV1(params, process.env.QT_V1_API_KEY);</code></pre>
<h4>MD5 离线校验向量</h4><p>以下固定输入仅用于本地核对 MD5 实现，示例密钥不是有效商户密钥，也不要用于真实请求。</p>
<pre><code class="language-text">canonical = amount=12.50&amp;merchant_no=123456&amp;notify_url=https://merchant.example.org/pay/notify&amp;out_trade_no=ORDER202611040001&amp;pay_type=alipay&amp;timestamp=1793750000&amp;key=0123456789abcdef0123456789abcdef01234567
sign = 2ea8458537a2632feb51a2ec52819794</code></pre>
<p><span class="pill">重要</span> 金额请作为字符串传递（例如 <code>"12.50"</code>），不要先转成二进制浮点数再格式化。当前 V1 代码的参数排序基于字段名比较，字段名均为 ASCII。</p></div>
<div class="rule"></div>
<div id="v2-sign"><h3>V2 · RSA2-SHA256 签名</h3><ol><li>取所有请求参数，排除 <code>sign</code>；其他标量参数均参与签名，包括空字符串。</li><li>按参数名 ASCII 字典序排序。</li><li>按 <code>key=value</code> 拼接，参数之间使用 <code>&amp;</code>；不做 URL 编码，不插入空格。</li><li>使用商户 PKCS#8 私钥执行 RSASSA-PKCS1-v1_5 + SHA-256。</li><li>将签名原始字节使用标准 Base64 编码，填入 <code>sign</code>。</li></ol>
<pre><code class="language-text">amount=12.50&amp;merchant_no=123456&amp;notify_url=https://merchant.example.org/pay/notify&amp;out_trade_no=ORDER202611040001&amp;pay_type=alipay&amp;timestamp=1793750000</code></pre>
<pre><code class="language-javascript">import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const privateKey = readFileSync('./merchant-private.pem', 'utf8');
const params = {
  merchant_no: '123456',
  out_trade_no: 'ORDER202611040001',
  amount: '12.50',
  pay_type: 'alipay',
  notify_url: 'https://merchant.example.org/pay/notify',
  timestamp: String(Math.floor(Date.now() / 1000))
};
const canonical = Object.keys(params).sort()
  .map(key =&gt; key + '=' + String(params[key])).join('&amp;');
const signer = createSign('RSA-SHA256');
signer.update(canonical, 'utf8');
signer.end();
params.sign = signer.sign(privateKey, 'base64');

// POST JSON to https://pay.lynli.me/api/v2/payments</code></pre>
<p>服务端拒绝数组、对象等非标量参数。V1 与 V2 时间戳均为 10 位 Unix 秒，允许与服务器当前时间相差最多 300 秒。</p></div>
</section>

<section id="create-order"><div class="section-kicker">03 · API REFERENCE</div><h2>统一下单 API</h2><p class="lead">V1 与 V2 使用相同的业务字段和订单约束，仅签名算法不同。金额单位为 USDT，最多 6 位小数。</p>
<div id="v1-order"><h3>V1 · MD5 下单</h3><div class="endpoint"><span class="method">POST</span><span class="path">/api/v1/payments</span></div>
<pre><code class="language-bash">curl -X POST 'https://pay.lynli.me/api/v1/payments' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d '{
    "merchant_no": "123456",
    "out_trade_no": "ORDER202611040001",
    "amount": "12.50",
    "pay_type": "alipay",
    "notify_url": "https://merchant.example.org/pay/notify",
    "timestamp": "1793750000",
    "sign": "32位小写MD5签名"
  }'</code></pre></div>
<div id="v2-order"><h3>V2 · RSA2 下单</h3><div class="endpoint"><span class="method">POST</span><span class="path">/api/v2/payments</span></div>
<p>请求头：<code>Content-Type: application/json</code>。请求体字段与 V1 相同，<code>sign</code> 为标准 Base64 RSA2 签名。</p>
</div>
<h3>请求参数</h3><table><thead><tr><th>字段名</th><th>类型</th><th>必填</th><th>说明 / 校验规则</th></tr></thead><tbody>
<tr><td><code>merchant_no</code></td><td>string</td><td>是</td><td>六位商户号；对应当前商户 API 信息。</td></tr>
<tr><td><code>out_trade_no</code></td><td>string</td><td>是</td><td>商户订单号，1–64 位；仅允许字母、数字、<code>_ . : -</code>；同一商户不可重复。</td></tr>
<tr><td><code>amount</code></td><td>string / number</td><td>是</td><td>USDT 金额，大于 0，最多 6 位小数，最大 1,000,000 USDT。建议传字符串。</td></tr>
<tr><td><code>pay_type</code></td><td>string</td><td>是</td><td><code>alipay</code>（PC）或 <code>alipay_h5</code>（H5）。</td></tr>
<tr><td><code>notify_url</code></td><td>string</td><td>是</td><td>HTTPS 公网地址；当前随订单保存，商户异步通知主动投递尚未开放。</td></tr>
<tr><td><code>timestamp</code></td><td>string</td><td>是</td><td>10 位 Unix 秒级时间戳；与平台时间差不得超过 300 秒。</td></tr>
<tr><td><code>sign</code></td><td>string</td><td>是</td><td>V1 为 32 位小写 MD5；V2 为 RSA2-SHA256 标准 Base64。</td></tr>
</tbody></table>
<h3 id="response">成功响应</h3><p>订单创建成功返回 HTTP <code>201</code>。内部订单状态为 <code>pending</code>，对外状态为 <code>unpaid</code>。<code>checkout_url</code> 为当前通道生成的支付入口。</p>
<pre><code class="language-json">{
  "code": "SUCCESS",
  "message": "订单创建成功。",
  "data": {
    "order_id": "平台内部订单ID",
    "trade_no": "QT平台支付流水号",
    "merchant_no": "123456",
    "out_trade_no": "ORDER202611040001",
    "amount": "12.5",
    "currency": "USDT",
    "pay_type": "alipay",
    "status": "unpaid",
    "created_at": 1793750000,
    "expires_at": 1793750900,
    "checkout_url": "https://openapi.alipay.com/gateway.do?...",
    "payment_amount_cny": "87.50",
    "payment_currency": "CNY"
  }
}</code></pre>
<p><code>created_at</code> 与 <code>expires_at</code> 为 Unix 秒级时间戳。支付通道配置缺失或不可用时，接口返回对应错误，不会创建没有有效支付入口的订单。</p>
</section>

<section id="notify"><div class="section-kicker">04 · NOTIFICATIONS</div><h2>异步通知与回调</h2><p class="lead">必须区分「上游支付平台通知晴天支付」与「晴天支付通知商户」两个方向，二者的接收方、签名密钥与响应契约不同。</p>
<div class="callout warn"><strong>商户回调状态：</strong> 下单请求中的 <code>notify_url</code> 已校验为 HTTPS 并保存，但当前代码没有向该地址发起 GET/POST 请求的投递器。因此，商户目前不会收到晴天支付主动推送的订单结果。以下列出的 GET/POST 参数，是平台当前已实现的上游通知接收字段，不是商户通知请求参数。</div>
<h3>上游 NZZF 通知（GET）</h3><div class="endpoint"><span class="method" style="background:#eef2ff;color:#4c55ad">GET</span><span class="path">/api/v1/payments/nzzf/notify</span></div>
<table><thead><tr><th>参数</th><th>类型</th><th>校验 / 用途</th></tr></thead><tbody>
<tr><td><code>pid</code></td><td>string</td><td>必须与服务端配置的 NZZF 商户 PID 一致。</td></tr>
<tr><td><code>sign_type</code></td><td>string</td><td>必须为 <code>RSA</code>。</td></tr>
<tr><td><code>timestamp</code></td><td>string</td><td>10 位 Unix 秒，时间差不超过 300 秒。</td></tr>
<tr><td><code>type</code></td><td>string</td><td>当前必须为 <code>alipay</code>。</td></tr>
<tr><td><code>trade_status</code></td><td>string</td><td>只有 <code>TRADE_SUCCESS</code> 进入支付入账；其他有效状态返回确认。</td></tr>
<tr><td><code>out_trade_no</code></td><td>string</td><td>晴天支付平台订单流水号（下单响应的 <code>trade_no</code>）。</td></tr>
<tr><td><code>trade_no</code></td><td>string</td><td>上游支付平台交易号。</td></tr>
<tr><td><code>money</code></td><td>string</td><td>上游实际支付人民币金额，必须与本地订单折算金额精确到分一致。</td></tr>
<tr><td><code>sign</code></td><td>string</td><td>Base64 RSA 签名；参与验签的其他非空标量字段按键名排序。</td></tr>
</tbody></table>
<h3>支付宝异步通知（POST）</h3><div class="endpoint"><span class="method" style="background:#eef2ff;color:#4c55ad">POST</span><span class="path">/api/v1/payments/alipay/notify</span></div>
<p>Content-Type 必须为 <code>application/x-www-form-urlencoded</code>。当前处理器读取并校验以下业务字段：</p>
<table><thead><tr><th>参数</th><th>类型</th><th>校验 / 用途</th></tr></thead><tbody>
<tr><td><code>app_id</code></td><td>string</td><td>必须与 <code>ALIPAY_APP_ID</code> 一致。</td></tr>
<tr><td><code>seller_id</code></td><td>string</td><td>必须与 <code>ALIPAY_SELLER_ID</code> 一致。</td></tr>
<tr><td><code>out_trade_no</code></td><td>string</td><td>晴天支付平台流水号（下单响应的 <code>trade_no</code>）。</td></tr>
<tr><td><code>trade_no</code></td><td>string</td><td>支付宝交易号，长度至少 8 位。</td></tr>
<tr><td><code>total_amount</code></td><td>string</td><td>支付宝实际支付金额，精确到分，与本地订单金额一致。</td></tr>
<tr><td><code>trade_status</code></td><td>string</td><td><code>TRADE_SUCCESS</code> 或 <code>TRADE_FINISHED</code> 才会触发入账。</td></tr>
<tr><td><code>sign_type</code></td><td>string</td><td>必须为 <code>RSA2</code>。</td></tr>
<tr><td><code>sign</code></td><td>string</td><td>支付宝签名；使用支付宝公钥验签。</td></tr>
</tbody></table>
<p>支付宝回调签名串：排除 <code>sign</code>、<code>sign_type</code> 与空值，其余表单解码后的参数按键名 ASCII 升序，以 <code>key=value&amp;...</code> 拼接；使用支付宝公钥执行 RSA2 / SHA-256 验签。处理前还会核对 App ID、Seller ID、平台订单、金额和交易号。额外的非空标量参数同样参与签名串。</p>
<h3>响应要求与幂等</h3><ul><li>平台接收上游通知后，验签与订单核对通过，且状态处理成功（包括已处理的重复通知或有效非成功状态）时，响应 HTTP 200、纯文本 <code>success</code>。</li><li>验签失败、金额不符、订单不存在或处理异常时，响应纯文本 <code>failure</code>。</li><li>重复通知不会重复生成账本流水；仅首次从 <code>pending</code> 迁移到 <code>paid</code> 时执行入账。</li><li>商户侧若自行实现通知接收端，应在完成验签、金额和订单核对并可靠落库后返回纯文本 <code>success</code>；但晴天支付当前尚未向商户投递通知，不能依赖此行为作为生产回调链路。</li></ul>
</section>

<section id="errors"><div class="section-kicker">05 · ERROR REFERENCE</div><h2>错误码列表</h2><p class="lead">HTTP 状态码表示传输层结果；JSON <code>code</code> 表示下单业务错误。通道相关错误仅在对应通道配置或上游调用路径触发时出现。</p>
<table><thead><tr><th>HTTP</th><th>业务错误码</th><th>含义 / 处理建议</th></tr></thead><tbody>
<tr><td>400</td><td><code>INVALID_JSON</code></td><td>请求体不是合法 JSON；检查编码与 JSON 语法。</td></tr>
<tr><td>400</td><td><code>MISSING_PARAMETER</code></td><td>缺少必填参数；确认 timestamp、sign 等字段均存在。</td></tr>
<tr><td>400</td><td><code>TIMESTAMP_EXPIRED</code></td><td>时间戳无效或与平台时间相差超过 300 秒；同步服务器时钟后重新签名。</td></tr>
<tr><td>400</td><td><code>INVALID_MERCHANT</code></td><td>商户号格式错误；必须为六位数字。</td></tr>
<tr><td>400</td><td><code>INVALID_OUT_TRADE_NO</code></td><td>商户订单号格式不符合规则。</td></tr>
<tr><td>400</td><td><code>INVALID_AMOUNT</code></td><td>金额不合法；必须大于 0，最多 6 位小数。</td></tr>
<tr><td>400</td><td><code>UNSUPPORTED_PAY_TYPE</code></td><td>支付类型不支持；仅 alipay / alipay_h5。</td></tr>
<tr><td>400</td><td><code>INVALID_NOTIFY_URL</code></td><td>通知地址不是有效 HTTPS 公网 URL。</td></tr>
<tr><td>401</td><td><code>MERCHANT_NOT_FOUND</code></td><td>商户不存在或对应版本密钥未配置。</td></tr>
<tr><td>401</td><td><code>SIGNATURE_INVALID</code></td><td>MD5 / RSA2 验签失败；检查字段值、排序、密钥与编码。</td></tr>
<tr><td>409</td><td><code>ORDER_EXISTS</code></td><td>同一商户订单号已存在；查询原订单，不要重复创建。</td></tr>
<tr><td>415</td><td><code>INVALID_CONTENT_TYPE</code></td><td>请求 Content-Type 必须为 application/json。</td></tr>
<tr><td>503</td><td><code>SERVICE_UNAVAILABLE</code></td><td>支付服务未绑定数据库或暂不可用。</td></tr>
<tr><td>503</td><td><code>ALIPAY_DISABLED</code></td><td>支付宝通道未启用。</td></tr>
<tr><td>503</td><td><code>ALIPAY_CONFIG_MISSING</code></td><td>缺少支付宝必需配置；响应附带 missing 字段。</td></tr>
<tr><td>503</td><td><code>ALIPAY_CONFIG_INVALID</code></td><td>支付宝应用 ID、通知地址或汇率配置格式错误。</td></tr>
<tr><td>503</td><td><code>ALIPAY_GATEWAY_INVALID</code></td><td>支付宝网关不在允许的官方域名范围。</td></tr>
<tr><td>503</td><td><code>ALIPAY_SIGNING_FAILED</code></td><td>支付宝请求签名失败；检查 PKCS#8 私钥。</td></tr>
<tr><td>503</td><td><code>NZZF_RATE_MISSING</code></td><td>NZZF 汇率未配置。</td></tr>
<tr><td>503</td><td><code>NZZF_AMOUNT_INVALID</code></td><td>折算后的人民币金额低于最小支付金额。</td></tr>
<tr><td>503</td><td><code>NZZF_CREATE_FAILED</code></td><td>上游未成功创建订单。</td></tr>
<tr><td>503</td><td><code>NZZF_QR_INVALID</code></td><td>上游未返回符合要求的 HTTPS 支付地址。</td></tr>
<tr><td>503</td><td><code>NZZF_UNAVAILABLE</code></td><td>NZZF 上游请求失败或不可用。</td></tr>
<tr><td>500</td><td><code>INTERNAL_ERROR</code></td><td>未预期服务端异常；保留请求时间与订单号并联系技术支持。</td></tr>
</tbody></table>
<h3>HTTP 状态码速查</h3><table><thead><tr><th>状态码</th><th>含义</th></tr></thead><tbody><tr><td>200</td><td>查询或通知处理成功</td></tr><tr><td>201</td><td>订单创建成功</td></tr><tr><td>400</td><td>请求参数或签名时间戳字段格式错误</td></tr><tr><td>401</td><td>商户身份或签名验证失败</td></tr><tr><td>409</td><td>商户订单号重复</td></tr><tr><td>415</td><td>请求媒体类型不支持</td></tr><tr><td>500</td><td>服务端内部错误</td></tr><tr><td>503</td><td>支付服务或支付通道暂不可用</td></tr></tbody></table>
</section>

<section id="security"><div class="section-kicker">06 · SECURITY</div><h2>安全与上线检查</h2><ul><li>所有签名都必须在商户后端生成；不要在浏览器中暴露 V1 API Key 或 V2 私钥。</li><li>建议将金额以十进制字符串传递，并在账务系统中使用整数微单位或十进制定点数。</li><li>每次请求使用当前 Unix 秒级时间戳；建议服务器启用 NTP。</li><li>商户订单号应由业务系统生成并保证唯一；遇到 <code>ORDER_EXISTS</code> 应查询原订单。</li><li>商户收到支付成功通知（当该功能开放后）必须先验签，再校验商户号、平台订单号、商户订单号、金额、币种与最终状态。</li><li>任何支付成功状态都应以平台服务端订单状态与账本记录为准，不以浏览器跳转或客户端回调作为入账依据。</li><li>密钥轮换后旧密钥立即失效；请在轮换前安排好调用方切换。</li></ul>
<div class="callout"><strong>需要帮助？</strong> 请在商户工作台确认商户号与 API 版本状态，并提供订单号、请求时间、HTTP 状态码及业务错误码。请勿提交私钥、MD5 密钥、Session Cookie 或完整签名原文。</div>
</section>
<footer>© 晴天支付 · 开发者中心。本文档以当前生产代码实现为准；如与旧版接入说明冲突，请以本页实际接口契约及后续版本公告为准。</footer>
</div></main>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<script>
(function(){
  if(window.hljs)document.querySelectorAll('pre code').forEach(function(node){window.hljs.highlightElement(node);});
  document.querySelectorAll('pre').forEach(function(pre){
    var button=document.createElement('button');button.className='copy';button.type='button';button.textContent='复制代码';
    button.addEventListener('click',async function(){
      var code=pre.querySelector('code');var value=code?code.innerText:pre.innerText;
      try{await navigator.clipboard.writeText(value);button.textContent='已复制';button.classList.add('done');setTimeout(function(){button.textContent='复制代码';button.classList.remove('done');},1600);}
      catch(_){button.textContent='复制失败';setTimeout(function(){button.textContent='复制代码';},1600);}
    });
    pre.appendChild(button);
  });
  var links=[...document.querySelectorAll('.sidebar a[href^="#"]')];
  var targets=links.map(function(link){return {link:link,node:document.querySelector(link.getAttribute('href'))};}).filter(function(item){return item.node;});
  var observer=new IntersectionObserver(function(entries){
    entries.forEach(function(entry){if(entry.isIntersecting){targets.forEach(function(item){item.link.classList.toggle('active',item.node===entry.target);});}});
  },{rootMargin:'-18% 0px -72% 0px'});
  targets.forEach(function(item){observer.observe(item.node);});
})();
</script>
</body></html>`;

export async function onRequestGet() {
  return new Response(page, { headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  }});
}
