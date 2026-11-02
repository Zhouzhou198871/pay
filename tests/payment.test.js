import test from "node:test";
import assert from "node:assert/strict";
import { md5, amountToCents, centsToYuan, merchantSign, verifyMerchant } from "../functions/_lib/payment.js";

test("legacy MD5 merchant signature matches RFC test vector", () => {
  assert.equal(md5("abc"), "900150983cd24fb0d6963f7d28e17f72");
});
test("merchant signature is deterministic and rejects tampering", () => {
  const params={app_id:"QT123",out_trade_no:"ORDER-1",money:"12.30",timestamp:"1700000000"};
  params.sign=merchantSign(params,"test-secret");
  assert.equal(verifyMerchant(params,"test-secret"),true);
  assert.equal(verifyMerchant({...params,money:"12.31"},"test-secret"),false);
});
test("money is represented as integer cents without floating point drift", () => {
  assert.equal(amountToCents("1.35"),135);
  assert.equal(amountToCents("6.90"),690);
  assert.equal(amountToCents("0.01"),1);
  assert.equal(amountToCents("1.001"),null);
  assert.equal(amountToCents("-1"),null);
  assert.equal(centsToYuan(135),"1.35");
});
