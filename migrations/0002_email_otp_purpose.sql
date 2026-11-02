-- Upgrade email OTP storage to keep registration and password-reset codes independently.
-- Existing pending codes are retained.
ALTER TABLE email_otps RENAME TO email_otps_legacy;
CREATE TABLE email_otps (
  email TEXT NOT NULL COLLATE NOCASE,
  purpose TEXT NOT NULL CHECK (purpose IN ('register', 'reset')),
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at INTEGER NOT NULL,
  PRIMARY KEY (email, purpose)
);
INSERT INTO email_otps (email, purpose, code_hash, expires_at, attempts, sent_at)
SELECT email, COALESCE(purpose, 'register'), code_hash, expires_at, attempts, sent_at
FROM email_otps_legacy;
DROP TABLE email_otps_legacy;
CREATE INDEX IF NOT EXISTS idx_email_otps_expires_at ON email_otps(expires_at);
