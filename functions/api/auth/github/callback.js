import { createSession, hashPassword, randomHex, sessionCookie } from "../../../_lib/auth.js";

const CANONICAL_ORIGIN = "https://pay.lynli.me";
const CALLBACK_PATH = "/api/auth/github/callback";
const ALLOWED_CALLBACK_HOSTS = new Set([
  "pay.lynli.me",
  "feat-unified-usdt-recharge.qingtian-pay.pages.dev"
]);
const clearState = "__Host-qt_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";

function getCallbackUrl(env) {
  const value = env.GITHUB_CALLBACK_URL || `${CANONICAL_ORIGIN}${CALLBACK_PATH}`;
  const callback = new URL(value);
  if (
    callback.protocol !== "https:" ||
    callback.username ||
    callback.password ||
    callback.pathname !== CALLBACK_PATH ||
    callback.search ||
    callback.hash ||
    !ALLOWED_CALLBACK_HOSTS.has(callback.hostname)
  ) {
    throw new Error("Invalid GitHub OAuth callback URL");
  }
  return callback;
}

function redirect(path, origin, cookie = clearState) {
  const headers = new Headers({ Location: new URL(path, origin).toString(), "Cache-Control": "no-store" });
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  let callback;
  try {
    callback = getCallbackUrl(env);
  } catch {
    return new Response("GitHub OAuth 回调地址配置无效。", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Set-Cookie": clearState }
    });
  }
  if (url.origin !== callback.origin) {
    return new Response("GitHub OAuth 回调域名与当前环境不匹配。", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Set-Cookie": clearState }
    });
  }

  const cookies = request.headers.get("Cookie") || "";
  const expectedState = cookies.match(/(?:^|;\s*)__Host-qt_oauth_state=([^;]+)/)?.[1] || "";
  const state = url.searchParams.get("state") || "";
  const code = url.searchParams.get("code") || "";

  if (url.searchParams.has("error")) return redirect("/?oauth=cancelled", callback.origin);
  if (!expectedState || !state || expectedState !== state || !code) {
    return redirect("/?oauth=failed", callback.origin);
  }
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.AUTH_DB) {
    return new Response("GitHub OAuth 尚未完成配置。", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Set-Cookie": clearState }
    });
  }

  try {
    const redirectUri = callback.toString();
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
    const tokenData = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenData.access_token) throw new Error("OAuth token exchange failed");

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
    if (!profileResponse.ok || !emailResponse.ok) throw new Error("Unable to read GitHub profile");
    const profile = await profileResponse.json();
    const emails = await emailResponse.json();
    if (!profile?.id || !Array.isArray(emails)) throw new Error("Invalid GitHub profile response");

    const primary = emails.find((item) => item.primary === true && item.verified === true)
      || emails.find((item) => item.verified === true);
    if (!primary?.email) return redirect("/?oauth=email-required", callback.origin);

    const now = Math.floor(Date.now() / 1000);
    const githubId = String(profile.id);
    const email = primary.email.trim().toLowerCase();
    let user = await env.AUTH_DB.prepare("SELECT id, status FROM users WHERE github_id = ? LIMIT 1")
      .bind(githubId).first();

    if (!user) {
      user = await env.AUTH_DB.prepare("SELECT id, status FROM users WHERE email = ? LIMIT 1")
        .bind(email).first();
      if (user) {
        if (user.status !== "active") return redirect("/?oauth=account-disabled", callback.origin);
        await env.AUTH_DB.prepare("UPDATE users SET github_id = ?, display_name = ? WHERE id = ? AND github_id IS NULL")
          .bind(githubId, profile.name || profile.login || email.split("@")[0], user.id).run();
        const linked = await env.AUTH_DB.prepare("SELECT id, status, github_id FROM users WHERE id = ? LIMIT 1")
          .bind(user.id).first();
        if (!linked || linked.status !== "active" || linked.github_id !== githubId) {
          throw new Error("Unable to link GitHub identity");
        }
        user = linked;
      } else {
        const userId = crypto.randomUUID();
        const oauthPassword = await hashPassword(randomHex(32));
        await env.AUTH_DB.prepare("INSERT INTO users (id, email, password_hash, created_at, status, github_id, display_name) VALUES (?, ?, ?, ?, 'active', ?, ?)")
          .bind(userId, email, oauthPassword, now, githubId, profile.name || profile.login || email.split("@")[0]).run();
        user = { id: userId, status: "active" };
      }
    }

    if (user.status !== "active") return redirect("/?oauth=account-disabled", callback.origin);
    const session = await createSession(env.AUTH_DB, user.id);
    const responseHeaders = new Headers({
      Location: new URL("/dashboard", callback.origin).toString(),
      "Cache-Control": "no-store"
    });
    responseHeaders.append("Set-Cookie", clearState);
    responseHeaders.append("Set-Cookie", sessionCookie(session));
    return new Response(null, { status: 302, headers: responseHeaders });
  } catch {
    return new Response("GitHub 登录失败，请稍后重试。", {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Set-Cookie": clearState }
    });
  }
}
