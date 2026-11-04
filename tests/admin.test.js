import test from "node:test";
import assert from "node:assert/strict";
import { adminContext } from "../functions/_lib/admin.js";
import { onRequestPost as markWithdrawalPaid } from "../functions/api/admin/withdrawals/[id]/paid.js";

function mockDb(user, changes = 1) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...values) {
          return {
            first: async () => user,
            run: async () => {
              calls.push({ sql, values });
              return { meta: { changes } };
            }
          };
        }
      };
    }
  };
}

test("admin APIs deny users not explicitly allowlisted", async () => {
  const db = mockDb({ id: "user-1", email: "user@example.com" });
  const request = new Request("https://pay.lynli.me/api/admin/withdrawals", {
    headers: { Cookie: "__Host-qt_session=valid" }
  });
  const result = await adminContext(request, { AUTH_DB: db, ADMIN_USER_IDS: "other-user" });
  assert.equal(result.response.status, 403);
});

test("admin APIs accept only explicitly allowlisted user IDs", async () => {
  const db = mockDb({ id: "admin-1", email: "admin@example.com" });
  const request = new Request("https://pay.lynli.me/api/admin/withdrawals", {
    headers: { Cookie: "__Host-qt_session=valid" }
  });
  const result = await adminContext(request, { AUTH_DB: db, ADMIN_USER_IDS: "admin-1,admin-2" });
  assert.equal(result.user.id, "admin-1");
  assert.equal(result.response, undefined);
});

test("manual payout marks status paid with a unique external reference and no second debit", async () => {
  const db = mockDb({ id: "admin-1", email: "admin@example.com" }, 1);
  const request = new Request("https://pay.lynli.me/api/admin/withdrawals/withdrawal_12345678/paid", {
    method: "POST",
    headers: {
      Cookie: "__Host-qt_session=valid",
      Origin: "https://pay.lynli.me",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ payout_reference: "TX-123456789", note: "已转账" })
  });
  const response = await markWithdrawalPaid({
    request,
    env: { AUTH_DB: db, ADMIN_USER_IDS: "admin-1" },
    params: { id: "withdrawal_12345678" }
  });
  assert.equal(response.status, 200);
  assert.match(db.calls[0].sql, /SET status = 'paid'/);
  assert.match(db.calls[0].sql, /payout_reference = \?/);
  assert.doesNotMatch(db.calls[0].sql, /merchant_ledger|amount_micro\s*=\s*amount_micro\s*-/);
  const payload = await response.json();
  assert.equal(payload.status, "paid");
});
