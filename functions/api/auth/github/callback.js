import { createSession, hashPassword, randomHex, sessionCookie } from "../../../_lib/auth.js";

const CALLBACK_PATH = "/api/auth/github/callback";
const ALLOWED_CALLBACK_HOSTS = new Set([
  "pay.lynli.me",
  "feat-unified-usdt-recharge.qingtian-pay.pages.dev",
  "qingtian-pay.pages.dev"
]);

async function verifySignedState(state, secret) {
  const [nonce, supplied] = String(state || "").split(".");
  if (!nonce || !supplied || !/^[a-f0-9]{48}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(supplied)) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(nonce)));
  const expected = Array.from(signature, (byte) => byte.toString(16).padStart(2, "0")).join("");
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  return mismatch === 0;
}

function getCallbackUrl(env) {
  const value = (env.GITHUB_CALLBACK_URL || "").trim();
  if (!value) throw new Error("Missing GitHub OAuth callback URL");
  const callback = new URL(value);
  if (
    callback.protocol !== "https:" ||
    callback.username ||
    callback.password ||
    callback.pathname !== CALLBACK_PATH ||
    callback.search ||
    callback.hash ||
    !ALLOWED_CALLBACK_HOSTS.has(callback.hostname)
  ) throw new Error("Invalid GitHub OAuth callback URL");
  return callback;
}

function redirect(path, origin) {
  return new Response(null, {
    status: 302,
    headers: { Location: new URL(path, origin).toString(), "Cache-Control": "no-store" }
  });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  let callback;
  try {
    callback = getCallbackUrl(env);
  } catch {
    return new Response("GitHub OAuth 回调地址配置无效。", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
    });
  }

  const origin = callback.origin;
  if (url.searchParams.has("error")) return redirect("/?oauth=cancelled", origin);

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.AUTH_DB) {
    return new Response("GitHub OAuth 尚未完成配置。", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
    });
  }

  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  if (!code || !await verifySignedState(state, env.GITHUB_CLIENT_SECRET)) {
    return redirect("/?oauth=failed", origin);
  }

  try {
    const redirectUri = env.GITHUB_CALLBACK_URL.trim();
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri
      })
    });
    const tokenBody = await tokenResponse.text();
    let tokenData = {};
    try { tokenData = tokenBody ? JSON.parse(tokenBody) : {}; } catch {}
    if (!tokenResponse.ok || !tokenData.access_token) {
      const detail = tokenData.error_description || tokenData.error || tokenBody || "empty response";
      throw new Error(`GitHub access_token 请求失败 (HTTP ${tokenResponse.status}): ${String(detail).slice(0, 500)}`);
    }

    const headers = {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "QingTian-Pay"
    };
    const [profileResponse, emailResponse] = await Promise.all([
      fetch("https://api.github.com/user", { headers }),
      fetch("https://api.github.com/user/emails", { headers })
    ]);
    if (!profileResponse.ok || !emailResponse.ok) {
      const failed = !profileResponse.ok ? profileResponse : emailResponse;
      const detail = await failed.text().catch(() => "");
      throw new Error(`GitHub 用户信息请求失败 (HTTP ${failed.status}): ${detail.slice(0, 500) || failed.statusText}`);
    }

    const profile = await profileResponse.json();
    const emails = await emailResponse.json();
    if (!profile?.id || !Array.isArray(emails)) throw new Error("Invalid GitHub profile response");

    const primary = emails.find((item) => item.primary === true && item.verified === true)
      || emails.find((item) => item.verified === true);
    if (!primary?.email) return redirect("/?oauth=email-required", origin);

    const now = Math.floor(Date.now() / 1000);
    const githubId = String(profile.id);
    const email = primary.email.trim().toLowerCase();
    let user = await env.AUTH_DB.prepare("SELECT id, status FROM users WHERE github_id = ? LIMIT 1").bind(githubId).first();

    if (!user) {
      user = await env.AUTH_DB.prepare("SELECT id, status FROM users WHERE email = ? LIMIT 1").bind(email).first();
      if (user) {
        if (user.status !== "active") return redirect("/?oauth=account-disabled", origin);
        await env.AUTH_DB.prepare(
          "UPDATE users SET github_id = ?, display_name = ? WHERE id = ? AND github_id IS NULL"
        ).bind(githubId, profile.name || profile.login || email.split("@")[0], user.id).run();

        const linked = await env.AUTH_DB.prepare(
          "SELECT id, status, github_id FROM users WHERE id = ? LIMIT 1"
        ).bind(user.id).first();
        if (!linked || linked.status !== "active" || linked.github_id !== githubId) throw new Error("Unable to link GitHub identity");
        user = linked;
      } else {
        const userId = crypto.randomUUID();
        const oauthPassword = await hashPassword(randomHex(32));
        await env.AUTH_DB.prepare(
          "INSERT INTO users (id, email, password_hash, created_at, status, github_id, display_name) VALUES (?, ?, ?, ?, 'active', ?, ?)"
        ).bind(userId, email, oauthPassword, now, githubId, profile.name || profile.login || email.split("@")[0]).run();
        user = { id: userId, status: "active" };
      }
    }

    if (user.status !== "active") return redirect("/?oauth=account-disabled", origin);
    const session = await createSession(env.AUTH_DB, user.id);
    const responseHeaders = new Headers({
      Location: new URL("/dashboard", origin).toString(),
      "Cache-Control": "no-store"
    });
    responseHeaders.append("Set-Cookie", sessionCookie(session));
    return new Response(null, { status: 302, headers: responseHeaders });
  } catch (e) {
    const message = String(e?.message || e || "Unknown GitHub OAuth error").slice(0, 800);
    console.error("[github-oauth-callback] login failed", JSON.stringify({
      message,
      stack: String(e?.stack || "").slice(0, 6000),
      callbackUrl: env.GITHUB_CALLBACK_URL || null
    }));
    return new Response(`GitHub 登录失败: ${message}`, {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
    });
  }
}
