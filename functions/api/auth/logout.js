import { expiredSessionCookie, json, sha256 } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  const cookie = request.headers.get("Cookie") || "";
  const token = cookie.match(/(?:^|;\\s*)__Host-qt_session=([^;]+)/)?.[1];
  if (token && env.AUTH_DB) {
    await env.AUTH_DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  }
  return json({ success: true }, 200, { "Set-Cookie": expiredSessionCookie() });
}
