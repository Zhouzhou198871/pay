-- V1 merchant payment orders. Amounts are stored in integer micro-USDT.
CREATE TABLE IF NOT EXISTS payment_orders (
  id TEXT PRIMARY KEY NOT NULL,
  merchant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  merchant_no TEXT NOT NULL,
  out_trade_no TEXT NOT NULL,
  amount_micro INTEGER NOT NULL CHECK (amount_micro > 0),
  currency TEXT NOT NULL DEFAULT 'USDT',
  pay_type TEXT NOT NULL CHECK (pay_type IN ('alipay','alipay_h5')),
  notify_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','paid','closed','refunded')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  paid_at INTEGER,
  FOREIGN KEY (merchant_id) REFERENCES pay_merchants(id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE (merchant_id, out_trade_no)
);
CREATE INDEX IF NOT EXISTS idx_payment_orders_merchant_created ON payment_orders(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status_expiry ON payment_orders(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_payment_orders_user_created ON payment_orders(user_id, created_at DESC);
