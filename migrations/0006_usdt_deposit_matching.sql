ALTER TABLE recharge_orders ADD COLUMN expected_micro INTEGER;
ALTER TABLE recharge_orders ADD COLUMN expires_at INTEGER;
DROP INDEX IF EXISTS idx_usdt_pending_exact_amount;
CREATE UNIQUE INDEX IF NOT EXISTS idx_usdt_pending_exact_amount
  ON recharge_orders(expected_micro)
  WHERE channel='usdt_trc20' AND status='pending' AND expected_micro IS NOT NULL;
