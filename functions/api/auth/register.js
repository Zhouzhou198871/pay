import { hashPassword, hmac, json, normalizeEmail, randomHex, safeEqual, sessionCookie, csrfCookie, sha256, validEmail } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  let stage = "configuration";
  let email = "";
  try {
    if (!env.AUTH_DB || !env.AUTH_SECRET) return json({ error: "账户服务尚未完成配置。" }, 503);
    stage = "parse-request";
    const body = await request.json();
    email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const code = String(body.code || "").trim();
    const consent = body.consent === true;
    if (!validEmail(email)) return json({ error: "请输入有效的邮箱地址。" }, 400);
    if (!consent) return json({ error: "请先阅读并同意用户协议与隐私政策。" }, 400);
    if (password.length < 8 || password.length > 128) return json({ error: "密码长度需为 8 至 128 位。" }, 400);
    if (!/^\d{6}$/.test(code)) return json({ error: "请输入 6 位邮箱验证码。" }, 400);

    stage = "read-otp";
    const otp = await env.AUTH_DB.prepare("SELECT code_hash, expires_at, attempts FROM email_otps WHERE email = ? AND purpose = 'register'").bind(email).first();
    const now = Math.floor(Date.now() / 1000);
    if (!otp || otp.expires_at < now || otp.attempts >= 5) return json({ error: "验证码已失效，请重新获取。" }, 400);
    const submitted = await hmac(`${email}:${code}`, env.AUTH_SECRET);
    if (!safeEqual(submitted, otp.code_hash)) {
      await env.AUTH_DB.prepare("UPDATE email_otps SET attempts = attempts + 1 WHERE email = ? AND purpose = 'register'").bind(email).run();
      return json({ error: "验证码不正确，请检查后重试。" }, 400);
    }

    stage = "check-existing-user";
    const existing = await env.AUTH_DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    if (existing) return json({ error: "该邮箱已注册，请直接登录。" }, 409);

    stage = "hash-password";
    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    const token = randomHex(32);
    const tokenHash = await sha256(token);

    // D1 batch is transactional: user creation, OTP consumption and session creation
    // either all commit, or all roll back. This prevents stranded accounts on failure.
    stage = "commit-registration";
    const results = await env.AUTH_DB.batch([
      env.AUTH_DB.prepare("INSERT INTO users (id, email, password_hash, created_at, status, display_name, terms_accepted_at, terms_version, privacy_version) SELECT ?, ?, ?, ?, 'active', ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM email_otps WHERE email = ? AND purpose = 'register' AND code_hash = ? AND expires_at >= ? AND attempts < 5)")
        .bind(userId, email, passwordHash, now, email.split("@")[0], now, "2026-11-02", "2026-11-02", email, otp.code_hash, now),
      env.AUTH_DB.prepare("DELETE FROM email_otps WHERE email = ? AND purpose = 'register' AND code_hash = ? AND expires_at >= ? AND attempts < 5")
        .bind(email, otp.code_hash, now),
      env.AUTH_DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) SELECT ?, id, ?, ? FROM users WHERE id = ?")
        .bind(tokenHash, now + 60 * 60 * 24 * 30, now, userId)
    ]);
    if (!results[0]?.meta?.changes) return json({ error: "验证码已失效，请重新获取。" }, 400);
    if (!results[1]?.meta?.changes || !results[2]?.meta?.changes) throw new Error("registration transaction invariant failed");
    const response = json({ success: true }, 201, { "Set-Cookie": sessionCookie(token) });
    response.headers.append("Set-Cookie", csrfCookie(randomHex(32)));
    return response;
  } catch (error) {
    if (stage === "commit-registration" && env.AUTH_DB) {
      try {
        const existing = await env.AUTH_DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
        if (existing) return json({ error: "该邮箱已注册，请直接登录。" }, 409);
      } catch {
        // Keep the original failure response if the follow-up lookup is unavailable.
      }
    }
    console.error("[auth/register] failed", {
      stage,
      name: String(error?.name || "Error").slice(0, 80),
      message: String(error?.message || "unknown").slice(0, 240)
    });
    return json({ error: "注册暂时失败，请稍后重试。" }, 500);
  }
}
