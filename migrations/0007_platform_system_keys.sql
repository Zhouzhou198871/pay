CREATE TABLE IF NOT EXISTS platform_system_keys (
 key_name TEXT PRIMARY KEY,
 public_key TEXT NOT NULL,
 private_key_ciphertext TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
