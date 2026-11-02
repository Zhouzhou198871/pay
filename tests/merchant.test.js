import test from "node:test";
import assert from "node:assert/strict";
import { listForMerchant } from "../functions/_lib/merchant.js";

test("merchant list APIs require an authenticated active session", async () => {
  const request = new Request("https://qingtian-pay.pages.dev/api/merchant/orders");
  const response = await listForMerchant({ request, env: { AUTH_DB: { prepare() { return { bind() { return { first: async () => null }; } }; } } }, table: "merchant_orders", columns: "id", orderBy: "created_at DESC" });
  assert.equal(response.status, 401);
});

test("merchant list queries are scoped to the current user and pagination is bounded", async () => {
  const calls = [];
  const db = { prepare(sql) { return { bind(...values) { calls.push({ sql, values }); return { all: async () => ({ results: [{ id: "own-order" }] }), first: async () => sql.includes("SELECT users.id") ? { id: "user-A", email: "a@example.com", display_name: "A" } : { total: 1 } }; } }; } };
  const request = new Request("https://qingtian-pay.pages.dev/api/merchant/orders?page=0&page_size=999", { headers: { Cookie: "__Host-qt_session=test-session-token" } });
  const response = await listForMerchant({ request, env: { AUTH_DB: db }, table: "merchant_orders", columns: "id", orderBy: "created_at DESC" });
  assert.equal(response.status, 200);
  assert.equal(calls.length, 2);
  assert.ok(calls[0].sql.includes("WHERE user_id = ?"));
  assert.equal(calls[0].values[0], "user-A");
  assert.equal(calls[0].values[1], 50);
  assert.equal(calls[0].values[2], 0);
  assert.equal(calls[1].values[0], "user-A");
  const payload = await response.json();
  assert.equal(payload.items[0].id, "own-order");
  assert.equal(payload.pagination.page_size, 50);
});

test("merchant data endpoints fail closed without AUTH_DB", async () => {
  const response = await listForMerchant({ request: new Request("https://qingtian-pay.pages.dev/api/merchant/orders"), env: {}, table: "merchant_orders", columns: "id", orderBy: "created_at DESC" });
  assert.equal(response.status, 503);
});
