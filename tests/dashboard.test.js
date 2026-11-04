import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/merchant/dashboard.js";

function makeDb() {
  const calls = [];
  const db = {
    prepare(sql) {
      return {
        sql,
        bind(...values) {
          calls.push({ sql, values });
          return {
            first: async () => {
              if (sql.includes("SELECT users.id")) {
                return { id: "merchant-user-1", email: "owner@example.com", display_name: "晴天商户", username: "晴天商户" };
              }
              return { total_orders: 12, today_orders: 3 };
            },
            all: async () => {
              if (sql.includes("WITH currencies AS")) return { results: [{ currency: "USDT", available_micro: 5000000, pending_micro: 2000000, total_micro: 7000000 }] };
              if (sql.includes("channel_sources AS")) return { results: [{ channel_code: "alipay", display_name: "支付宝", status: "active", today_amount_cents: 1000, yesterday_amount_cents: 500, success_rate: 98.5, fee_rate: 0.8 }] };
              if (sql.includes("WITH RECURSIVE days")) return { results: Array.from({ length: 7 }, (_, i) => ({ day: `2026-11-0${i+1}`, amount_cents: i * 100, orders: i })) };
              return { results: [] };
            }
          };
        }
      };
    }
  };
  return { db, calls };
}

test("dashboard endpoint requires a current authenticated merchant", async () => {
  const response = await onRequestGet({
    request: new Request("https://pay.lynli.me/api/merchant/dashboard"),
    env: { AUTH_DB: { prepare() { return { bind() { return { first: async () => null }; } }; } } }
  });
  assert.equal(response.status, 401);
});

test("dashboard endpoint returns user-scoped D1 summaries, balances, channels and seven daily buckets", async () => {
  const { db, calls } = makeDb();
  const request = new Request("https://pay.lynli.me/api/merchant/dashboard", {
    headers: { Cookie: "__Host-qt_session=valid-session" }
  });
  const response = await onRequestGet({ request, env: { AUTH_DB: db } });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload.user, { display_name: "晴天商户", username: "晴天商户" });
  assert.deepEqual(payload.summary, { total_orders: 12, today_orders: 3 });
  assert.equal(payload.balances[0].total_micro, 7000000);
  assert.equal(payload.channels[0].fee_rate, 0.8);
  assert.equal(payload.trend.days.length, 7);
  assert.equal(payload.trend.total_amount_cents, 2100);
  assert.equal(payload.trend.total_orders, 21);
  const scoped = calls.filter((call) => !call.sql.includes("SELECT users.id"));
  assert.ok(scoped.every((call) => call.values.every((value) => value === "merchant-user-1")));
  assert.match(scoped.find((call) => call.sql.includes("WITH RECURSIVE days")).sql, /DATE\('now', '-6 days'\)/);
});

test("dashboard endpoint fails closed when the D1 aggregation fails", async () => {
  const db = {
    prepare(sql) {
      return {
        bind() {
          return {
            first: async () => sql.includes("SELECT users.id") ? { id: "user-1", email: "a@example.com", display_name: null, username: "a" } : Promise.reject(new Error("D1 unavailable")),
            all: async () => ({ results: [] })
          };
        }
      };
    }
  };
  const response = await onRequestGet({
    request: new Request("https://pay.lynli.me/api/merchant/dashboard", { headers: { Cookie: "__Host-qt_session=valid-session" } }),
    env: { AUTH_DB: db }
  });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /Dashboard 统计/);
});
