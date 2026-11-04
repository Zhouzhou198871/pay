-- Preserve merchant status for reversible administrative suspension.
ALTER TABLE pay_merchants ADD COLUMN suspended_previous_status TEXT;
