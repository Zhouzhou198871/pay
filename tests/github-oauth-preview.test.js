import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet as startGitHubOAuth } from "../functions/api/auth/github.js";
import { onRequestGet as finishGitHubOAuth } from "../functions/api/auth/github/callback.js";

const PREVIEW_ORIGIN = "https://feat-unified-usdt-recharge.qingtian-pay.pages.dev";
const PREVIEW_CALLBACK = `${PREVIEW_ORIGIN}/api/auth/github/callback`;
const ENV = {
  GITHUB_CLIENT_ID: "preview-client-id",
  GITHUB_CLIENT_SECRET: "test-secret",
  GITHUB_CALLBACK_URL: PREVIEW_CALLBACK,
  AUTH_DB: {}
};

test("Preview GitHub OAuth initiation uses only the configured Preview callback", async () => {
  const request = new Request(`${PREVIEW_ORIGIN}/api/auth/github`);
  const response = await startGitHubOAuth({ request, env: ENV });
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get("Location"));
  assert.equal(location.origin, "https://github.com");
  assert.equal(location.pathname, "/login/oauth/authorize");
  assert.equal(location.searchParams.get("client_id"), "preview-client-id");
  assert.equal(location.searchParams.get("redirect_uri"), PREVIEW_CALLBACK);
  assert.match(response.headers.get("Set-Cookie"), /__Host-qt_oauth_state=/);
});

test("Preview GitHub OAuth fails closed when its callback is not configured", async () => {
  const request = new Request(`${PREVIEW_ORIGIN}/api/auth/github`);
  const response = await startGitHubOAuth({
    request,
    env: { GITHUB_CLIENT_ID: "preview-client-id", GITHUB_CLIENT_SECRET: "test-secret", AUTH_DB: {} }
  });
  assert.equal(response.status, 503);
  assert.match(await response.text(), /回调地址/);
});

test("Preview OAuth callback rejects state on the Preview origin, not Production", async () => {
  const request = new Request(`${PREVIEW_CALLBACK}?code=unused&state=wrong`, {
    headers: { Cookie: "__Host-qt_oauth_state=expected" }
  });
  const response = await finishGitHubOAuth({ request, env: ENV });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("Location"), `${PREVIEW_ORIGIN}/?oauth=failed`);
  assert.match(response.headers.get("Set-Cookie"), /Max-Age=0/);
});

test("OAuth callback rejects a request arriving on a different hostname", async () => {
  const request = new Request("https://pay.lynli.me/api/auth/github/callback?code=unused&state=wrong");
  const response = await finishGitHubOAuth({ request, env: ENV });
  assert.equal(response.status, 400);
  assert.match(await response.text(), /域名与当前环境不匹配/);
});
