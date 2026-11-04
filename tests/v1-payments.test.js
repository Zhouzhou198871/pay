import test from "node:test";
import assert from "node:assert/strict";
import { md5, signPaymentParams, isFreshTimestamp } from "../functions/_lib/md5.js";

test("MD5 matches standard known vectors", () => {
  assert.equal(md5(""), "d41d8cd98f00b204e9800998ecf8427e");
  assert.equal(md5("abc"), "900150983cd24fb0d6963f7d28e17f72");
  assert.equal(md5("message digest"), "f96b697d7cb7938d525a2f31aaf161d0");
});

test("V1 signature excludes sign and sorts all remaining fields", () => {
  const first = { merchant_no: "123456", out_trade_no: "ORDER-1", amount: "1.25", timestamp: "1790000000", sign: "ignored" };
  const second = { timestamp: "1790000000", amount: "1.25", out_trade_no: "ORDER-1", merchant_no: "123456" };
  assert.equal(signPaymentParams(first, "secret"), signPaymentParams(second, "secret"));
  assert.equal(signPaymentParams(first, "secret"), md5("amount=1.25&merchant_no=123456&out_trade_no=ORDER-1&timestamp=1790000000&key=secret"));
});

test("timestamp is accepted only within five minutes", () => {
  assert.equal(isFreshTimestamp("1790000000", 1790000300), true);
  assert.equal(isFreshTimestamp("1790000000", 1790000301), false);
  assert.equal(isFreshTimestamp("1790000000", 1789999700), true);
  assert.equal(isFreshTimestamp("1790000000", 1789999699), false);
  assert.equal(isFreshTimestamp("1790000000000", 1790000000), false);
});
