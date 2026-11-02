-- Cloudflare-native payment core. Existing auth and merchant workspace data is untouched.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS pay_merchants (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  site_name TEXT NOT NULL,
  site_url TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  notify_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','rejected','suspended','revoked')),
  app_id TEXT NOT NULL UNIQUE,
  app_secret_ciphertext TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_pay_merchants_user ON pay_merchants(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pay_merchants_status ON pay_merchants(status, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_orders (
  id TEXT PRIMARY KEY NOT NULL,
  trade_no TEXT NOT NULL UNIQUE,
  merchant_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  out_trade_no TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'CNY',
  method TEXT NOT NULL CHECK (method IN ('alipay')),
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired','cancelled','refunded')),
  provider_trade_no TEXT,
  pay_url TEXT NOT NULL DEFAULT '',
  pay_info TEXT NOT NULL DEFAULT '',
  notify_url TEXT NOT NULL DEFAULT '',
  fee_cents INTEGER NOT NULL DEFAULT 0,
  credit_cents INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  paid_at INTEGER,
  FOREIGN KEY (merchant_id) REFERENCES pay_merchants(id) ON DELETE RESTRICT,
  UNIQUE (merchant_id, out_trade_no)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_provider_trade ON payment_orders(provider_trade_no) WHERE provider_trade_no IS NOT NULL AND provider_trade_no <> '';
CREATE INDEX IF NOT EXISTS idx_payment_orders_pending ON payment_orders(status, method, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_orders_merchant_created ON payment_orders(merchant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY NOT NULL,
  event_key TEXT NOT NULL UNIQUE,
  trade_no TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (trade_no) REFERENCES payment_orders(trade_no) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_payment_events_trade ON payment_events(trade_no, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_webhook_deliveries (
  id TEXT PRIMARY KEY NOT NULL,
  trade_no TEXT NOT NULL,
  target_url TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL,
  last_status_code INTEGER,
  last_error TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  delivered_at INTEGER,
  FOREIGN KEY (trade_no) REFERENCES payment_orders(trade_no) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_due ON payment_webhook_deliveries(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_trade ON payment_webhook_deliveries(trade_no, created_at DESC);
