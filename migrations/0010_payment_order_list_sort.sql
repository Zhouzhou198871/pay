-- Match the exact stable sort used by the real merchant payment-order list.
CREATE INDEX IF NOT EXISTS idx_payment_orders_merchant_created_id
  ON payment_orders(merchant_id, created_at DESC, id DESC);
