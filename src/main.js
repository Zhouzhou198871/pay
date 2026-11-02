import "./style.css";
const app = document.querySelector("#app");
const LOGO = "https://raw.githubusercontent.com/Zhouzhou198871/pay/main/logo.png";
let mode = "login";
let countdown = 0;
let timer = null;

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

function shell(content) {
  return `
    <main class="page-shell">
      <div class="ambient ambient-one"></div><div class="ambient ambient-two"></div>
      <header class="topbar">
        <a class="brand" href="/" aria-label="晴天支付首页">
          <img src="${LOGO}" alt="晴天支付 Logo" />
          <span>晴天支付</span>
        </a>
        <span class="top-note"><i></i> 安全加密连接</span>
      </header>
      <section class="auth-layout">
        <div class="intro-panel">
          <div class="eyebrow"><span class="eyebrow-dot"></span> PAYMENT · TRUST · SIMPLE</div>
          <h1>让每一笔生意<br/><em>都安心抵达。</em></h1>
          <p class="intro-copy">为开发者与商户打造的支付服务平台。接入简单，交易清晰，让收款回归简单。</p>
          <div class="trust-row">
            <div class="trust-item"><span class="trust-icon">⌁</span><span><b>安全可靠</b><small>账户与交易数据加密保护</small></span></div>
            <div class="trust-item"><span class="trust-icon">↗</span><span><b>开发者友好</b><small>清晰的接入流程与服务支持</small></span></div>
          </div>
          <div class="intro-foot"><span>晴天支付</span><span>让支付连接价值</span></div>
        </div>
        <div class="form-panel">${content}</div>
      </section>
      <footer class="site-footer"><span>© ${new Date().getFullYear()} 晴天支付</span><span>安全 · 透明 · 高效</span></footer>
    </main>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>
    <dialog class="legal-dialog" id="legal-dialog">
      <div class="dialog-head"><strong id="legal-title">用户协议</strong><button class="icon-close" id="close-legal" aria-label="关闭">×</button></div>
      <div class="dialog-body" id="legal-body"></div>
    </dialog>`;
}

function authMarkup() {
  const registering = mode === "register";
  return shell(`
    <div class="form-heading">
      <div class="form-kicker">WELCOME TO QINGTIAN</div>
      <h2>${registering ? "创建账户" : "欢迎回来"}</h2>
      <p>${registering ? "注册晴天支付，开启简单安心的收款体验。" : "登录晴天支付，继续管理您的业务。"}</p>
    </div>
    <div class="mode-switch" role="tablist" aria-label="登录或注册">
      <button class="${!registering ? "active" : ""}" data-mode="login" role="tab" aria-selected="${!registering}">登录</button>
      <button class="${registering ? "active" : ""}" data-mode="register" role="tab" aria-selected="${registering}">注册</button>
    </div>
    <form id="auth-form" novalidate>
      <label class="field-label" for="email">邮箱地址</label>
      <div class="input-wrap"><span class="input-icon">✉</span><input id="email" name="email" type="email" autocomplete="email" placeholder="请输入常用邮箱" required /></div>
      <label class="field-label" for="password">登录密码</label>
      <div class="input-wrap"><span class="input-icon">⌑</span><input id="password" name="password" type="password" autocomplete="${registering ? "new-password" : "current-password"}" placeholder="${registering ? "至少 8 位，建议包含字母和数字" : "请输入登录密码"}" minlength="8" required /><button class="password-toggle" type="button" id="toggle-password">显示</button></div>
      ${registering ? `
        <label class="field-label" for="code">邮箱验证码</label>
        <div class="input-wrap code-wrap"><span class="input-icon">#</span><input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="输入 6 位验证码" required /><button class="send-code" type="button" id="send-code">获取验证码</button></div>
        <label class="consent"><input type="checkbox" id="consent" required /><span>我已阅读并同意 <button type="button" class="text-link" data-legal="terms">《用户协议》</button> 和 <button type="button" class="text-link" data-legal="privacy">《隐私政策》</button></span></label>
      ` : `<div class="login-meta"><span>使用邮箱与密码安全登录</span><span class="secure-mark">● SSL 安全保护</span></div>`}
      <button class="primary-button" type="submit"><span>${registering ? "创建账户" : "登录账户"}</span><b>→</b></button>
    </form>
    <div class="separator"><span>或使用以下方式</span></div>
    <a class="github-button" href="/api/auth/github"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.53v-2.06c-3.1.67-3.76-1.32-3.76-1.32-.5-1.28-1.24-1.62-1.24-1.62-1.01-.69.08-.68.08-.68 1.12.08 1.71 1.15 1.71 1.15 1 1.7 2.62 1.21 3.26.93.1-.72.39-1.21.71-1.49-2.48-.28-5.09-1.24-5.09-5.52 0-1.22.44-2.21 1.15-2.99-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.05 1.14a10.6 10.6 0 0 1 5.55 0c2.11-1.44 3.05-1.14 3.05-1.14.61 1.54.23 2.68.11 2.96.72.78 1.15 1.77 1.15 2.99 0 4.29-2.61 5.24-5.1 5.51.4.35.76 1.02.76 2.06V22c0 .29.2.63.77.52A11.1 11.1 0 0 0 12 .9Z"/></svg>使用 GitHub 继续</a>
    <p class="form-foot">${registering ? "已经拥有账户？" : "还没有晴天支付账户？"} <button class="text-link" data-mode="${registering ? "login" : "register"}">${registering ? "立即登录" : "创建账户"}</button></p>
    <div class="privacy-note"><span>♢</span> 您的信息受到加密保护，我们不会出售您的个人数据。</div>
  `);
}

