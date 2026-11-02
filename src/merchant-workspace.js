import "./merchant-workspace.css";

const ENDPOINTS = {
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
function renderOverview() {
  const panel = $("#merchant-panel-content");
  panel.innerHTML = "";
  const row = document.createElement("div"); row.className = "merchant-profile-row";
  const symbol = document.createElement("span"); symbol.className = "profile-symbol"; symbol.textContent = "♙";
  const copy = document.createElement("div");
  const name = document.createElement("b"); name.textContent = currentUser?.display_name || currentUser?.email?.split("@")[0] || "晴天商户";
  const email = document.createElement("small"); email.textContent = currentUser?.email || "—";
  copy.append(name, email);
  const profile = document.createElement("button"); profile.type = "button"; profile.dataset.section = "profile"; profile.textContent = "个人资料";
  row.append(symbol, copy, profile);
  const shortcuts = document.createElement("div"); shortcuts.className = "merchant-shortcuts";
  [["orders","订单记录"],["withdrawals","提现记录"],["ledger","资金明细"],["payments","收款通道"]].forEach(([key,label]) => {
    const button = document.createElement("button"); button.type = "button"; button.dataset.section = key;
    const icon = document.createElement("span"); icon.textContent = key === "orders" ? "▤" : key === "withdrawals" ? "▱" : key === "ledger" ? "▥" : "▣";
    button.append(icon, document.createTextNode(label)); shortcuts.append(button);
  });
  panel.append(row, shortcuts);
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
    const name = currentUser?.display_name || email.split("@")[0] || "晴天商户";
    const drawerName = $("#drawer-user-name"); if (drawerName) drawerName.textContent = name;
    const drawerEmail = $("#drawer-user-email"); if (drawerEmail) drawerEmail.textContent = email;
    selectSection("overview");
  }).catch((error) => showEmpty("账户信息读取失败", error.message || "请刷新页面重试。"));

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
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
