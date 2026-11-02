# Cloudflare 支付迁移（首阶段）

本分支将晴天支付的商户网关和支付宝支付确认迁入 Cloudflare Pages Functions + D1。旧版 Python 代码仅作为协议兼容参考，不再作为新系统运行时依赖。

## 本阶段包含

- 商户申请、管理员审核、商户资料和回调地址管理
- 兼容旧网关 MD5 参数签名（仅为迁移兼容；新协议应升级 HMAC-SHA256）
- 商户密钥使用 AES-256-GCM 加密后存入 D1
- 支付宝 RSA-SHA256 请求签名，支持 PKCS#8 与传统 PKCS#1 PEM
- 商户下单、查单、收银台状态查询
- 支付回调只作为触发信号；必须向支付服务商主动查单，并匹配金额后才入账
- D1 条件更新和唯一事件键，避免并发重复入账
- 商户通知持久化，单订单唯一通知记录

## 新增 D1 表

执行 `migrations/0004_payment_core.sql`，只创建新表和索引，不修改既有 users、sessions、merchant_orders、merchant_ledger 或余额数据。

- `pay_merchants`
- `payment_orders`
- `payment_events`
- `payment_webhook_deliveries`

## Cloudflare Pages 环境配置

在 Workers & Pages → qingtian-pay → Settings → Variables and Secrets 的 Production 环境设置：

| 名称 | 类型 | 说明 |
|---|---|---|
| `PAY_MERCHANT_MASTER_KEY` | Secret | Base64 编码的 32 字节随机密钥；用于 AES-256-GCM 加密商户 app_secret |
| `PAY_ADMIN_SECRET` | Secret | 管理员审核接口的独立随机密钥 |
| `ALIPAY_PID` | Secret | 支付服务商商户号 |
| `ALIPAY_CREATE_URL` | Secret | 支付服务商创建订单接口 |
| `ALIPAY_QUERY_URL` | Secret | 支付服务商查单接口 |
| `ALIPAY_PRIVATE_KEY` | Secret | RSA 私钥 PEM（PKCS#8 或 PKCS#1）；不得提交到 Git |
| `ALIPAY_NOTIFY_URL` | Text | 固定为 `https://pay.lynli.me/api/v1/pay/notify` |
| `ALIPAY_RETURN_URL` | Text | 支付完成后的 HTTPS 页面地址 |

商户加密主密钥必须备份到独立密码管理器。丢失后无法解密 D1 中的商户 app_secret。轮换时需先实现双密钥解密迁移，不可直接覆盖。

## 接口

- `POST /api/v1/payplat/merchant/apply`：登录用户申请商户；首次响应仅展示一次 app_secret
- `GET /api/v1/payplat/merchant/info`：读取商户资料（不返回密钥）
- `POST /api/v1/payplat/merchant/config`：修改 HTTPS 回调和站点地址
- `GET /api/v1/payplat/merchant/orders`：读取商户订单
- `POST /api/v1/admin/payplat/merchant/review`：Bearer `PAY_ADMIN_SECRET` 审核，body 为 `{ "merchant_id": "...", "action": "approve|reject|suspend|revoke" }`
- `POST /api/v1/payplat/gateway/submit`：兼容旧商户签名参数，当前仅接受 `type=alipay`
- `GET /api/v1/payplat/gateway/query`：签名查单
- `GET /api/v1/payplat/cashier/status?trade_no=...`：收银台状态
- `POST /api/v1/pay/notify`：支付宝通知入口；查单失败、金额不符、订单不存在均拒绝确认

## 迁移边界与未开放项目

- 本阶段**没有启用 USDT/TRC20 链上监听**。旧监听依赖 TronGrid 凭据、地址、确认数、交易哈希唯一性及定时扫描；必须独立迁移和测试后才能开放，当前网关会明确拒绝非支付宝方式。
- 商户通知已持久化，但自动周期重试调度尚需接入 Cloudflare Cron/Queue；单次通知失败会保留记录，不代表已完成自动补偿。
- 本分支不含真实支付服务商凭据；未配置 Secrets 前下单会 fail closed，不会返回虚假的支付成功。
- 不迁移旧 OSS / MySQL / ECS 凭据。旧仓库中暴露的密钥需在原平台轮换。
- 不触碰阿里云爬虫；其 `CRAWLER_OBSERVE=1` 保持原样。

## 上线前验收

1. 在 Cloudflare 设置全部 Secrets。
2. 应用 D1 migration。
3. 在测试环境申请商户并审核通过。
4. 使用服务商沙箱完成下单、异步回调、主动查单、金额不符拒绝、重复回调、并发回调、商户通知失败恢复测试。
5. 为通知补偿配置 Cron/Queue 后，再切换服务商回调到 Cloudflare。
6. 确认旧 ECS 不再收到任何支付流量后，才清理旧支付服务；爬虫服务保持运行。

**严禁在未完成沙箱和生产验收前停掉旧支付通道。**
