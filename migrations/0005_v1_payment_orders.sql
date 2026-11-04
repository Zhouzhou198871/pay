-- Extend the existing payment_orders table without replacing its legacy Alipay fields.
-- amount_micro is the exact V1 amount in micro-USDT; status='pending' is the existing
-- internal equivalent of the public V1 status 'unpaid'.
ALTER TABLE payment_orders ADD COLUMN amount_micro INTEGER;
ALTER TABLE payment_orders ADD COLUMN pay_type TEXT;
ALTER TABLE payment_orders ADD COLUMN request_timestamp INTEGER;

CREATE INDEX IF NOT EXISTS idx_payment_orders_v1_created ON payment_orders(merchant_id, created_at DESC);
