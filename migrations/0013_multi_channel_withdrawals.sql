-- Multi-channel merchant withdrawals. Monetary values are stored as integer micro-USDT / cents.
ALTER TABLE merchant_withdrawals ADD COLUMN withdraw_type TEXT NOT NULL DEFAULT 'usdt';
ALTER TABLE merchant_withdrawals ADD COLUMN bank_account_info TEXT NOT NULL DEFAULT '';
ALTER TABLE merchant_withdrawals ADD COLUMN fee_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE merchant_withdrawals ADD COLUMN payout_amount_micro INTEGER NOT NULL DEFAULT 0;
ALTER TABLE merchant_withdrawals ADD COLUMN payout_amount_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE merchant_withdrawals ADD COLUMN total_debit_micro INTEGER NOT NULL DEFAULT 0;

UPDATE merchant_withdrawals
SET fee_amount = fee_micro,
    payout_amount_micro = amount_micro,
    total_debit_micro = amount_micro + fee_micro
WHERE total_debit_micro = 0;

CREATE INDEX IF NOT EXISTS idx_merchant_withdrawals_type_status_time
ON merchant_withdrawals(withdraw_type, status, requested_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_merchant_ledger_withdrawal_refund_once
ON merchant_ledger(related_id)
WHERE related_type = 'withdrawal_refund' AND related_id IS NOT NULL;
