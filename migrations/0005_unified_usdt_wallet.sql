PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS wallet_accounts (
  user_id TEXT PRIMARY KEY NOT NULL,
  balance_micro INTEGER NOT NULL DEFAULT 0 CHECK (balance_micro >= 0),
  currency TEXT NOT NULL DEFAULT 'USDT' CHECK (currency = 'USDT'),
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS wallet_ledger (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  source_key TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL CHECK (source_type IN ('alipay_recharge','usdt_deposit','withdrawal','adjustment')),
  direction TEXT NOT NULL CHECK (direction IN ('credit','debit')),
  amount_micro INTEGER NOT NULL CHECK (amount_micro > 0),
  balance_after_micro INTEGER NOT NULL CHECK (balance_after_micro >= 0),
  currency TEXT NOT NULL DEFAULT 'USDT' CHECK (currency = 'USDT'),
  description TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user_time ON wallet_ledger(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS recharge_orders (
  id TEXT PRIMARY KEY NOT NULL,
  trade_no TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('alipay','usdt_trc20')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired','cancelled')),
  credit_micro INTEGER NOT NULL CHECK (credit_micro > 0),
  fiat_cents INTEGER,
  fiat_currency TEXT,
  fx_rate_micros INTEGER,
  provider_trade_no TEXT,
  tx_hash TEXT,
  tx_event_index INTEGER,
  created_at INTEGER NOT NULL,
  paid_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_recharge_provider_trade ON recharge_orders(provider_trade_no) WHERE provider_trade_no IS NOT NULL AND provider_trade_no <> '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_recharge_chain_event ON recharge_orders(channel, tx_hash, tx_event_index) WHERE tx_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recharge_user_time ON recharge_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recharge_pending_channel ON recharge_orders(channel, status, created_at);

-- Preserve each user's latest pre-existing USDT balance when moving the displayed wallet balance.
INSERT OR IGNORE INTO wallet_accounts (user_id,balance_micro,currency,updated_at)
SELECT ml.user_id,ml.balance_after_micro,'USDT',ml.created_at
FROM merchant_ledger ml
WHERE ml.currency='USDT'
  AND ml.balance_after_micro>=0
  AND ml.id=(
    SELECT prior.id FROM merchant_ledger prior
    WHERE prior.user_id=ml.user_id AND prior.currency='USDT'
    ORDER BY prior.created_at DESC,prior.rowid DESC LIMIT 1
  );

INSERT OR IGNORE INTO wallet_ledger
(id,user_id,source_key,source_type,direction,amount_micro,balance_after_micro,currency,description,created_at)
SELECT 'legacy-opening-'||user_id,user_id,'legacy-opening:'||user_id,'adjustment','credit',
       balance_micro,balance_micro,'USDT','迁移前 USDT 余额结转',updated_at
FROM wallet_accounts WHERE balance_micro>0;
