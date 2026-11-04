# 晴天支付

晴天支付商户服务平台，使用 Vite + Cloudflare Pages Functions + Cloudflare D1。

## 开发者文档

- [开发者接入指南](docs/DEVELOPER_GUIDE.md)：认证接入、GitHub OAuth、数据查询、错误处理与安全建议。
- [API 接口参考](docs/API_REFERENCE.md)：已实现接口的路径、参数、响应字段、状态码和限制。\n- [Firebase / Firestore 接入规范](docs/FIREBASE_FIRESTORE_GUIDE.md)：官方文档索引、Cloudflare Workers REST 接入、安全边界与上线检查。
- 生产 API Base URL：`https://pay.lynli.me`

**接口状态说明：** 当前已实现账户认证、商户订单/资金明细查询、V1/V2 支付下单、NZZF RSA 回调验签与幂等入账、提现申请及受限管理员打款状态接口。退款、完整后台 UI 与自动链上打款仍未开放；请勿把未实现能力视为可调用接口。

晴天支付的登录与注册基础工程，使用 Vite + Cloudflare Pages Functions + D1。

## 已接入

- 晴天支付品牌登录 / 注册界面，使用仓库内的 `logo.png`
- 邮箱注册：6 位验证码、10 分钟有效期、60 秒发送冷却、错误次数限制
- 密码使用 PBKDF2-SHA256 保存，登录态使用 HttpOnly + Secure Cookie
- GitHub OAuth 登录回调（需要配置 OAuth App）
- Cloudflare D1 用户、验证码与会话表，建表 SQL 保存在 `migrations/0001_auth.sql`
- Resend 事务邮件模板，发件人统一为 `晴天支付 <no-reply@lynli.me>`
- GitHub Actions 在推送到 `main` 和 Pull Request 时执行后端语法检查、认证基础测试和 Vite 构建
- Cloudflare Pages 连接 GitHub `main` 分支后，可在每次提交时自动构建和部署

## 运行环境

Cloudflare Pages 项目：`qingtian-pay`  
线上预览域名：`https://pay.lynli.me`  
D1 数据库：`qingtian-pay-auth`（APAC）  
D1 binding：`AUTH_DB`

### 初始化 D1 数据库

首次启用认证前，在 Cloudflare D1 控制台选择 `qingtian-pay-auth`，执行仓库中的 `migrations/0001_auth.sql`。

也可以在已登录 Cloudflare 的本地环境执行：

```bash
npx wrangler d1 execute qingtian-pay-auth --remote --file=migrations/0001_auth.sql
```

迁移使用 `CREATE TABLE IF NOT EXISTS`，重复执行不会覆盖现有用户数据。确认 Pages 项目的 D1 binding 名称为 `AUTH_DB`，并指向 `qingtian-pay-auth`。

### 必须配置的变量与密钥

在 Cloudflare Dashboard → Workers & Pages → qingtian-pay → Settings → Variables and Secrets 中配置：

| 变量 | 类型 | 用途 |
|---|---|---|
| `RESEND_API_KEY` | Secret | Resend 仅发送权限 API Key，限制到 `lynli.me` |
| `AUTH_SECRET` | Secret | 用于验证码 HMAC 的随机密钥 |
| `MAIL_FROM` | Text | 必须设置为 `晴天支付 <no-reply@lynli.me>` |
| `GITHUB_CLIENT_ID` | Text | GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | Secret | GitHub OAuth App Client Secret |

邮箱验证码接口要求 `AUTH_DB`、`RESEND_API_KEY`、`AUTH_SECRET` 和 `MAIL_FROM` 全部存在；缺少任意一项都会拒绝发送验证码。不要把 API Key、OAuth Secret 或本地密钥写进代码或提交到 Git。

### Resend

Resend 中 `lynli.me` 需要处于已验证且 Sending 已启用状态。创建一个 `sending_access` API Key，并限制发件域名为 `lynli.me`，保存为 Cloudflare Pages 的 `RESEND_API_KEY` Secret。

