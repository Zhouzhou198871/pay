CREATE TABLE IF NOT EXISTS wallet_scan_state (
  scanner_key TEXT PRIMARY KEY NOT NULL,
  fingerprint TEXT,
  updated_at INTEGER NOT NULL
);
