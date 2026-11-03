-- Password-login failure tracking and temporary lockout.
-- Adds only a new table and index; existing auth data is untouched.
CREATE TABLE IF NOT EXISTS login_attempts (
  email TEXT PRIMARY KEY NOT NULL COLLATE NOCASE,
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_locked_until
  ON login_attempts(locked_until);
