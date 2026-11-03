import { createSession, json, normalizeEmail, sessionCookie, validEmail, verifyPassword, verifyTurnstile } from "../../_lib/auth.js";
import { clearLoginFailures, getLoginLock, recordLoginFailure } from "../../_lib/login-attempts.js";

const INVALID_CREDENTIALS = "邮箱或密码不正确。";
// Unknown/inactive accounts still pay the PBKDF2 cost to reduce timing-based enumeration.
const DUMMY_PASSWORD_HASH = `pbkdf2$150000$${"0".repeat(32)}$${"0".repeat(64)}`;

export async function onRequestPost({ request, env }) {
  try {
    if (!env.AUTH_DB || !env.TURNSTILE_SECRET_KEY) return json({ error: "账户服务尚未完成配置。" }, 503);
    const body = await request.json();
    if (body.consent !== true) return json({ error: "请先阅读并同意用户协议与隐私政策。" }, 400);
    if (!(await verifyTurnstile(body.captchaToken, env.TURNSTILE_SECRET_KEY, request.headers.get("CF-Connecting-IP") || "", "login", new URL(request.url).hostname))) return json({ error: "人机验证未通过，请重新验证。" }, 400);

    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    if (!validEmail(email) || !password) return json({ error: "请输入邮箱和密码。" }, 400);

    const now = Math.floor(Date.now() / 1000);
    const lock = await getLoginLock(env.AUTH_DB, email, now);
    if (lock.locked) return json({ error: INVALID_CREDENTIALS }, 401);

    const user = await env.AUTH_DB.prepare("SELECT id, password_hash, status FROM users WHERE email = ? LIMIT 1").bind(email).first();
    const usableHash = user?.status === "active" ? user.password_hash : DUMMY_PASSWORD_HASH;
    const passwordMatches = await verifyPassword(password, usableHash);
    if (!user || user.status !== "active" || !passwordMatches) {
      await recordLoginFailure(env.AUTH_DB, email, now);
      return json({ error: INVALID_CREDENTIALS }, 401);
    }

    await clearLoginFailures(env.AUTH_DB, email);
    await env.AUTH_DB.prepare("UPDATE users SET terms_accepted_at = ?, terms_version = ?, privacy_version = ? WHERE id = ?").bind(now, "2026-11-02", "2026-11-02", user.id).run();
    const token = await createSession(env.AUTH_DB, user.id);
    return json({ success: true }, 200, { "Set-Cookie": sessionCookie(token) });
  } catch (error) {
    return json({ error: "登录暂时失败，请稍后重试。" }, 500);
  }
}
