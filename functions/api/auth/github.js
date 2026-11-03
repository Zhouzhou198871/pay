import { randomHex } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.AUTH_DB) {
    return new Response("GitHub 一键登录尚未完成配置，请检查 OAuth Client ID、Client Secret 和 AUTH_DB。", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
    });
  }

  const origin = new URL(request.url).origin;
  const state = randomHex(24);
  const redirect = new URL("https://github.com/login/oauth/authorize");
  redirect.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  redirect.searchParams.set("redirect_uri", `${origin}/api/auth/github/callback`);
  redirect.searchParams.set("scope", "read:user user:email");
  redirect.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: redirect.toString(),
      "Cache-Control": "no-store",
      "Set-Cookie": `__Host-qt_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
    }
  });
}
