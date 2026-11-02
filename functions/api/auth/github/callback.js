import { createSession, hashPassword, json, randomHex, sessionCookie } from "../../../_lib/auth.js";

const clearState = "__Host-qt_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const cookies = request.headers.get("Cookie") || "";
  const expectedState = cookies.match(/(?:^|;\\s*)__Host-qt_oauth_state=([^;]+)/)?.[1];
  const state = url.searchParams.get("state");
  if (!expectedState || !state || expectedState !== state || url.searchParams.get("error")) {
    return Response.redirect(`${url.origin}/?oauth=failed`, 302);
  }
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.AUTH_DB) {
    return new Response("GitHub OAuth 尚未完成配置。", { status: 503, headers: { "Set-Cookie": clearState } });
  }

  try {
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code: url.searchParams.get("code"),
        redirect_uri: `${url.origin}/api/auth/github/callback`
      })
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) throw new Error("OAuth token exchange failed");

    const headers = { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "QingTian-Pay" };
    const [profileResponse, emailResponse] = await Promise.all([
      fetch("https://api.github.com/user", { headers }),
      fetch("https://api.github.com/user/emails", { headers })
    ]);
    if (!profileResponse.ok || !emailResponse.ok) throw new Error("Unable to read GitHub profile");
    const profile = await profileResponse.json();
    const emails = await emailResponse.json();
    const primary = emails.find((item) => item.primary && item.verified) || emails.find((item) => item.verified);
    if (!primary?.email) return Response.redirect(`${url.origin}/?oauth=email-required`, 302);

    const now = Math.floor(Date.now() / 1000);
    const githubId = String(profile.id);
    let user = await env.AUTH_DB.prepare("SELECT id FROM users WHERE github_id = ?").bind(githubId).first();
    if (!user) {
      user = await env.AUTH_DB.prepare("SELECT id FROM users WHERE email = ?").bind(primary.email.toLowerCase()).first();
      if (user) {
        await env.AUTH_DB.prepare("UPDATE users SET github_id = ?, display_name = ? WHERE id = ?")
          .bind(githubId, profile.name || profile.login, user.id).run();
      } else {
        const userId = crypto.randomUUID();
        const oauthPassword = await hashPassword(randomHex(32));
        await env.AUTH_DB.prepare("INSERT INTO users (id, email, password_hash, created_at, status, github_id, display_name) VALUES (?, ?, ?, ?, 'active', ?, ?)")
          .bind(userId, primary.email.toLowerCase(), oauthPassword, now, githubId, profile.name || profile.login).run();
        user = { id: userId };
      }
    }
    const session = await createSession(env.AUTH_DB, user.id);
    const responseHeaders = new Headers({ Location: `${url.origin}/dashboard` });
    responseHeaders.append("Set-Cookie", clearState);
    responseHeaders.append("Set-Cookie", sessionCookie(session));
    return new Response(null, { status: 302, headers: responseHeaders });
  } catch (error) {
    return new Response("GitHub 登录失败，请稍后重试。", { status: 502, headers: { "Content-Type": "text/plain; charset=utf-8", "Set-Cookie": clearState } });
  }
}
