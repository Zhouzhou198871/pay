import { createSession, json, normalizeEmail, sessionCookie, validEmail, verifyPassword, verifyTurnstile } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  try {
    if (!env.AUTH_DB || !env.TURNSTILE_SECRET_KEY) return json({ error: "账户服务尚未完成配置。" }, 503);
    const body = await request.json();
    if (body.consent !== true) return json({ error: "请先阅读并同意用户协议与隐私政策。" }, 400);
    if (!(await verifyTurnstile(body.captchaToken, env.TURNSTILE_SECRET_KEY, request.headers.get("CF-Connecting-IP") || "", "login", new URL(request.url).hostname))) return json({ error: "人机验证未通过，请重新验证。" }, 400);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    if (!validEmail(email) || !password) return json({ error: "请输入邮箱和密码。" }, 400);
    const user = await env.AUTH_DB.prepare("SELECT id, password_hash, status FROM users WHERE email = ? LIMIT 1").bind(email).first();
    if (!user || user.status !== "active" || !(await verifyPassword(password, user.password_hash))) {
      return json({ error: "邮箱或密码不正确。" }, 401);
    }
    const now = Math.floor(Date.now() / 1000);
    await env.AUTH_DB.prepare("UPDATE users SET terms_accepted_at = ?, terms_version = ?, privacy_version = ? WHERE id = ?").bind(now, "2026-11-02", "2026-11-02", user.id).run();
    const token = await createSession(env.AUTH_DB, user.id);
    return json({ success: true }, 200, { "Set-Cookie": sessionCookie(token) });
  } catch (error) {
    return json({ error: "登录暂时失败，请稍后重试。" }, 500);
  }
}
