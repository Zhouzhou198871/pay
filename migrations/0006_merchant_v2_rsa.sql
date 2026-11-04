-- Per-merchant RSA-2048 credentials for V2 request signing.
-- v2_private_key stores AES-GCM ciphertext only; plaintext is returned only by explicit generate/reset action.
ALTER TABLE pay_merchants ADD COLUMN v2_private_key TEXT;
ALTER TABLE pay_merchants ADD COLUMN v2_public_key TEXT;
ALTER TABLE pay_merchants ADD COLUMN v2_key_created_at INTEGER;
