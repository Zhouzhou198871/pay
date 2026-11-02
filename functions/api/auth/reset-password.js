import { hashPassword, hmac, json, normalizeEmail, safeEqual, verifyTurnstile, validEmail } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  try {
    if (!env.AUTH_DB || !env.AUTH_SECRET || !env.TURNSTILE_SECRET_KEY) return json({ error: "账户安全服务尚未完成配置。" }, 503);
    const body = await request.json();
    const email = normalizeEmail(body.email);
    const code = String(body.code || "").trim();
    const password = String(body.password || "");
    if (!validEmail(email)) return json({ error: "请输入有效的邮箱地址。" }, 400);
    if (body.consent !== true) return json({ error: "请先阅读并同意用户协议与隐私政策。" }, 400);
    if (password.length < 8 || password.length > 128) return json({ error: "新密码长度需为 8 至 128 位。" }, 400);
    if (!/^\d{6}$/.test(code)) return json({ error: "请输入 6 位邮箱验证码。" }, 400);
    if (!(await verifyTurnstile(body.captchaToken, env.TURNSTILE_SECRET_KEY, request.headers.get("CF-Connecting-IP") || ""))) return json({ error: "人机验证未通过，请重新验证。" }, 400);
    const otp = await env.AUTH_DB.prepare("SELECT code_hash, expires_at, attempts FROM email_otps WHERE email = ? AND purpose = 'reset'").bind(email).first();
    const now = Math.floor(Date.now() / 1000);
    if (!otp || otp.expires_at < now || otp.attempts >= 5) return json({ error: "验证码已失效，请重新获取。" }, 400);
    const submitted = await hmac(`${email}:${code}`, env.AUTH_SECRET);
    if (!safeEqual(submitted, otp.code_hash)) {
      await env.AUTH_DB.prepare("UPDATE email_otps SET attempts = attempts + 1 WHERE email = ? AND purpose = 'reset'").bind(email).run();
      return json({ error: "验证码不正确，请检查后重试。" }, 400);
    }
    const user = await env.AUTH_DB.prepare("SELECT id FROM users WHERE email = ? AND status = 'active'").bind(email).first();
    if (!user) return json({ error: "该邮箱尚未注册，请检查邮箱地址。" }, 404);
    const passwordHash = await hashPassword(password);
    await env.AUTH_DB.prepare("UPDATE users SET password_hash = ?, terms_accepted_at = ?, terms_version = ?, privacy_version = ? WHERE id = ?")
      .bind(passwordHash, now, "2026-11-02", "2026-11-02", user.id).run();
    await env.AUTH_DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id).run();
    await env.AUTH_DB.prepare("DELETE FROM email_otps WHERE email = ? AND purpose = 'reset'").bind(email).run();
    return json({ success: true, message: "密码已重置，请重新登录。" });
  } catch {
    return json({ error: "密码重置暂时失败，请稍后重试。" }, 500);
  }
}
