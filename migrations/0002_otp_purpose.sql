-- Separate registration and password-reset codes.
ALTER TABLE email_otps ADD COLUMN purpose TEXT NOT NULL DEFAULT 'register';
CREATE INDEX IF NOT EXISTS idx_email_otps_purpose_expires ON email_otps(purpose, expires_at);
