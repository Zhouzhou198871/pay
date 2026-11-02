import "./style.css";
const app = document.querySelector("#app");
const LOGO = "https://raw.githubusercontent.com/Zhouzhou198871/pay/main/logo.png";
let mode = "login";
let countdown = 0;
let timer = null;
let captchaLoadSeq = 0;
let turnstileLoaderPromise = null;

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
      <label class="field-label">人机验证</label><div class="captcha-slot" id="captcha-slot" aria-live="polite"></div><p class="captcha-hint" id="captcha-hint" aria-live="polite">请先完成人机验证，再获取邮箱验证码。</p>
      ${registering ? `
        <label class="field-label" for="code">邮箱验证码</label>
        <div class="input-wrap code-wrap"><span class="input-icon">#</span><input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="输入 6 位验证码" required /><button class="send-code" type="button" id="send-code">获取验证码</button></div>
        <label class="consent"><input type="checkbox" id="consent" required /><span>我已阅读并同意 <button type="button" class="text-link" data-legal="terms">《用户协议》</button> 和 <button type="button" class="text-link" data-legal="privacy">《隐私政策》</button></span></label>
      ` : `<label class="consent"><input type="checkbox" id="consent" required /><span>我已阅读并同意 <button type="button" class="text-link" data-legal="terms">《用户协议》</button> 和 <button type="button" class="text-link" data-legal="privacy">《隐私政策》</button></span></label><div class="login-meta"><span>使用邮箱与密码安全登录</span><button type="button" class="text-link" id="forgot-password">忘记密码？</button></div>`}
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
    ? `<h3>一、协议范围与接受</h3><p>本协议适用于您访问或使用晴天支付网站、账户系统及平台实际开放的相关功能。您点击同意、完成注册或继续使用相关服务，即表示已阅读并接受本协议及单独展示的《隐私政策》。如您不同意，请停止注册或使用。</p><h3>二、账户注册与安全</h3><p>您应提供真实、准确且由您合法控制的邮箱，并及时更新必要信息。您应妥善保管密码、验证码及登录设备，不得出租、出借、转让账户或协助他人规避平台审核。发现未经授权的使用时，应及时通过平台客服渠道通知我们。</p><h3>三、服务范围</h3><p>平台当前提供账户注册、身份验证及账户管理等功能。支付通道接入、商户收款、订单处理、结算等功能仅在平台明确开放并完成必要审核后提供。页面展示或技术演示不构成对任何支付渠道、交易成功率或结算时效的保证。</p><h3>四、商户合规义务</h3><p>如您以商户或开发者身份使用平台，应确保业务、商品和资金来源合法，遵守适用法律法规、支付机构规则以及反洗钱、制裁合规、消费者保护和数据保护要求。不得利用平台从事欺诈、洗钱、赌博、侵害他人权益或其他违法违规活动。</p><h3>五、风险控制与服务限制</h3><p>为保障账户、交易及平台安全，我们可基于合理风险信号采取身份核验、要求补充资料、延迟处理、限制功能或暂停服务等措施，并在法律允许范围内向您说明原因。对涉嫌违法或存在重大风险的行为，我们可依法配合有权机关调查。</p><h3>六、费用、交易与结算</h3><p>如平台后续开放收费、交易或结算功能，适用费用、支付渠道、交易状态定义、退款和结算规则应以届时单独签署的商户协议或正式公示规则为准。本协议本身不构成对支付服务资质、资金托管或结算服务的承诺。</p><h3>七、知识产权与禁止行为</h3><p>平台的标识、页面设计、软件及相关内容受适用法律保护。未经许可，您不得复制、反向工程、干扰系统运行、绕过安全措施、提交恶意代码或侵害平台及第三方权益。</p><h3>八、服务变更与责任</h3><p>我们可因维护、安全、法律要求或业务调整而更新、暂停或终止部分功能，并在合理可行时提前提示。对于法律允许范围内因不可抗力、第三方网络或服务故障造成的中断，我们将在合理范围内采取措施处理；本条不排除依法不得限制的责任。</p><h3>九、协议更新与适用法律</h3><p>协议更新后会在页面展示版本或生效日期。重大变更将通过适当方式提示。适用法律及争议解决方式以平台运营主体所在地及适用的强制性法律规定为准。</p><h3>十、联系与投诉</h3><p>如对本协议或平台服务有疑问，请通过晴天支付平台公布的客服渠道联系。正式商用前，运营主体应补充真实主体名称、注册地址及有效联系信息。</p>`
    : `<h3>一、我们处理哪些信息</h3><p>注册及登录时，我们处理您主动提交的邮箱地址、密码（仅保存经加盐强哈希处理后的结果）、邮箱验证码校验记录，以及账户创建、登录和安全事件记录。为防范自动化攻击，Cloudflare Turnstile 会处理必要的浏览器、设备和网络信号并生成一次性验证令牌。</p><h3>二、信息用途</h3><p>上述信息用于创建和管理账户、发送注册或密码重置验证码、验证登录身份、保护账户安全、处理客服请求及遵守适用法律义务。若您主动选择 GitHub 登录，平台会向 GitHub 请求授权，并接收其提供的账户标识及已验证邮箱。</p><h3>三、第三方服务</h3><p>平台使用 Cloudflare 提供网站托管、数据库及 Turnstile 人机验证；使用 Resend 发送账户验证码邮件；仅在您主动选择 GitHub 登录时使用 GitHub OAuth。相关服务商会按其适用条款和隐私政策处理必要信息。数据可能根据服务部署情况在您所在地区以外处理。</p><h3>四、保存与保护</h3><p>密码不以明文保存；验证码采用摘要形式保存并设有有效期、发送间隔和错误次数限制；登录会话使用 HttpOnly、Secure Cookie。我们仅在实现服务目的、保障安全或履行法定义务所需期限内保存相关信息，并采取合理的访问控制和安全措施。</p><h3>五、Cookie 与安全技术</h3><p>平台使用必要的登录会话 Cookie 维持您的登录状态。Turnstile 可能使用其安全验证所需的浏览器技术。禁用相关功能可能导致登录、注册或密码找回无法完成。</p><h3>六、您的权利</h3><p>在适用法律允许的范围内，您可以申请查询、更正、删除个人信息，或请求限制相关处理。为核实身份及防止账户被冒用，我们可能要求您完成必要的身份验证。</p><h3>七、未成年人及政策更新</h3><p>本平台面向具备相应民事行为能力的商户及开发者，不以未成年人为服务对象。若隐私政策发生重要变化，我们会通过页面公告或其他适当方式提示。</p><h3>八、联系渠道</h3><p>如需咨询个人信息处理事项，请通过晴天支付平台公布的客服渠道联系。正式商用前，平台运营主体应在此处补充真实、有效的个人信息保护联系信息。</p>`;
  dialog.showModal();
}