function showToast(message, type = "info") {
  const el = document.querySelector("#toast");
  if (!el) return;
  el.textContent = message;
  el.dataset.type = type;
  el.classList.add("visible");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => el.classList.remove("visible"), 3600);
}

function openLegal(kind) {
  const dialog = document.querySelector("#legal-dialog");
  const title = document.querySelector("#legal-title");
  const body = document.querySelector("#legal-body");
  title.textContent = kind === "terms" ? "晴天支付用户协议" : "晴天支付隐私政策";
  body.innerHTML = kind === "terms"
    ? `<h3>一、服务说明</h3><p>晴天支付为开发者与商户提供支付技术接入、订单管理及相关平台服务。具体服务范围以平台实际开放功能和双方确认的协议为准。</p><h3>二、账户责任</h3><p>您应提供真实、准确的信息，妥善保管账户凭据，不得利用平台从事违法违规活动。平台可依法进行必要的商户审核与风险控制。</p><h3>三、交易与费用</h3><p>支付渠道、交易状态、服务费用及结算安排以正式商户协议和平台公示规则为准。未经审核的账户不具备正式支付调用权限。</p><h3>四、风险与合规</h3><p>商户应遵守所在地法律法规、支付渠道规则及反洗钱等适用要求。平台有权对异常交易进行核查、限制或暂停相关服务。</p><h3>五、协议更新</h3><p>平台可在法律允许范围内更新协议，并通过站内公告或适当方式告知。</p>`
    : `<h3>一、信息收集</h3><p>为创建和保护账户、提供验证码、处理登录请求及维护平台安全，我们可能处理您的邮箱地址、账户凭据的加密摘要、登录记录及必要的设备和网络信息。</p><h3>二、信息使用</h3><p>信息仅用于账户注册、身份验证、安全风控、客户支持及履行法律义务，不会出售您的个人数据。</p><h3>三、信息保护</h3><p>密码采用不可逆的强哈希方式保存；验证码设置有效期与尝试次数限制；会话凭据使用安全 Cookie 保护。</p><h3>四、您的权利</h3><p>您可通过平台支持渠道申请查询、更正或删除依法可删除的个人信息。</p><h3>五、政策更新</h3><p>如本政策发生重要变化，平台将以适当方式提示您。</p>`;
  dialog.showModal();
}

