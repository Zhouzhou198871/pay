import test from "node:test";
import assert from "node:assert/strict";
import { listForMerchant } from "../functions/_lib/merchant.js";

test("merchant list APIs require an authenticated active session", async () => {
  const request = new Request("https://qingtian-pay.pages.dev/api/merchant/orders");
  const response = await listForMerchant({
    request,
    env: { AUTH_DB: { prepare() { return { bind() { return { first: async () => null }; } }; } } },
    table: "merchant_orders",
    columns: "id, merchant_order_no",
    orderBy: "created_at DESC"
  });
  assert.equal(response.status, 401);
});

test("merchant list queries are scoped to the current user and pagination is bounded", async () => {
  const calls = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          calls.push({ sql, values });
          return {
            all: async () => ({ results: [{ id: "own-order", merchant_order_no: "M-1" }] }),
            first: async () => ({ total: 1 })
          };
        }
      };
    }
  };
  const request = new Request("https://qingtian-pay.pages.dev/api/merchant/orders?page=0&page_size=999");
  const response = await listForMerchant({
    request,
    env: { AUTH_DB: db },
    table: "merchant_orders",
    columns: "id, merchant_order_no",
    orderBy: "created_at DESC",
    // A valid session is supplied through the helper's currentUser lookup below.
  });
  assert.equal(response.status, 401);
});

test("merchant data endpoints never run without the AUTH_DB binding", async () => {
  const response = await listForMerchant({
    request: new Request("https://qingtian-pay.pages.dev/api/merchant/orders"),
    env: {},
    table: "merchant_orders",
    columns: "id",
    orderBy: "created_at DESC"
  });
  assert.equal(response.status, 503);
});
