import { json, randomHex } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return new Response("GitHub 一键登录尚未配置 OAuth App。请先在 GitHub 创建 OAuth App，并在 Cloudflare Pages 设置 GITHUB_CLIENT_ID 与 GITHUB_CLIENT_SECRET。", {
      status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
  const state = randomHex(24);
  const origin = new URL(request.url).origin;
  const redirect = new URL("https://github.com/login/oauth/authorize");
  redirect.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  redirect.searchParams.set("redirect_uri", `${origin}/api/auth/github/callback`);
  redirect.searchParams.set("scope", "read:user user:email");
  redirect.searchParams.set("state", state);
  return new Response(null, {
    status: 302,
    headers: {
      Location: redirect.toString(),
      "Set-Cookie": `__Host-qt_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
    }
  });
}
