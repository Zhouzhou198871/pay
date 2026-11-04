-- Merchant profile credentials and payout settings.
-- Safe additive migration; existing merchant/payment rows remain unchanged.
ALTER TABLE pay_merchants ADD COLUMN merchant_no TEXT;
ALTER TABLE pay_merchants ADD COLUMN api_key TEXT;
ALTER TABLE pay_merchants ADD COLUMN usdt_address TEXT;
ALTER TABLE pay_merchants ADD COLUMN usdt_network TEXT NOT NULL DEFAULT 'USDT-TRC20';
ALTER TABLE pay_merchants ADD COLUMN withdraw_password_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pay_merchants_merchant_no ON pay_merchants(merchant_no) WHERE merchant_no IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pay_merchants_api_key ON pay_merchants(api_key) WHERE api_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pay_merchants_user_id ON pay_merchants(user_id);
