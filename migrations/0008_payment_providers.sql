CREATE TABLE IF NOT EXISTS payment_providers (
  provider TEXT PRIMARY KEY NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
  gateway_url TEXT NOT NULL DEFAULT 'https://openapi.alipay.com/gateway.do',
  updated_at INTEGER NOT NULL
);
INSERT OR IGNORE INTO payment_providers (provider, enabled, gateway_url, updated_at)
VALUES ('alipay', 1, 'https://openapi.alipay.com/gateway.do', unixepoch());
