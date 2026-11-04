-- Store the provider-confirmed fiat amount separately from the merchant's USDT order value.
ALTER TABLE payment_orders ADD COLUMN actual_paid_cents INTEGER;
