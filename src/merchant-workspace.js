import "./merchant-workspace.css";

const ENDPOINTS = {\n  dashboard: "/api/merchant/dashboard",
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
      <div class="qt-section-title"><span class="qt-title-icon"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h3"/></svg></span><div><h3>通道统计</h3><p>已配置收款通道及其统计字段</p></div></div>
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
      <div class="qt-section-title"><span class="qt-title-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span><div><h3>交易说明</h3><p>请根据平台实际开放的通道与业务规则进行接入</p></div></div>
      <div class="qt-info-block"><b>支持业务类型</b><div class="qt-tag-cloud"><span>支持范围以商户审核结果为准</span></div></div>
      <div class="qt-warning"><strong><svg viewBox="0 0 24 24"><path d="m12 3 10 18H2z"/><path d="M12 9v5M12 18h.01"/></svg>禁止事项</strong><p>请勿开展违法违规、侵权、欺诈或违反支付通道规则的业务。具体限制以平台协议及通道审核要求为准。</p></div>
      <div class="qt-info-grid">
        <article><span>充值范围</span><b id="qt-recharge-range">按商户配置</b><p>具体范围以已审核的商户配置为准</p></article>
        <article><span>入款方式</span><b id="qt-deposit-method">按已开通通道</b><p>仅展示平台实际开通的收款方式</p></article>
        <article><span>结算说明</span><b id="qt-settlement-note">按结算配置</b><p>以商户协议及实际账本记录为准</p></article>
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
      const summary = data.summary || {};
      const merchant = data.merchant || null;
      const merchantStatus = document.getElementById("qt-merchant-status");
      if (merchantStatus) {
        const statusLabels = { active: "正常", pending: "审核中", rejected: "审核未通过", suspended: "已暂停", revoked: "已撤销" };
        merchantStatus.innerHTML = "<i></i>" + (merchant ? "商户状态：" + (statusLabels[merchant.status] || merchant.status) : "商户状态：未开通");
        merchantStatus.style.color = merchant?.status === "active" ? "#26966f" : "#8795a2";
      }
      if (!merchant) {
        setText("qt-recharge-range", "未开通");
        setText("qt-deposit-method", "未开通");
        setText("qt-settlement-note", "未配置");
      }
      setText("qt-order-count", Number(summary.total_orders || 0).toLocaleString("zh-CN"));
      setText("qt-today-orders", Number(summary.today_orders || 0).toLocaleString("zh-CN"));

      const balances = Array.isArray(data.balances) ? data.balances : [];
      const balance = balances.find((item) => item.currency === "USDT") || balances[0] || { currency: "USDT", available_micro: 0, pending_micro: 0, total_micro: 0 };
      const currency = balance.currency || "USDT";
      setText("qt-withdrawable", formatYuanMicro(balance.available_micro || 0, currency));
      setText("qt-pending", formatYuanMicro(balance.pending_micro || 0, currency));
      setText("qt-total-balance", formatYuanMicro(balance.total_micro || 0, currency));
      setText("qt-withdrawable-currency", currency);
      setText("qt-pending-currency", currency);

      const channelRoot = document.getElementById("qt-channel-list");
      if (channelRoot) {
        const channels = Array.isArray(data.channels) ? data.channels : [];
        if (!channels.length) {
          channelRoot.innerHTML = '<div class="qt-data-empty">数据库中暂无已配置或产生订单的收款通道</div>';
        } else {
          channelRoot.innerHTML = channels.map((channel) => {
            const title = escapeText(channel.display_name || channel.channel_code || "收款通道");
            const code = escapeText(channel.channel_code || "");
            const status = escapeText(channel.status || "");
            const rate = Number(channel.success_rate || 0).toFixed(2).replace(/\.?0+$/, "");
            const feeRate = Number(channel.fee_rate || 0).toFixed(2).replace(/\.?0+$/, "");
            return `
              <article class="qt-channel-row">
                <span class="qt-channel-mark">${title.slice(0,1)}</span>
                <div class="qt-channel-name"><strong>${title}</strong><small>${code} · ${status}</small></div>
                <div class="qt-channel-metrics">
                  <div><small>今日收入</small><b>${formatCents(channel.today_amount_cents, channel.currency || "CNY")}</b></div>
                  <div><small>昨日收入</small><b>${formatCents(channel.yesterday_amount_cents, channel.currency || "CNY")}</b></div>
                  <div><small>通道成功率</small><b class="qt-success-text">${rate}%</b></div>
                  <div><small>通道费率</small><b>${feeRate}%</b></div>
                </div>
              </article>`;
          }).join("");
        }
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
  const panel = $("#merchant-panel-content"); panel.innerHTML = "";
  const list = document.createElement("div"); list.className = "account-detail-list";
  [["账户名称", currentUser?.display_name || "未设置"],["登录邮箱",currentUser?.email || "—"],["账户状态","正常"]].forEach(([label,value]) => {
    const item = document.createElement("div"); item.className = "account-detail";
    const l = document.createElement("span"); l.textContent = label;
    const v = document.createElement("b"); v.textContent = value;
    item.append(l,v); list.append(item);
  });
  const note = document.createElement("p"); note.className = "section-note"; note.textContent = "资料修改功能尚未开放。此处仅展示当前登录账户资料。";
  panel.append(list,note);
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
    const panel = $("#merchant-panel-content"); panel.innerHTML = "";
    const box = document.createElement("div"); box.className = "section-empty";
    const title = document.createElement("h3"); title.textContent = "开发者接入文档";
    const desc = document.createElement("p"); desc.textContent = "查看 API 接入指南与接口字段说明。当前文档仅包含已开放的账户认证和商户只读查询接口。";
    const a = document.createElement("a"); a.href = "/docs/DEVELOPER_GUIDE.md"; a.textContent = "打开开发者指南"; a.target = "_blank"; a.rel = "noopener";
    const b = document.createElement("a"); b.href = "/docs/API_REFERENCE.md"; b.textContent = "打开 API 接口参考"; b.target = "_blank"; b.rel = "noopener";
    box.append(title,desc,a,b); panel.append(box); return;
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
