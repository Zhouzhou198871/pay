-- NZZF settlement idempotency, merchant list performance, and auditable manual payouts.
-- Existing balances and records are not rewritten.
CREATE INDEX IF NOT EXISTS idx_payment_orders_merchant_status_created
  ON payment_orders(merchant_id, status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_merchant_ledger_user_currency_time
  ON merchant_ledger(user_id, currency, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_merchant_ledger_payment_order_once
  ON merchant_ledger(related_id)
  WHERE related_type = 'payment_order' AND related_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_merchant_withdrawals_status_requested
  ON merchant_withdrawals(status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_merchant_withdrawals_user_status_time
  ON merchant_withdrawals(user_id, status, requested_at DESC);
ALTER TABLE merchant_withdrawals ADD COLUMN payout_reference TEXT;
ALTER TABLE merchant_withdrawals ADD COLUMN admin_user_id TEXT;
ALTER TABLE merchant_withdrawals ADD COLUMN admin_note TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_merchant_withdrawals_payout_reference
  ON merchant_withdrawals(payout_reference)
  WHERE payout_reference IS NOT NULL AND payout_reference <> '';