async function renderDashboard() {
  disposeCaptcha();
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
    disposeCaptcha();
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
  document.querySelector("#forgot-password")?.addEventListener("click", renderForgotPassword);
  loadCaptcha();
  document.querySelector("#auth-form")?.addEventListener("submit", submitAuth);
}

async function sendCode() {
  const email = document.querySelector("#email").value.trim();
  const button = document.querySelector("#send-code");
  if (!window.__qtCaptchaToken) { showToast("请先完成人机验证", "error"); return; }
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
      body: JSON.stringify({ email, purpose: "register", captchaToken: window.__qtCaptchaToken || "" })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "验证码发送失败");
    resetCaptcha();
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
    const hint = document.querySelector("#captcha-hint");
    if (hint) hint.textContent = "验证码已发送。请再次完成人机验证，然后点击创建账户。";
    showToast("验证码已发送，请再次完成人机验证后提交注册", "success");
  } catch (error) {
    resetCaptcha();
    button.disabled = false;
    button.textContent = "获取验证码";
    const hint = document.querySelector("#captcha-hint");
    if (hint) hint.textContent = "验证码发送未完成，请检查提示后重试。";
    showToast(error.message, "error");
  }
}

async function submitAuth(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = Object.fromEntries(form.entries());
  payload.consent = document.querySelector("#consent")?.checked === true;
  payload.captchaToken = window.__qtCaptchaToken || "";
  const button = event.currentTarget.querySelector(".primary-button");
  if (!payload.consent) {
    showToast("请先阅读并同意用户协议与隐私政策", "error");
    return;
  }
  if (mode === "register" && !/^\d{6}$/.test(payload.code || "")) {
    showToast("请输入 6 位邮箱验证码", "error");
    return;
  }
  if (!payload.captchaToken) { showToast("请先完成人机验证", "error"); return; }
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
    resetCaptcha();
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "操作失败，请稍后重试");
    location.href = "/dashboard";
  } catch (error) {
    resetCaptcha();
    showToast(error.message, "error");
    button.disabled = false;
    button.querySelector("span").textContent = mode === "register" ? "创建账户" : "登录账户";
  }
}


