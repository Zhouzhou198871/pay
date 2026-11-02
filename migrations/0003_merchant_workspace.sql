-- Merchant workspace foundation. Financial values use integer micro-units (1 USDT = 1,000,000).
-- This migration only creates empty tables and indexes; it does not alter existing users or balances.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS merchant_orders (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  merchant_order_no TEXT NOT NULL,
  subject TEXT NOT NULL,
  amount_micro INTEGER NOT NULL CHECK (amount_micro >= 0),
  currency TEXT NOT NULL DEFAULT 'USDT',
  status TEXT NOT NULL CHECK (status IN ('pending','paid','failed','cancelled','refunded')),
  payment_channel TEXT,
  created_at INTEGER NOT NULL,
  paid_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE (user_id, merchant_order_no)
);
CREATE INDEX IF NOT EXISTS idx_merchant_orders_user_created ON merchant_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_merchant_orders_user_status ON merchant_orders(user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS merchant_withdrawals (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  request_no TEXT NOT NULL,
  amount_micro INTEGER NOT NULL CHECK (amount_micro > 0),
  fee_micro INTEGER NOT NULL DEFAULT 0 CHECK (fee_micro >= 0),
  currency TEXT NOT NULL DEFAULT 'USDT',
  destination_masked TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','processing','paid','rejected','cancelled')),
  requested_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE (user_id, request_no)
);
CREATE INDEX IF NOT EXISTS idx_merchant_withdrawals_user_time ON merchant_withdrawals(user_id, requested_at DESC);

CREATE TABLE IF NOT EXISTS merchant_ledger (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  entry_no TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('credit','debit')),
  amount_micro INTEGER NOT NULL CHECK (amount_micro > 0),
  balance_after_micro INTEGER NOT NULL CHECK (balance_after_micro >= 0),
  currency TEXT NOT NULL DEFAULT 'USDT',
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  related_type TEXT,
  related_id TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE (user_id, entry_no)
);
CREATE INDEX IF NOT EXISTS idx_merchant_ledger_user_time ON merchant_ledger(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS merchant_payment_channels (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  channel_code TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','active','disabled','rejected')),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE (user_id, channel_code)
);
CREATE INDEX IF NOT EXISTS idx_merchant_channels_user ON merchant_payment_channels(user_id, created_at DESC);
