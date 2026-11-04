import "./merchant-workspace.css";

const ENDPOINTS = {
  dashboard: "/api/merchant/dashboard",
  orders: "/api/merchant/orders",
  withdrawals: "/api/merchant/withdrawals",
  ledger: "/api/merchant/ledger",
  payments: "/api/merchant/channels"
};
const LABELS = {
  overview: ["用户中心", "账户概览", "账户基础信息与服务入口"],
  profile: ["个人资料", "个人资料", "当前登录账户信息"],
  orders: ["订单记录", "订单记录", "仅展示当前账户的真实订单"],
  withdrawals: ["提现记录", "提现记录", "仅展示当前账户的提现记录"],
  ledger: ["资金明细", "资金明细", "账本记录只读展示，不代表实时可提现余额"],
  payments: ["聚合收款", "收款通道", "查看当前账户已配置的收款通道"],
  docs: ["开发文档", "开发文档", "晴天支付 API 接入说明"],
  support: ["联系客服", "联系客服", "官方客服入口尚未配置"]
};
const STATUS = {
  pending: "处理中", paid: "已支付", failed: "失败", cancelled: "已取消",
  refunded: "已退款", approved: "已通过", processing: "打款处理中",
  rejected: "已拒绝", active: "已启用", disabled: "已停用",
  credit: "收入", debit: "支出"
};
const $ = (selector, root = document) => root.querySelector(selector);
const esc = (value) => String(value ?? "—");
const money = (micro, currency = "USDT") => {
  if (micro === null || micro === undefined || !Number.isFinite(Number(micro))) return "—";
  const n = BigInt(String(Math.trunc(Number(micro))));
  const negative = n < 0n;
  const abs = negative ? -n : n;
  const whole = abs / 1000000n;
  const fraction = String(abs % 1000000n).padStart(6, "0").replace(/0+$/, "");
  return (negative ? "-" : "") + whole.toLocaleString("en-US") + (fraction ? "." + fraction : "") + " " + currency;
};
const date = (seconds) => {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(n * 1000));
};
const statusText = (value) => STATUS[value] || esc(value);

let currentSection = "overview";
let currentPage = 1;
let requestSequence = 0;
let currentUser = null;