async function ensureTurnstileScript() {
  if (window.turnstile) return;
  if (turnstileLoaderPromise) return turnstileLoaderPromise;
  turnstileLoaderPromise = new Promise((resolve, reject) => {
    let script = document.querySelector('script[data-turnstile-loader="true"]');
    const created = !script;
    if (!script) {
      script = document.createElement("script");
      script.dataset.turnstileLoader = "true";
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
    }
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
      if (error) reject(error); else resolve();
    };
    const onLoad = () => window.turnstile ? finish() : finish(new Error("安全验证脚本未正确初始化"));
    const onError = () => {
      script.remove();
      finish(new Error("安全验证脚本加载失败"));
    };
    const timeout = setTimeout(() => {
      script.remove();
      finish(new Error("安全验证加载超时"));
    }, 15000);
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    if (created) document.head.appendChild(script);
  }).finally(() => { turnstileLoaderPromise = null; });
  return turnstileLoaderPromise;
}

async function loadCaptcha() {
  const slot = document.querySelector("#captcha-slot");
  if (!slot) return;
  const loadId = ++captchaLoadSeq;
  window.__qtCaptchaToken = "";
  slot.replaceChildren();
  try {
    const configResponse = await fetch("/api/auth/config", { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!configResponse.ok) throw new Error("安全验证配置读取失败");
    const config = await configResponse.json();
    if (!config.siteKey) throw new Error("安全验证尚未配置，请联系管理员");

    await ensureTurnstileScript();
    if (loadId !== captchaLoadSeq || !document.querySelector("#captcha-slot")) return;
    window.__qtCaptchaWidgetId = window.turnstile.render(slot, {
      sitekey: config.siteKey,
      theme: "light",
      size: "flexible",
      action: mode === "register" ? "register" : mode === "forgot" ? "password_reset" : "login",
      callback: (token) => {
        window.__qtCaptchaToken = token;
        const hint = document.querySelector("#captcha-hint");
        if (hint && mode === "register") hint.textContent = "人机验证已完成，可以创建账户。";
      },
      "expired-callback": () => {
        window.__qtCaptchaToken = "";
        const hint = document.querySelector("#captcha-hint");
        if (hint && mode === "register") hint.textContent = "人机验证已过期，请重新验证。";
      },
      "timeout-callback": () => {
        window.__qtCaptchaToken = "";
        const hint = document.querySelector("#captcha-hint");
        if (hint && mode === "register") hint.textContent = "人机验证超时，请重新验证。";
        showToast("人机验证已超时，请重新验证", "error");
      },
      "error-callback": () => {
        window.__qtCaptchaToken = "";
        const hint = document.querySelector("#captcha-hint");
        if (hint && mode === "register") hint.textContent = "人机验证暂不可用，请重新加载。";
        showToast("人机验证暂不可用，请重新加载验证", "error");
      }
    });
  } catch (error) {
    if (loadId !== captchaLoadSeq) return;
    slot.innerHTML = '<span>安全验证加载失败，请重试</span> <button type="button" class="text-link" id="captcha-retry">重新加载</button>';
    slot.querySelector("#captcha-retry")?.addEventListener("click", loadCaptcha);
    showToast(error.message || "安全验证加载失败，请刷新页面重试", "error");
  }
}

function resetCaptcha() {
  window.__qtCaptchaToken = "";
  if (window.turnstile && window.__qtCaptchaWidgetId !== undefined) {
    try { window.turnstile.reset(window.__qtCaptchaWidgetId); } catch {}
  }
}

function disposeCaptcha() {
  captchaLoadSeq += 1;
  window.__qtCaptchaToken = "";
  if (window.turnstile && window.__qtCaptchaWidgetId !== undefined) {
    try { window.turnstile.remove(window.__qtCaptchaWidgetId); } catch {}
  }
  window.__qtCaptchaWidgetId = undefined;
}

function renderForgotPassword() {
  disposeCaptcha();
  clearInterval(timer);
  countdown = 0;
  mode = "forgot";
  app.innerHTML = shell(`
    <div class="form-heading"><div class="form-kicker">ACCOUNT RECOVERY</div><h2>重置登录密码</h2><p>通过注册邮箱验证身份，重新设置安全密码。</p></div>
    <form id="reset-form" class="recovery-form" novalidate>
      <label class="field-label" for="email">注册邮箱</label>
      <div class="input-wrap"><span class="input-icon">✉</span><input id="email" name="email" type="email" autocomplete="email" placeholder="请输入注册邮箱" required /></div>
      <label class="field-label">人机验证</label><div class="captcha-slot" id="captcha-slot" aria-live="polite"></div>
      <label class="field-label" for="code">邮箱验证码</label>
      <div class="input-wrap code-wrap"><span class="input-icon">#</span><input id="code" name="code" inputmode="numeric" maxlength="6" placeholder="输入 6 位验证码" required /><button class="send-code" type="button" id="send-reset-code">获取验证码</button></div>
      <label class="field-label" for="password">新密码</label>
      <div class="input-wrap"><span class="input-icon">⌑</span><input id="password" name="password" type="password" minlength="8" autocomplete="new-password" placeholder="至少 8 位新密码" required /></div>
      <label class="consent"><input type="checkbox" id="consent" required /><span>我已阅读并同意 <button type="button" class="text-link" data-legal="terms">《用户协议》</button> 和 <button type="button" class="text-link" data-legal="privacy">《隐私政策》</button></span></label>
      <button class="primary-button" type="submit"><span>确认重置密码</span><b>→</b></button>
    </form>
    <p class="form-foot"><button class="text-link" id="back-login">返回登录</button></p>
  `);
  document.querySelectorAll("[data-legal]").forEach(b=>b.addEventListener("click",()=>openLegal(b.dataset.legal)));
  document.querySelector("#close-legal")?.addEventListener("click",()=>document.querySelector("#legal-dialog").close());
  document.querySelector("#back-login")?.addEventListener("click",()=>{disposeCaptcha();mode="login";app.innerHTML=authMarkup();bindAuthEvents();});
  document.querySelector("#send-reset-code")?.addEventListener("click", async()=>{
    const email=document.querySelector("#email").value.trim(), button=document.querySelector("#send-reset-code");
    if(!email.includes("@")){showToast("请输入有效邮箱地址","error");return;}
    if(!window.__qtCaptchaToken){showToast("请先完成人机验证","error");return;}
    button.disabled=true;button.textContent="发送中…";
    try{const r=await fetch("/api/auth/send-code",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,purpose:"reset",captchaToken:window.__qtCaptchaToken})});resetCaptcha();const d=await r.json();if(!r.ok)throw new Error(d.error||"发送失败");let n=60;button.textContent="重新获取 "+n+"s";const t=setInterval(()=>{n--;if(n<=0){clearInterval(t);button.disabled=false;button.textContent="重新获取";}else button.textContent="重新获取 "+n+"s";},1000);window.__qtCaptchaToken="";if(window.turnstile)window.turnstile.reset();showToast("验证码已发送","success");}catch(e){resetCaptcha();button.disabled=false;button.textContent="获取验证码";showToast(e.message,"error");}
  });
  document.querySelector("#reset-form")?.addEventListener("submit",async e=>{
    e.preventDefault();const payload=Object.fromEntries(new FormData(e.currentTarget).entries());
    payload.consent=document.querySelector("#consent").checked;payload.captchaToken=window.__qtCaptchaToken||"";
    if(!payload.consent){showToast("请先阅读并同意用户协议与隐私政策","error");return;}
    if(!/^\d{6}$/.test(payload.code||"")){showToast("请输入 6 位邮箱验证码","error");return;}
    if((payload.password||"").length<8){showToast("新密码至少需要 8 位","error");return;}
    if(!payload.captchaToken){showToast("请先完成人机验证","error");return;}
    const button=e.currentTarget.querySelector(".primary-button");button.disabled=true;button.querySelector("span").textContent="正在安全重置…";
    try{const r=await fetch("/api/auth/reset-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});resetCaptcha();const d=await r.json();if(!r.ok)throw new Error(d.error||"重置失败");showToast("密码重置成功，请使用新密码登录","success");setTimeout(()=>{mode="login";app.innerHTML=authMarkup();bindAuthEvents();},900);}catch(err){resetCaptcha();showToast(err.message,"error");button.disabled=false;button.querySelector("span").textContent="确认重置密码";}
  });
  loadCaptcha();
}

if (location.pathname === "/dashboard") {
  renderDashboard();
} else {
  app.innerHTML = authMarkup();
  bindAuthEvents();
}