async function renderDashboard() {
  app.innerHTML = shell(`<div class="form-heading"><div class="form-kicker">ACCOUNT CENTER</div><h2>账户已登录</h2><p id="account-email">正在读取账户信息…</p></div><div class="dashboard-card"><div class="dashboard-badge">✓</div><h3>欢迎使用晴天支付</h3><p>账户认证已通过。商户功能将在完成平台配置后开放。</p><button class="primary-button" id="logout"><span>安全退出</span><b>→</b></button></div>`);
  const res = await fetch("/api/auth/me");
  if (!res.ok) { location.href = "/"; return; }
  const data = await res.json();
  document.querySelector("#account-email").textContent = data.user.email;
  document.querySelector("#logout").addEventListener("click", async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/";
  });
}

function bindAuthEvents() {
  document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => {
    mode = button.dataset.mode;
    clearInterval(timer);
    countdown = 0;
    app.innerHTML = authMarkup();
    bindAuthEvents();
  }));
  document.querySelectorAll("[data-legal]").forEach((button) => button.addEventListener("click", () => openLegal(button.dataset.legal)));
  document.querySelector("#close-legal")?.addEventListener("click", () => document.querySelector("#legal-dialog").close());
  document.querySelector("#toggle-password")?.addEventListener("click", () => {
    const input = document.querySelector("#password");
    const visible = input.type === "password";
    input.type = visible ? "text" : "password";
    document.querySelector("#toggle-password").textContent = visible ? "隐藏" : "显示";
  });
  document.querySelector("#send-code")?.addEventListener("click", sendCode);
  document.querySelector("#auth-form")?.addEventListener("submit", submitAuth);
}

async function sendCode() {
  const email = document.querySelector("#email").value.trim();
  const button = document.querySelector("#send-code");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast("请先输入有效的邮箱地址", "error");
    document.querySelector("#email").focus();
    return;
  }
  button.disabled = true;
  button.textContent = "发送中…";
  try {
    const response = await fetch("/api/auth/send-code", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "验证码发送失败");
    countdown = 60;
    button.textContent = `重新获取 ${countdown}s`;
    timer = setInterval(() => {
      countdown -= 1;
      if (countdown <= 0) {
        clearInterval(timer);
        button.disabled = false;
        button.textContent = "重新获取";
      } else button.textContent = `重新获取 ${countdown}s`;
    }, 1000);
    showToast("验证码已发送，请查收邮箱", "success");
  } catch (error) {
    button.disabled = false;
    button.textContent = "获取验证码";
    showToast(error.message, "error");
  }
}

async function submitAuth(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = Object.fromEntries(form.entries());
  if (mode === "register") payload.consent = document.querySelector("#consent").checked;
  const button = event.currentTarget.querySelector(".primary-button");
  if (mode === "register" && !document.querySelector("#consent").checked) {
    showToast("请先阅读并同意用户协议与隐私政策", "error");
    return;
  }
  if (mode === "register" && !/^\d{6}$/.test(payload.code || "")) {
    showToast("请输入 6 位邮箱验证码", "error");
    return;
  }
  if ((payload.password || "").length < 8) {
    showToast("密码至少需要 8 位", "error");
    return;
  }
  button.disabled = true;
  button.querySelector("span").textContent = mode === "register" ? "正在创建…" : "正在登录…";
  try {
    const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
    const response = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "操作失败，请稍后重试");
    location.href = "/dashboard";
  } catch (error) {
    showToast(error.message, "error");
    button.disabled = false;
    button.querySelector("span").textContent = mode === "register" ? "创建账户" : "登录账户";
  }
}

if (location.pathname === "/dashboard") {
  renderDashboard();
} else {
  app.innerHTML = authMarkup();
  bindAuthEvents();
}