function updateHeading(key) {
  const item = LABELS[key] || LABELS.overview;
  $("#merchant-greeting").textContent = item[0];
  $("#merchant-panel-title").textContent = item[1];
  $("#merchant-panel-subtitle").textContent = item[2];
  document.querySelectorAll(".drawer-link").forEach((button) => {
    button.classList.toggle("active", button.dataset.section === key);
  });
}
function showEmpty(title, description) {
  const panel = $("#merchant-panel-content");
  panel.innerHTML = "";
  const box = document.createElement("div");
  box.className = "section-empty";
  const h = document.createElement("h3"); h.textContent = title;
  const p = document.createElement("p"); p.textContent = description;
  box.append(h, p); panel.append(box);
}
function lastSevenDateLabels() { const now = new Date(); return Array.from({length:7}, (_,i) => { const d = new Date(now); d.setDate(now.getDate() - 6 + i); return String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); }); }
function formatYuanMicro(value, currency = "CNY") {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  return (Number(value) / 1000000).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (currency === "CNY" ? " 元" : " " + currency);
}
function renderOverview() {
  const panel = $("#merchant-panel-content");
  const name = currentUser?.display_name || currentUser?.username || "";
  panel.innerHTML = `
    <section class="qt-stat-grid" aria-label="数据概览">
      <article class="qt-stat-card qt-stat-blue"><span class="qt-stat-icon"><svg viewBox="0 0 24 24"><path d="M12 2v20M17 6.5c0-1.7-2.2-3-5-3S7 4.8 7 6.5 9.2 9.5 12 9.5s5 1.3 5 3-2.2 3-5 3-5 1.3-5 3"/></svg></span><span class="qt-stat-label">可提现余额</span><strong id="qt-withdrawable">读取中</strong><small id="qt-withdrawable-currency">账户币种</small></article>
      <article class="qt-stat-card qt-stat-violet"><span class="qt-stat-icon"><svg viewBox="0 0 24 24"><path d="M12 2v20M17 6.5c0-1.7-2.2-3-5-3S7 4.8 7 6.5 9.2 9.5 12 9.5s5 1.3 5 3-2.2 3-5 3-5 1.3-5 3"/></svg></span><span class="qt-stat-label">待提现余额</span><strong id="qt-pending">读取中</strong><small id="qt-pending-currency">USDT</small></article>
      <article class="qt-stat-card qt-stat-cyan"><span class="qt-stat-icon"><svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></span><span class="qt-stat-label">订单总数</span><strong id="qt-order-count">读取中</strong><small>笔订单</small></article>
      <article class="qt-stat-card qt-stat-green"><span class="qt-stat-icon"><svg viewBox="0 0 24 24"><path d="M4 19V5M4 19h16M8 15l4-4 3 2 5-7"/></svg></span><span class="qt-stat-label">今日订单</span><strong id="qt-today-orders">读取中</strong><small>笔订单</small></article>
    </section>
    <section class="qt-card qt-merchant-card">
      <div class="qt-card-actions"><button class="qt-soft-button" data-section="docs"><svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z"/><path d="M4 5.5v13A2.5 2.5 0 0 1 6.5 16H20"/></svg>API 信息</button><button class="qt-soft-button" data-section="profile"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L9 17l-4 1 1-4z"/></svg>修改资料</button></div>
      <div class="qt-merchant-identity"><div class="qt-wallet-orb"><svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="15" rx="3"/><path d="M3 9h18M16 14h.01M7 6V4a2 2 0 0 1 2-2h9"/></svg></div><h2>你好，${escapeText(name)}</h2><span class="qt-merchant-state" id="qt-merchant-status"><i></i>正在读取商户状态</span></div>
    </section>
    <section class="qt-balance-card"><span>账户余额</span><strong id="qt-total-balance">读取中</strong><small>以账本最新余额为准</small></section>
    <section class="qt-card qt-channel-card">
      <div class="qt-section-title"><span class="qt-title-icon"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h3"/></svg></span><div><h3>通道统计</h3><p>收入、成功率与实际费率均按 D1 订单统计</p></div></div>
      <div id="qt-channel-list"><div class="qt-data-empty">正在读取通道信息…</div></div>
    </section>
    <section class="qt-card qt-trend-card">
      <div class="qt-section-title"><span class="qt-title-icon"><svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 6-7"/></svg></span><div><h3>近 7 天收入走势</h3><p>按订单支付时间统计</p></div></div>
      <div class="qt-trend-total"><strong id="qt-seven-day-total">读取中</strong><span id="qt-seven-day-orders">读取中</span></div>
      <div class="qt-chart" aria-label="近七天收入图表，暂无可用统计数据"><div class="qt-chart-columns">${lastSevenDateLabels().map(day => `<div class="qt-chart-column"><div class="qt-chart-value"><b>读取中</b><small>读取中</small></div><div class="qt-chart-track"><i></i></div><span>${day}</span></div>`).join("")}</div><p class="qt-chart-caption">暂无收入汇总数据，图表数值将在统计接口开放后显示</p></div>
    </section>
    <section class="qt-card qt-steps-card">
      <div class="qt-section-title"><span class="qt-title-icon"><svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM8 9h8M8 13h5"/></svg></span><div><h3>新商户快速开始</h3><p>按以下步骤完成收款接入</p></div></div>
      <div class="qt-steps">
        <article class="qt-step"><span>1</span><div><b>查看商户密钥信息</b><p>在 API 信息中查看商户 ID、MD5 密钥及 RSA 密钥</p><button data-section="docs">查看 API 信息 <i>→</i></button></div></article>
        <article class="qt-step"><span>2</span><div><b>获取收款链接</b><p>复制系统生成的聚合收款链接，按订单金额创建支付请求</p></div></article>
        <article class="qt-step"><span>3</span><div><b>完成 API 对接</b><p>阅读开发文档，将接口地址配置为晴天支付服务地址</p><button data-section="docs">打开开发文档 <i>→</i></button></div></article>
      </div>
    </section>
    <section class="qt-card qt-channel-info">
      <div class="qt-section-title"><span class="qt-title-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span><div><h3>商户支付接入说明</h3><p>面向合规经营商户，提供标准化支付接口接入与订单管理服务</p></div></div>
      <div class="qt-info-block"><b>支持业务类型</b><div class="qt-tag-cloud"><span>企业服务</span><span>数字产品</span><span>软件服务</span><span>在线教育</span><span>内容服务</span><span>生活服务</span></div><p>以上为常见合规业务场景示例，具体接入范围以商户资质审核结果及已开通支付渠道规则为准。</p></div>
      <div class="qt-warning"><strong><svg viewBox="0 0 24 24"><path d="m12 3 10 18H2z"/><path d="M12 9v5M12 18h.01"/></svg>合规经营要求</strong><p>仅限合法合规的商品与服务。禁止开展欺诈、洗钱、赌博、侵权及其他违法违规交易，禁止销售法律法规或支付机构规则明确限制的商品与服务。平台将依据商户协议、适用法律及支付渠道规则进行审核与风险管理。</p></div>
      <div class="qt-info-grid">
        <article><span>交易金额范围</span><b id="qt-recharge-range">以商户配置为准</b><p>单笔限额及可交易范围以审核通过后的商户配置为准</p></article>
        <article><span>支付方式</span><b id="qt-deposit-method">以已开通渠道为准</b><p>仅支持使用商户账户已开通的支付渠道</p></article>
        <article><span>结算说明</span><b id="qt-settlement-note">以商户协议为准</b><p>结算周期、手续费及到账状态以商户协议和账务记录为准</p></article>
      </div>
    </section>
  `;
  loadOverviewData();
}
function escapeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function formatCents(value, currency = "CNY") {
  const amount = Number(value || 0) / 100;
  const formatted = amount.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency === "CNY" ? "¥ " + formatted : formatted + " " + currency;
}
function loadOverviewData() {
  const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = String(value); };
  fetch(ENDPOINTS.dashboard, { credentials: "same-origin", headers: { Accept: "application/json" } })
    .then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) { location.href = "/"; return null; }
      if (!response.ok) throw new Error(payload.error || "统计数据读取失败");
      return payload;
    })
    .then((data) => {
      if (!data || currentSection !== "overview") return;
      const summary = data.summary;
      const merchant = data.merchant || null;
      const merchantStatus = document.getElementById("qt-merchant-status");
      if (merchantStatus) {
        const statusLabels = { active: "正常", pending: "审核中", rejected: "审核未通过", suspended: "已暂停", revoked: "已撤销" };
        merchantStatus.innerHTML = "<i></i>" + (merchant ? "商户状态：" + (statusLabels[merchant.status] || merchant.status) : "商户状态：未开通");
        merchantStatus.style.color = merchant?.status === "active" ? "#26966f" : "#8795a2";
      }
      if (!merchant) {
        setText("qt-recharge-range", "待完成商户审核");
        setText("qt-deposit-method", "待开通支付渠道");
        setText("qt-settlement-note", "以商户协议为准");
      }
      setText("qt-order-count", Number(summary.total_orders || 0).toLocaleString("zh-CN"));
      setText("qt-today-orders", Number(summary.today_orders || 0).toLocaleString("zh-CN"));

      const balances = Array.isArray(data.balances) ? data.balances : [];
      const balance = balances.find((item) => item.currency === "USDT") || balances[0];
      if (!balance) throw new Error("账户余额汇总缺失");
      const currency = balance.currency;
      setText("qt-withdrawable", formatYuanMicro(balance.available_micro || 0, currency));
      setText("qt-pending", formatYuanMicro(balance.pending_micro || 0, currency));
      setText("qt-total-balance", formatYuanMicro(balance.total_micro || 0, currency));
      setText("qt-withdrawable-currency", currency);
      setText("qt-pending-currency", currency);

      const channelRoot = document.getElementById("qt-channel-list");
      if (channelRoot) {
        const channels = Array.isArray(data.channels) ? data.channels : [];
        const alipay = channels.find((channel) => ["alipay", "ali_pay", "支付宝"].includes(String(channel.channel_code || "").toLowerCase()) || String(channel.display_name || "").includes("支付宝"));
        const yuan = (value) => (Number(value || 0) / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "元";
        const today = alipay ? yuan(alipay.today_amount_cents) : "0.00元";
        const yesterday = alipay ? yuan(alipay.yesterday_amount_cents) : "0.00元";
        const successRate = alipay && alipay.success_rate !== null && alipay.success_rate !== undefined
          ? Number(alipay.success_rate).toFixed(2).replace(/\.?0+$/, "")
          : "100";
        channelRoot.innerHTML = `
          <article class="qt-alipay-summary">
            <div class="qt-alipay-summary__heading">
              <span class="qt-alipay-summary__icon" aria-hidden="true">支</span>
              <strong>支付宝</strong>
            </div>
            <div class="qt-alipay-summary__row"><span>今日收入：</span><b>${today}</b></div>
            <div class="qt-alipay-summary__row"><span>昨日收入：</span><b>${yesterday}</b></div>
            <div class="qt-alipay-summary__row"><span>通道成功率：</span><b class="qt-success-text">${successRate}%</b></div>
            <div class="qt-alipay-summary__row"><span>支付宝费率：</span><b>10%</b></div>
          </article>`;
      }

      const trend = data.trend || {};
      setText("qt-seven-day-total", formatCents(trend.total_amount_cents || 0));
      setText("qt-seven-day-orders", Number(trend.total_orders || 0).toLocaleString("zh-CN") + " 单");
      const chart = document.querySelector(".qt-chart-columns");
      if (chart) {
        const days = Array.isArray(trend.days) ? trend.days : [];
        const maxAmount = Math.max(0, ...days.map((day) => Number(day.amount_cents || 0)));
        chart.innerHTML = days.map((day) => {
          const amount = Number(day.amount_cents || 0);
          const height = maxAmount > 0 ? Math.max(4, amount / maxAmount * 100) : 3;
          const dateLabel = String(day.day || "").slice(5).replace("-", "-");
          return `<div class="qt-chart-column">
            <div class="qt-chart-value"><b>${formatCents(amount)}</b><small>${Number(day.orders || 0)} 单</small></div>
            <div class="qt-chart-track"><i style="height:${height}%"></i></div>
            <span>${escapeText(dateLabel)}</span>
          </div>`;
        }).join("");
      }
      const caption = document.querySelector(".qt-chart-caption");
      if (caption) caption.textContent = "数据来自 D1 已支付订单，按支付时间统计；无订单日期按 0 展示。";
    })
    .catch((error) => {
      ["qt-withdrawable","qt-pending","qt-order-count","qt-today-orders","qt-total-balance","qt-seven-day-total","qt-seven-day-orders"].forEach((id) => setText(id, "读取失败"));
      const root = document.getElementById("qt-channel-list");
      if (root) root.innerHTML = '<div class="qt-data-empty">统计数据读取失败，请刷新页面重试</div>';
      const caption = document.querySelector(".qt-chart-caption");
      if (caption) caption.textContent = error.message || "统计数据暂时无法读取";
    });
}
function renderProfile() {
  const panel = $("#merchant-panel-content");
  const user = currentUser || {};
  const displayName = user.display_name || user.username || "未设置";
  const email = user.email || "未提供";
  const accountStatus = user.status === "active" ? "正常" : (user.status || "待核验");
  const baseUrl = location.origin;
  const endpoints = [
    { method: "GET", path: "/api/auth/me", desc: "读取当前登录账户" },
    { method: "GET", path: "/api/merchant/dashboard", desc: "读取商户工作台汇总" },
    { method: "GET", path: "/api/merchant/summary", desc: "读取余额与订单摘要" },
    { method: "GET", path: "/api/merchant/orders?page=1&page_size=20", desc: "读取订单列表" },
    { method: "GET", path: "/api/merchant/withdrawals?page=1&page_size=20", desc: "读取提现记录" },
    { method: "GET", path: "/api/merchant/ledger?page=1&page_size=20", desc: "读取资金流水" },
    { method: "GET", path: "/api/merchant/channels?page=1&page_size=20", desc: "读取收款通道" }
  ];
  panel.innerHTML = `
    <section class="qt-profile-card">
      <nav class="qt-profile-tabs" role="tablist" aria-label="个人资料分类">
        <button type="button" class="active" role="tab" aria-selected="true" data-profile-tab="api">API 信息</button>
        <button type="button" role="tab" aria-selected="false" data-profile-tab="settings">修改资料</button>
      </nav>
      <div class="qt-profile-pane" data-profile-pane="api">
        <section class="qt-profile-section">
          <h3>接口接入信息</h3>
          <p class="qt-profile-description">以下地址和请求方式对应晴天支付当前已上线的真实接口。</p>
          <div class="qt-profile-field">
            <label>API 基础地址</label>
            <div class="qt-copy-field"><code>${escapeText(baseUrl)}</code><button type="button" data-copy-value="${escapeText(baseUrl)}" aria-label="复制 API 基础地址">▢</button></div>
          </div>
          <div class="qt-profile-field">
            <label>商户 ID</label>
            <div class="qt-copy-field"><code id="qt-profile-merchant-id">正在读取商户信息…</code><button type="button" data-copy-target="#qt-profile-merchant-id" aria-label="复制商户 ID">▢</button></div>
          </div>
          <div class="qt-profile-field">
            <label>认证方式</label>
            <div class="qt-copy-field"><code>同源 HttpOnly Session Cookie</code><span class="qt-profile-lock" aria-label="服务端安全管理">安全会话</span></div>
            <small>浏览器通过 credentials: "same-origin" 自动携带登录会话；Cookie 为 HttpOnly，前端脚本不可读取。当前不使用 Bearer Token。</small>
          </div>
        </section>
        <hr class="qt-profile-divider">
        <section class="qt-profile-section">
          <h3>当前可调用接口</h3>
          <p class="qt-profile-description">这些接口已在晴天支付后端实现，调用需要有效登录会话。</p>
          <div class="qt-api-endpoint-list">
            ${endpoints.map((item) => `<article class="qt-api-endpoint"><span class="qt-api-method">${item.method}</span><div><code>${item.path}</code><small>${item.desc}</small></div><button type="button" data-copy-value="${escapeText(baseUrl + item.path)}" aria-label="复制接口地址">▢</button></article>`).join("")}
          </div>
        </section>
        <hr class="qt-profile-divider">
        <section class="qt-profile-section">
          <h3>请求头与调用示例</h3>
          <p class="qt-profile-description">GET 请求使用以下请求配置；浏览器同源请求自动附带 HttpOnly 会话 Cookie。</p>
          <div class="qt-code-panel"><pre>Accept: application/json

fetch("${baseUrl}/api/merchant/dashboard", {
  method: "GET",
  credentials: "same-origin",
  headers: {
    "Accept": "application/json"
  }
});</pre><button type="button" data-copy-value='fetch("${baseUrl}/api/merchant/dashboard", { method: "GET", credentials: "same-origin", headers: { "Accept": "application/json" } });'>复制调用示例</button></div>
        </section>
        <hr class="qt-profile-divider">
        <section class="qt-profile-section">
          <h3>商户签名密钥</h3>
          <div class="qt-profile-notice"><strong>当前版本尚未开放商户密钥管理</strong><p>晴天支付目前没有可调用的 MD5 商户密钥、RSA 密钥对生成/重置接口，也没有对外支付下单签名协议。为避免误接入，这里不会展示虚构密钥或示例密钥。后续正式开放后，将在此显示真实凭据、签名算法、请求头和轮换入口。</p></div>
          <a class="qt-profile-doc-link" href="https://github.com/Zhouzhou198871/pay/blob/main/docs/API_REFERENCE.md" target="_blank" rel="noopener">查看 API 接口参考文档 <span>↗</span></a>
        </section>
      </div>
      <div class="qt-profile-pane" data-profile-pane="settings" hidden>
        <section class="qt-profile-section">
          <h3>账户资料</h3>
          <div class="qt-profile-field"><label>账户名称</label><div class="qt-profile-value">${escapeText(displayName)}</div></div>
          <div class="qt-profile-field"><label>登录邮箱</label><div class="qt-profile-value">${escapeText(email)}</div></div>
          <div class="qt-profile-field"><label>账户状态</label><div class="qt-profile-value"><span class="qt-profile-state">${escapeText(accountStatus)}</span></div></div>
          <div class="qt-profile-notice"><strong>资料修改暂未开放</strong><p>当前账户 API 仅支持读取个人资料，没有修改 display_name、邮箱或账户资料的写入接口。这里先展示已验证的账户信息，不会提供无法保存的假表单。</p></div>
        </section>
        <hr class="qt-profile-divider">
        <section class="qt-profile-section">
          <h3>收款与结算设置</h3>
          <div class="qt-profile-field"><label>结算方式</label><div class="qt-profile-value">USDT 结算（以已开通商户配置为准）</div></div>
          <div class="qt-profile-field"><label>USDT 提款地址</label><div class="qt-profile-value qt-profile-muted">当前账户暂无可读取的已绑定地址</div></div>
          <div class="qt-profile-field"><label>USDT 网络</label><div class="qt-profile-value">待商户结算配置开放</div></div>
          <div class="qt-profile-notice"><strong>结算资料管理暂未开放</strong><p>当前没有安全的地址绑定/修改、网络切换或提现申请 API。为避免资金误转，暂不接受在前端填写后却无法保存的地址。</p></div>
        </section>
        <hr class="qt-profile-divider">
        <section class="qt-profile-section">
          <h3>账户密码</h3>
          <div class="qt-profile-notice"><strong>密码安全保护已启用</strong><p>登录密码使用 PBKDF2-SHA256 加盐哈希保存，不在前端展示或存储明文。当前提供邮箱验证码密码重置流程；支付密码功能尚未开放。</p></div>
          <p class="qt-profile-description">如需重置登录密码，请退出账户后在登录页选择“忘记密码”。重置成功后需要重新登录。</p>
        </section>
      </div>
    </section>`;
  panel.querySelectorAll("[data-profile-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.profileTab;
      panel.querySelectorAll("[data-profile-tab]").forEach((item) => {
        const active = item === button;
        item.classList.toggle("active", active);
        item.setAttribute("aria-selected", String(active));
      });
      panel.querySelectorAll("[data-profile-pane]").forEach((pane) => {
        pane.hidden = pane.dataset.profilePane !== tab;
      });
    });
  });
  panel.querySelectorAll("[data-copy-value],[data-copy-target]").forEach((button) => {
    button.addEventListener("click", async () => {
      const target = button.dataset.copyTarget ? panel.querySelector(button.dataset.copyTarget) : null;
      const value = button.dataset.copyValue || target?.textContent?.trim() || "";
      if (!value || value.includes("正在读取")) return;
      try {
        await navigator.clipboard.writeText(value);
        const previous = button.textContent;
        button.textContent = "已复制";
        button.classList.add("copied");
        window.setTimeout(() => { button.textContent = previous; button.classList.remove("copied"); }, 1600);
      } catch {
        button.textContent = "复制失败";
      }
    });
  });
  fetch(ENDPOINTS.dashboard, { credentials: "same-origin", headers: { Accept: "application/json" } })
    .then(async (response) => {
      if (response.status === 401) { location.href = "/"; return null; }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "商户信息读取失败");
      return payload;
    })
    .then((data) => {
      if (!data || currentSection !== "profile") return;
      const id = data.merchant?.id || "当前账户尚未开通商户资料";
      const idNode = panel.querySelector("#qt-profile-merchant-id");
      if (idNode) idNode.textContent = id;
    })
    .catch(() => {
      const idNode = panel.querySelector("#qt-profile-merchant-id");
      if (idNode) idNode.textContent = "商户资料暂不可读取";
    });
}
function fieldFor(item, section) {
  if (section === "orders") return {
    title: item.merchant_order_no, detail: item.subject,
    amount: money(item.amount_micro, item.currency), status: item.status, time: item.paid_at || item.created_at,
    extra: item.payment_channel ? "收款方式：" + item.payment_channel : ""
  };
  if (section === "withdrawals") return {
    title: item.request_no, detail: item.destination_masked || "提现申请",
    amount: money(item.amount_micro, item.currency), status: item.status, time: item.requested_at,
    extra: item.fee_micro ? "手续费：" + money(item.fee_micro, item.currency) : ""
  };
  if (section === "ledger") return {
    title: item.entry_no, detail: item.description || item.category || "资金流水",
    amount: money(item.amount_micro, item.currency), status: item.direction, time: item.created_at,
    extra: item.balance_after_micro == null ? "" : "余额：" + money(item.balance_after_micro, item.currency)
  };
  return {
    title: item.display_name || item.channel_code || "收款通道",
    detail: item.channel_code || "—", amount: "", status: item.status, time: item.created_at,
    extra: ""
  };
}
function makeRecord(item, section) {
  const data = fieldFor(item, section);
  const row = document.createElement("article"); row.className = "merchant-record";
  const left = document.createElement("div");
  const title = document.createElement("b"); title.textContent = esc(data.title);
  const detail = document.createElement("small"); detail.textContent = esc(data.detail);
  left.append(title, detail);
  const right = document.createElement("div"); right.className = "record-meta";
  if (data.amount) { const amount = document.createElement("b"); amount.textContent = data.amount; right.append(amount); }
  const state = document.createElement("span"); state.className = "record-status"; state.textContent = statusText(data.status);
  const time = document.createElement("small"); time.textContent = date(data.time);
  right.append(state,time);
  if (data.extra) { const extra = document.createElement("small"); extra.textContent = data.extra; right.append(extra); }
  row.append(left,right); return row;
}
async function loadRecords(key, page = 1) {
  const endpoint = ENDPOINTS[key];
  if (!endpoint) return;
  currentSection = key; currentPage = page;
  updateHeading(key);
  const panel = $("#merchant-panel-content");
  panel.innerHTML = '<div class="section-loading" role="status">正在读取账户记录…</div>';
  const seq = ++requestSequence;
  try {
    const response = await fetch(endpoint + "?page=" + page + "&page_size=20", { headers: { Accept: "application/json" }, credentials: "same-origin" });
    if (response.status === 401) { location.href = "/"; return; }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "读取失败，请稍后重试。");
    if (seq !== requestSequence || currentSection !== key) return;
    const items = Array.isArray(payload.items) ? payload.items : [];
    if (!items.length && page === 1) { showEmpty("暂无记录", "当前账户还没有此类业务记录。"); return; }
    panel.innerHTML = "";
    const list = document.createElement("div"); list.className = "merchant-record-list";
    items.forEach((item) => list.append(makeRecord(item, key)));
    panel.append(list);
    const pagination = payload.pagination || {};
    const total = Number(pagination.total || items.length);
    const pages = Math.max(1, Number(pagination.pages || 1));
    const footer = document.createElement("div"); footer.className = "record-pagination";
    const info = document.createElement("span"); info.textContent = "共 " + total + " 条 · 第 " + page + " / " + pages + " 页";
    const controls = document.createElement("div");
    const prev = document.createElement("button"); prev.type = "button"; prev.textContent = "上一页"; prev.disabled = page <= 1; prev.addEventListener("click", () => loadRecords(key, page - 1));
    const next = document.createElement("button"); next.type = "button"; next.textContent = "下一页"; next.disabled = page >= pages; next.addEventListener("click", () => loadRecords(key, page + 1));
    controls.append(prev,next); footer.append(info,controls); panel.append(footer);
  } catch (error) {
    if (seq !== requestSequence) return;
    panel.innerHTML = "";
    const box = document.createElement("div"); box.className = "section-empty";
    const title = document.createElement("h3"); title.textContent = "数据读取失败";
    const message = document.createElement("p"); message.textContent = error.message || "网络异常，请稍后重试。";
    const retry = document.createElement("button"); retry.type = "button"; retry.className = "record-retry"; retry.textContent = "点击重试";
    retry.addEventListener("click", () => loadRecords(key, page));
    box.append(title,message,retry); panel.append(box);
  }
}
function selectSection(key) {
  currentSection = key; currentPage = 1; requestSequence++;
  updateHeading(key);
  if (ENDPOINTS[key]) return loadRecords(key, 1);
  if (key === "overview") return renderOverview();
  if (key === "profile") return renderProfile();
  if (key === "docs") {
    const panel = $("#merchant-panel-content");
    panel.innerHTML = `
      <section class="qt-docs-hub">
        <button class="qt-docs-hero" id="qt-docs-open" type="button" aria-expanded="false">
          <span class="qt-docs-hero-icon" aria-hidden="true">⌘</span>
          <span class="qt-docs-hero-copy"><small>DEVELOPER CENTER</small><strong>开发者接入文档</strong><em>在当前工作台内阅读完整 API 文档，无需离开商户中心。</em></span>
          <span class="qt-docs-hero-action">展开文档 <b>↗</b></span>
        </button>
        <div class="qt-docs-shortcuts" aria-label="文档快捷入口">
          <button type="button" data-doc-anchor="quickstart"><span>01</span><b>接入指引</b><small>商户号 · MD5 · RSA 密钥</small><i>›</i></button>
          <button type="button" data-doc-anchor="signature"><span>02</span><b>签名规范与 API 参考</b><small>V1 MD5 · V2 RSA2 · 下单接口</small><i>›</i></button>
        </div>
        <section class="qt-docs-viewer" id="qt-docs-viewer">
          <div class="qt-docs-viewer-head"><div><i></i><strong>晴天支付 · API 文档中心</strong><small>官方接入规范</small></div><a href="/docs" target="_blank" rel="noopener">单独打开 ↗</a></div>
          <iframe id="qt-docs-frame" title="晴天支付完整开发者文档" src="/docs" loading="eager" referrerpolicy="strict-origin-when-cross-origin"></iframe>
        </section>
      </section>`;
    const viewer = $("#qt-docs-viewer", panel);
    const frame = $("#qt-docs-frame", panel);
    const openDocs = (anchor = "") => {
      viewer.classList.add("is-open");
      const next = "/docs" + (anchor ? "#" + anchor : "");
      if (frame.getAttribute("src") !== next) frame.setAttribute("src", next);
      viewer.scrollIntoView({ behavior: "smooth", block: "start" });
      $("#qt-docs-open", panel)?.setAttribute("aria-expanded", "true");
    };
    $("#qt-docs-open", panel)?.addEventListener("click", () => openDocs());
    panel.querySelectorAll("[data-doc-anchor]").forEach((button) => {
      button.addEventListener("click", () => openDocs(button.dataset.docAnchor));
    });
    return;
  }
  if (key === "support") return showEmpty("官方客服入口尚未配置", "请勿向非官方账号提供密码、验证码或 API 密钥。");
  showEmpty("此功能尚未开放", "当前版本不会展示模拟订单、虚构余额或未接通的支付能力。");
}
function initWorkspace() {
  if (!$(".merchant-app") || document.documentElement.dataset.qtWorkspaceReady === "1") return;
  document.documentElement.dataset.qtWorkspaceReady = "1";
  fetch("/api/auth/me", { credentials: "same-origin" }).then(async (r) => {
    if (r.status === 401) { location.href = "/"; return null; }
    if (!r.ok) throw new Error("账户资料暂时无法读取");
    return r.json();
  }).then((data) => {
    if (!data) return;
    currentUser = data.user || null;
    const email = currentUser?.email || "已登录商户";
    const name = currentUser?.display_name || currentUser?.username || "";
    const drawerName = $("#drawer-user-name"); if (drawerName) drawerName.textContent = name;
    const drawerEmail = $("#drawer-user-email"); if (drawerEmail) drawerEmail.textContent = email;
    selectSection("overview");
  }).catch((error) => showEmpty("账户信息读取失败", error.message || "请刷新页面重试。"));

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("#open-merchant-menu")) { $("#merchant-drawer")?.classList.add("open"); $("#merchant-backdrop")?.classList.add("visible"); document.body.classList.add("merchant-menu-open"); return; }
    if (target?.closest("#close-merchant-menu,#merchant-backdrop")) { $("#merchant-drawer")?.classList.remove("open"); $("#merchant-backdrop")?.classList.remove("visible"); document.body.classList.remove("merchant-menu-open"); return; }
    if (target?.closest("#top-logout,#drawer-logout")) { event.preventDefault(); fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).finally(() => { location.href = "/"; }); return; }
    const sectionButton = target?.closest("[data-section]");
    if (sectionButton && $(".merchant-app")) {
      event.preventDefault(); event.stopImmediatePropagation();
      selectSection(sectionButton.dataset.section); $("#merchant-drawer")?.classList.remove("open");
      $("#merchant-backdrop")?.classList.remove("visible"); document.body.classList.remove("merchant-menu-open");
      return;
    }
    if (target?.closest("#open-profile,#edit-profile")) {
      event.preventDefault(); event.stopImmediatePropagation(); selectSection("profile");
    }
  }, true);
}
const observer = new MutationObserver(() => {
  if ($(".merchant-app")) initWorkspace();
});
observer.observe(document.documentElement, { childList: true, subtree: true });
if (document.readyState !== "loading") initWorkspace();
else document.addEventListener("DOMContentLoaded", initWorkspace, { once: true });
