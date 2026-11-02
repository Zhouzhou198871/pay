import { hmac, json, normalizeEmail, validEmail, verifyTurnstile } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  try {
    if (!env.AUTH_DB || !env.RESEND_API_KEY || !env.AUTH_SECRET || !env.MAIL_FROM || !env.TURNSTILE_SECRET_KEY) {
      return json({ error: "邮件服务尚未完成密钥配置，请联系平台管理员。" }, 503);
    }
    const body = await request.json();
    const email = normalizeEmail(body.email);
    const purpose = body.purpose === "reset" ? "reset" : "register";
    if (!(await verifyTurnstile(body.captchaToken, env.TURNSTILE_SECRET_KEY, request.headers.get("CF-Connecting-IP") || "", body.purpose === "reset" ? "password_reset" : "register", new URL(request.url).hostname))) return json({ error: "人机验证未通过，请重新验证。" }, 400);
    if (!validEmail(email)) return json({ error: "请输入有效的邮箱地址。" }, 400);

    const now = Math.floor(Date.now() / 1000);
    const previous = await env.AUTH_DB.prepare("SELECT sent_at FROM email_otps WHERE email = ? AND purpose = ?").bind(email, purpose).first();
    if (previous && now - previous.sent_at < 60) {
      return json({ error: `操作太频繁，请在 ${60 - (now - previous.sent_at)} 秒后重试。` }, 429);
    }

    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    const code = String(bytes[0] % 1000000).padStart(6, "0");
    const codeHash = await hmac(`${email}:${code}`, env.AUTH_SECRET);
    await env.AUTH_DB.prepare("INSERT OR REPLACE INTO email_otps (email, purpose, code_hash, expires_at, attempts, sent_at) VALUES (?, ?, ?, ?, 0, ?)")
      .bind(email, purpose, codeHash, now + 600, now).run();

    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:32px 12px;background:#f3f7fd;font-family:Arial,Helvetica,sans-serif;color:#19375d"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden"><tr><td style="padding:28px 34px;background:#edf5ff;border-bottom:1px solid #e3edf9"><div style="font-size:20px;font-weight:700;color:#173b68">晴天支付</div><div style="font-size:11px;letter-spacing:2px;color:#6d89ad;margin-top:6px">QINGTIAN PAYMENT</div></td></tr><tr><td style="padding:34px"><h1 style="font-size:22px;line-height:1.4;margin:0 0 12px;color:#173b68">邮箱验证码</h1><p style="font-size:14px;line-height:1.8;color:#607793;margin:0 0 24px">您好，您正在进行晴天支付账户验证。请使用以下验证码完成操作：</p><div style="padding:18px 20px;background:#f4f8fe;border:1px solid #e4eefb;border-radius:12px;text-align:center;font-size:32px;font-weight:700;letter-spacing:9px;color:#286fd1">${code}</div><p style="font-size:12px;line-height:1.8;color:#8a9bb1;margin:22px 0 0">验证码 10 分钟内有效。请勿向任何人透露此验证码；如果这不是您的操作，请忽略本邮件。</p></td></tr><tr><td style="padding:18px 34px;background:#fbfcfe;border-top:1px solid #edf1f6;font-size:11px;line-height:1.7;color:#9aa8ba">此邮件由晴天支付系统自动发送，请勿直接回复。<br>© ${new Date().getFullYear()} 晴天支付</td></tr></table></td></tr></table></body></html>`;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [email],
        subject: purpose === "reset" ? "晴天支付｜密码重置验证码" : "晴天支付｜邮箱验证码",
        html,
        text: `您好，您的晴天支付邮箱验证码为：${code}。验证码 10 分钟内有效，请勿向任何人透露。`
      })
    });
    if (!response.ok) {
      await env.AUTH_DB.prepare("DELETE FROM email_otps WHERE email = ? AND purpose = ?").bind(email, purpose).run();
      return json({ error: "邮件发送失败，请稍后重试。" }, 502);
    }
    return json({ success: true, message: "验证码已发送。" });
  } catch (error) {
    return json({ error: "验证码发送暂时不可用，请稍后重试。" }, 500);
  }
}
