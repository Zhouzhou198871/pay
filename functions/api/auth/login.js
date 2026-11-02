import { createSession, json, normalizeEmail, sessionCookie, validEmail, verifyPassword } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  try {
    if (!env.AUTH_DB) return json({ error: "账户服务尚未完成配置。" }, 503);
    const body = await request.json();
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    if (!validEmail(email) || !password) return json({ error: "请输入邮箱和密码。" }, 400);
    const user = await env.AUTH_DB.prepare("SELECT id, password_hash, status FROM users WHERE email = ? LIMIT 1").bind(email).first();
    if (!user || user.status !== "active" || !(await verifyPassword(password, user.password_hash))) {
      return json({ error: "邮箱或密码不正确。" }, 401);
    }
    const token = await createSession(env.AUTH_DB, user.id);
    return json({ success: true }, 200, { "Set-Cookie": sessionCookie(token) });
  } catch (error) {
    return json({ error: "登录暂时失败，请稍后重试。" }, 500);
  }
}
