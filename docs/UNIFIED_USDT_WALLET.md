# Unified USDT Wallet and Recharge Channels

All account balances and wallet ledger amounts are denominated in USDT (6 decimal places).

## Recharge behavior

- **Alipay:** users enter the USDT amount they want credited. The server snapshots `CNY_PER_USDT` when creating the order, converts the requested USDT amount into CNY cents using integer arithmetic, and creates the Alipay order. The callback and the authenticated status endpoint both query the provider server-side and require an exact CNY amount match before crediting the user's USDT wallet.
- **USDT TRC20:** users create a deposit order for the configured TRON address. To attribute transfers when using one shared wallet, the exact transfer quote includes a small unique micro-USDT suffix. The user must send the exact displayed amount within two hours. The suffix is not credited: only the requested base amount is added to the user's wallet. The scanner accepts confirmed transfers to the configured address and token contract, matches the exact quote to an unexpired order, and persists a pagination cursor.
- **Wallet ledger:** each credit has a unique source key. Ledger insertion and wallet balance mutation run in one D1 batch; duplicate callbacks or repeated chain scans cannot credit twice. A paid order can be retried to repair a previously interrupted credit.

## New D1 migrations

Apply in order after migration 0004:

- `migrations/0005_unified_usdt_wallet.sql`
- `migrations/0006_usdt_deposit_matching.sql`
- `migrations/0007_wallet_scan_cursor.sql`

These migrations add a dedicated USDT wallet account, immutable wallet ledger, and recharge order table. They do not rewrite the existing merchant ledger or existing balances.

## Production variables and secrets

Configure in Cloudflare Pages → `qingtian-pay` → Production:

| Name | Type | Purpose |
|---|---|---|
| `CNY_PER_USDT` | Text | Server-side CNY per 1 USDT rate, e.g. a rate supplied by the operator; each order stores a rate snapshot |
| `ALIPAY_PID` | Secret | Alipay-compatible provider merchant ID |
| `ALIPAY_CREATE_URL` | Secret | Provider create-order endpoint |
| `ALIPAY_QUERY_URL` | Secret | Provider query-order endpoint |
| `ALIPAY_PRIVATE_KEY` | Secret | Provider RSA private key |
| `ALIPAY_NOTIFY_URL` | Text | Keep set to `https://pay.lynli.me/api/v1/pay/notify`; this callback handles both legacy merchant orders and wallet top-ups |
| `USDT_TRC20_ADDRESS` | Secret | Operator-controlled TRON receiving address |
| `USDT_TRC20_CONTRACT` | Secret | Official USDT TRC20 contract address on TRON; verify this value before enabling deposits |
| `TRONGRID_API_KEY` | Secret | TronGrid API key (recommended for reliable rate limits) |
| `TRONGRID_API_URL` | Text | Optional; defaults to `https://api.trongrid.io` |
| `USDT_SCAN_SECRET` | Secret | Long random bearer secret for the scanner endpoint |

Do not commit private keys, API keys, wallet secrets, or the scanner bearer token to Git.

## Chain scan scheduling

Call `POST https://pay.lynli.me/api/recharge/usdt/sync` on a short recurring schedule (recommended every minute) with:

```http
Authorization: Bearer <USDT_SCAN_SECRET>
```

The endpoint reads confirmed TRC20 transfers from TronGrid. Configure a Cloudflare Cron Worker or another trusted scheduler to invoke it. Monitor its HTTP status and `credited` / `ignored` counts. The Pages route itself does not create a Cron Trigger automatically.

## API

- `GET /api/wallet/summary` — authenticated USDT balance
- `POST /api/recharge/alipay/create` — body: `{ "amount_usdt": "10.00" }`
- `POST /api/recharge/usdt/create` — body: `{ "amount_usdt": "10.00" }`; returns the exact amount and receiving address
- `GET /api/recharge/status?trade_no=...` — authenticated order status; actively reconciles Alipay pending orders
- `GET /api/recharge/usdt/config` — public configured TRC20 receiving details
- `POST /api/recharge/usdt/sync` — scanner endpoint protected by `USDT_SCAN_SECRET`; processes up to five TronGrid pages per call and resumes from its D1 cursor

## Launch blockers

This code does not become production-ready until both migrations are applied to the production D1 database, all provider and wallet secrets are set, the Alipay sandbox/real test is passed, and the TRC20 Cron scanner is running and verified with a real small-value transfer. Keep recharge traffic disabled until those checks pass.
