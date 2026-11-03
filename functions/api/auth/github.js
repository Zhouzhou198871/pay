import { randomHex } from "../../_lib/auth.js";

const CANONICAL_ORIGIN = "https://pay.lynli.me";
const CALLBACK_PATH = "/api/auth/github/callback";
const ALLOWED_CALLBACK_HOSTS = new Set([
  "pay.lynli.me",
  "feat-unified-usdt-recharge.qingtian-pay.pages.dev"
]);

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

export async function onRequestGet({ request, env }) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.AUTH_DB) {
    return new Response("GitHub 一键登录尚未完成配置，请检查 OAuth Client ID、Client Secret 和 AUTH_DB。", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
    });
  }

  let callback;
  try {
    callback = getCallbackUrl(env);
  } catch {
    return new Response("GitHub OAuth 回调地址配置无效。", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
    });
  }
  if (new URL(request.url).origin !== callback.origin) {
    return new Response("当前 Preview 尚未配置对应的 GitHub OAuth 回调地址。", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
    });
  }

  const state = randomHex(24);
  const redirect = new URL("https://github.com/login/oauth/authorize");
  redirect.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  redirect.searchParams.set("redirect_uri", callback.toString());
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
