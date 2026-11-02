import { createSession, hashPassword, hmac, json, normalizeEmail, randomHex, safeEqual, sessionCookie, validEmail, verifyTurnstile } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  try {
    if (!env.AUTH_DB || !env.AUTH_SECRET || !env.TURNSTILE_SECRET_KEY) return json({ error: "账户服务尚未完成配置。" }, 503);
    const body = await request.json();
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const code = String(body.code || "").trim();
    const consent = body.consent === true;
    if (!(await verifyTurnstile(body.captchaToken, env.TURNSTILE_SECRET_KEY, request.headers.get("CF-Connecting-IP") || "", "register", new URL(request.url).hostname))) return json({ error: "人机验证未通过，请重新验证。" }, 400);
    if (!validEmail(email)) return json({ error: "请输入有效的邮箱地址。" }, 400);
    if (!consent) return json({ error: "请先阅读并同意用户协议与隐私政策。" }, 400);
    if (password.length < 8 || password.length > 128) return json({ error: "密码长度需为 8 至 128 位。" }, 400);
    if (!/^\d{6}$/.test(code)) return json({ error: "请输入 6 位邮箱验证码。" }, 400);

    const otp = await env.AUTH_DB.prepare("SELECT code_hash, expires_at, attempts FROM email_otps WHERE email = ? AND purpose = 'register'").bind(email).first();
    const now = Math.floor(Date.now() / 1000);
    if (!otp || otp.expires_at < now || otp.attempts >= 5) return json({ error: "验证码已失效，请重新获取。" }, 400);
    const submitted = await hmac(`${email}:${code}`, env.AUTH_SECRET);
    if (!safeEqual(submitted, otp.code_hash)) {
      await env.AUTH_DB.prepare("UPDATE email_otps SET attempts = attempts + 1 WHERE email = ? AND purpose = 'register'").bind(email).run();
      return json({ error: "验证码不正确，请检查后重试。" }, 400);
    }

    const existing = await env.AUTH_DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    if (existing) return json({ error: "该邮箱已注册，请直接登录。" }, 409);
    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    await env.AUTH_DB.prepare("INSERT INTO users (id, email, password_hash, created_at, status, display_name, terms_accepted_at, terms_version, privacy_version) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)")
      .bind(userId, email, passwordHash, now, email.split("@")[0], now, "2026-11-02", "2026-11-02").run();
    await env.AUTH_DB.prepare("DELETE FROM email_otps WHERE email = ? AND purpose = 'register'").bind(email).run();
    const token = await createSession(env.AUTH_DB, userId);
    return json({ success: true }, 201, { "Set-Cookie": sessionCookie(token) });
  } catch (error) {
    return json({ error: "注册暂时失败，请稍后重试。" }, 500);
  }
}
