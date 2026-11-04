-- Global admin order listing is sorted by creation time across all merchants.
CREATE INDEX IF NOT EXISTS idx_payment_orders_global_created_id ON payment_orders(created_at DESC, id DESC);
