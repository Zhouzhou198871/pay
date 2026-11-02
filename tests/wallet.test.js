import test from "node:test";
import assert from "node:assert/strict";
import { parseUsdtMicro, formatUsdt, creditWallet } from "../functions/_lib/wallet.js";

test("USDT amounts parse to integer micro-units", () => {
  assert.equal(parseUsdtMicro("1"), 1000000);
  assert.equal(parseUsdtMicro("1.35"), 1350000);
  assert.equal(parseUsdtMicro("0.000001"), 1);
  assert.equal(parseUsdtMicro("6.900000"), 6900000);
  assert.equal(parseUsdtMicro("1.0000001"), null);
  assert.equal(parseUsdtMicro("-1"), null);
  assert.equal(parseUsdtMicro("0"), null);
});
test("USDT balances format without floating point arithmetic", () => {
  assert.equal(formatUsdt(1350000), "1.35");
  assert.equal(formatUsdt(1), "0.01");
  assert.equal(formatUsdt(1000001), "1.000001");
});

class MemoryD1 {
  accounts = new Map();
  ledger = new Map();
  prepare(sql) {
    const db=this;
    return { bind(...args) {
      return {
        async run() {
          if(sql.startsWith("INSERT OR IGNORE INTO wallet_accounts")) {
            const [userId,now]=args;
            const exists=db.accounts.has(userId);
            if(!exists) db.accounts.set(userId,{balance:0,updatedAt:now});
            return {meta:{changes:exists?0:1}};
          }
          throw new Error("Unexpected SQL run: "+sql);
        },
        async first() {
          if(sql.startsWith("SELECT balance_micro FROM wallet_accounts")) {
            const [userId]=args; return {balance_micro:db.accounts.get(userId)?.balance||0};
          }
          throw new Error("Unexpected SQL first: "+sql);
        },
        sql,args
      };
    }};
  }
  async batch(statements) {
    const results=[];
    for(const statement of statements) {
      const {sql,args}=statement;
      if(sql.startsWith("INSERT OR IGNORE INTO wallet_ledger")) {
        const [id,userId,sourceKey,sourceType,amount,add,description,now,accountId]=args;
        assert.equal(accountId,userId);
        if(this.ledger.has(sourceKey)) { results.push({meta:{changes:0}}); continue; }
        const balance=this.accounts.get(userId).balance;
        this.ledger.set(sourceKey,{id,userId,sourceType,amount,balanceAfter:balance+add,description,now});
        results.push({meta:{changes:1}});
      } else if(sql.startsWith("UPDATE wallet_accounts SET balance_micro=balance_micro+?")) {
        const [amount,now,userId]=args;
        if(Number(results.at(-1)?.meta?.changes)===1) {
          const account=this.accounts.get(userId); account.balance+=amount; account.updatedAt=now;
        }
        results.push({meta:{changes:Number(results.at(-1)?.meta?.changes)===1?1:0}});
      } else throw new Error("Unexpected SQL batch: "+sql);
    }
    return results;
  }
}

test("wallet credit is idempotent for duplicate provider events", async () => {
  const db=new MemoryD1();
  const first=await creditWallet({db,userId:"user-1",sourceKey:"alipay:ORDER-1",sourceType:"alipay_recharge",amountMicro:1250000,description:"test"});
  const duplicate=await creditWallet({db,userId:"user-1",sourceKey:"alipay:ORDER-1",sourceType:"alipay_recharge",amountMicro:1250000,description:"test"});
  assert.equal(first.credited,true);
  assert.equal(duplicate.credited,false);
  assert.equal(first.balanceMicro,1250000);
  assert.equal(duplicate.balanceMicro,1250000);
  assert.equal(db.ledger.size,1);
});