### GitHub 一键登录

在 GitHub Developer Settings → OAuth Apps 创建 OAuth App：

- Homepage URL：`https://pay.lynli.me`
- Authorization callback URL：`https://pay.lynli.me/api/auth/github/callback`
- Scope：应用会请求 `read:user` 与 `user:email`

将 Client ID 和 Client Secret 设置为上述 Pages 环境变量。配置完成后 GitHub 登录按钮即可走真实 OAuth 流程。

## 本地开发与验证

```bash
npm install
npm run dev
```

提交前可运行：

```bash
npm run check
npm test
npm run build
```

本地 Functions 需要通过 Wrangler / Cloudflare Pages 本地环境绑定 D1，并在本地密钥文件中配置服务变量。不要把本地密钥文件提交到 Git。

## 重要说明

当前交付范围是账户认证基础。商户入驻审核、支付订单、支付宝 / USDT 渠道、分账与结算均未在本次登录注册版本中开放。协议文案是产品初稿，上线前应按实际经营主体、服务地区和支付业务合规要求审阅完善。


## 登录安全配置

登录、注册、验证码发送和密码找回均启用 Cloudflare Turnstile 服务端校验。请在 Cloudflare Dashboard 为此站点创建 Turnstile Widget，并将以下变量配置到 Pages 的 Production 环境：

- `TURNSTILE_SITE_KEY`：公开 Site Key
- `TURNSTILE_SECRET_KEY`：私密 Secret Key（使用 Secret 类型）

配置完成后重新部署。未配置这两个变量时，人机验证会拒绝通过，认证接口不会降级为无验证模式。

登录、注册及密码找回均要求明确勾选《用户协议》和《隐私政策》。忘记密码通过邮箱验证码重置；重置成功后会撤销该账户的现有登录会话。

## NZZF 支付与回调配置

Cloudflare Pages Production 环境需配置：

| 变量 | 类型 | 说明 |
|---|---|---|
| `NZZF_PID` | Text | NZZF 商户 PID |
| `NZZF_MERCHANT_PRIVATE_KEY` | **Secret** | 商户 RSA 私钥，WebCrypto PKCS#8 PEM（`BEGIN PRIVATE KEY`） |
| `NZZF_PLATFORM_PUBLIC_KEY` | Text | NZZF 平台 RSA 公钥（SPKI） |
| `NZZF_USDT_CNY_RATE` | Text | USDT/CNY 折算汇率 |
| `NZZF_FEE_RATE_BPS` | Text | 手续费基点，50 表示 0.50% |
| `NZZF_API_URL` | Text | 可选，默认 `https://nzzf.org` |
| `NZZF_TIMEOUT_MS` | Text | 可选，上游请求超时，默认 12000 |
| `ADMIN_USER_IDS` | Text | 可选逗号分隔的后台管理员用户 ID，启用提现管理 API 必须配置 |

不要将私钥粘贴到聊天、仓库、构建变量明文或日志中；只在 Cloudflare Production 的 Secret 类型中设置。私钥须为 PKCS#8 PEM，平台公钥须为 SPKI PEM 或其 Base64 主体。配置后重新部署。

### 管理员提现处理

当前没有独立后台管理页面，提供受 `ADMIN_USER_IDS` 白名单保护的管理 API：

- `GET /api/admin/withdrawals?status=pending&page=1&page_size=50`：查看待处理提现。
- `POST /api/admin/withdrawals/{id}/paid`：标记已打款，JSON 必须提供 `payout_reference`（链上交易哈希或外部打款凭证编号），可选 `note`。

管理员 ID 可在 D1 中按商户登录邮箱查询：`SELECT id,email FROM users WHERE email = '你的登录邮箱';`。请只把实际受信任的管理员 ID 加入白名单。提现申请创建时已从可用余额扣除；标记已打款只推进状态并记录凭证，不会再次扣款。
