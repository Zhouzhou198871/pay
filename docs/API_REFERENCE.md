# 晴天支付 API 参考

- 文档版本：1.0
- 更新日期：2026-11-02
- 当前线上环境：`https://pay.lynli.me`
- 协议：HTTPS；请求与响应使用 UTF-8 JSON（OAuth 跳转接口除外）
- 认证方式：同源 HttpOnly Session Cookie
- 当前接口状态以本文“已实现 / 未开放”标记为准

> 本文只描述仓库当前已实现的接口。支付下单、支付网关、支付回调、退款发起、提现申请/审核、商户密钥管理和 Webhook 推送目前尚未开放，不要按规划接口直接集成。

## 1. 通用约定

### Base URL

生产环境：

```text
https://pay.lynli.me
```

所有 API 路径均相对于 Base URL。当前 Functions 使用同源 Cookie 会话，不提供跨域 API 或独立 Bearer Token 接口。

### 请求头

JSON POST 请求：

```http
Content-Type: application/json
Accept: application/json
```

### 成功与错误响应

成功响应按接口返回具体 JSON。错误响应统一采用：

```json
{ "error": "可供调用方展示的错误信息" }
```

常见 HTTP 状态：

| 状态码 | 含义 |
|---|---|
| 200 | 请求成功 |
| 201 | 资源创建成功（当前用于注册） |
| 302 | OAuth 登录跳转 |
| 400 | 参数、验证码、人机验证或用户同意状态不正确 |
| 401 | 未登录或凭据不正确 |
| 404 | 指定账户资源不存在（例如密码重置邮箱未注册） |
| 409 | 资源冲突（例如邮箱已注册） |
| 429 | 发送频率受限 |
| 502 | 上游邮件 / OAuth 服务失败 |
| 503 | 服务配置缺失或数据服务暂不可用 |
| 500 | 未预期的服务端错误 |

响应包含 `Cache-Control: no-store`。客户端不要缓存认证响应、账户数据或验证码操作结果。

## 2. 账户认证 API

### 2.1 获取前端人机验证配置

`GET /api/auth/config`

无需登录。

响应：

```json
{ "siteKey": "TURNSTILE_SITE_KEY 的公开值" }
```

若环境变量未配置，`siteKey` 为空字符串。Site Key 是公开配置，不是 Secret。

### 2.2 发送邮箱验证码

`POST /api/auth/send-code`

无需登录。注册和密码重置共用此接口。

请求：

```json
{
  "email": "developer@example.com",
  "purpose": "register",
  "captchaToken": "Turnstile 返回的 token"
}
```

字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| email | string | 是 | 邮箱地址，服务端会 trim 并转小写 |
| purpose | string | 否 | `register` 或 `reset`；未传或其他值按 `register` 处理 |
| captchaToken | string | 是 | Turnstile token；服务端校验 action、hostname |

规则：
- 同一邮箱、同一用途 60 秒冷却。
- 验证码为 6 位数字，有效期 10 分钟。
- 最多允许 5 次错误尝试。
- 邮件发送失败时会尝试清理本次验证码记录。
- 注册用途和重置用途分别存储，互不混用。

成功响应：

```json
{ "success": true, "message": "验证码已发送。" }
```

常见失败：400 人机验证/邮箱错误；429 冷却中；502 邮件服务拒绝；503 邮件服务配置不完整。

### 2.3 邮箱注册

`POST /api/auth/register`

无需登录。验证码必须先通过 `/api/auth/send-code` 发送。

请求：

```json
{
  "email": "developer@example.com",
  "password": "至少 8 位的密码",
  "code": "123456",
  "consent": true
}
```

字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| email | string | 是 | 有效邮箱 |
| password | string | 是 | 8–128 个字符 |
| code | string | 是 | 6 位邮箱验证码 |
| consent | boolean | 是 | 必须为 `true`，表示同意用户协议和隐私政策 |

成功：HTTP 201，响应 `{ "success": true }`，并设置登录 Session Cookie。注册、验证码消费和会话创建在 D1 batch 中执行，任一步失败不会留下半完成注册。

失败：400 参数/验证码错误；409 邮箱已注册；503 账户服务未配置。

### 2.4 邮箱密码登录

`POST /api/auth/login`

请求：

```json
{
  "email": "developer@example.com",
  "password": "账户密码",
  "captchaToken": "Turnstile token",
  "consent": true
}
```

字段要求：email、password、captchaToken 必填；consent 必须为 true。Turnstile action 为 `login`，hostname 必须与当前请求主机一致。

成功响应 `{ "success": true }`，并设置 Session Cookie。凭据错误统一返回 401。

### 2.5 获取当前登录用户

`GET /api/auth/me`

需要有效 Session Cookie。

成功响应：

```json
{
  "user": {
    "id": "用户 ID",
    "email": "developer@example.com",
    "display_name": "显示名称"
  }
}
```

未登录或会话过期返回 401。

### 2.6 退出登录

`POST /api/auth/logout`

服务端删除当前 Session，并清除 Session Cookie。无需请求体。

成功响应：

```json
{ "success": true }
```

### 2.7 重置密码

第一步：调用 `POST /api/auth/send-code`，设置 `purpose: "reset"` 并完成 Turnstile。

第二步：调用 `POST /api/auth/reset-password`。

请求：

```json
{
  "email": "developer@example.com",
  "code": "123456",
  "password": "新的至少 8 位密码",
  "captchaToken": "新的 Turnstile token",
  "consent": true
}
```

Turnstile action 必须为 `password_reset`。成功后服务端更新密码、删除该用户全部现有 Session，并消费重置验证码；用户需要重新登录。

### 2.8 GitHub OAuth 登录

这是浏览器重定向流程，不是 JSON API。

1. 浏览器访问 `GET /api/auth/github`。
2. 服务端生成随机 state，写入有效期 10 分钟的 HttpOnly、Secure、SameSite=Lax Cookie。
3. 浏览器跳转到 GitHub OAuth 授权页。
4. GitHub 回调到 `GET /api/auth/github/callback`。
5. 服务端校验 state，交换 access token，读取 GitHub 用户资料及已验证邮箱。
6. 成功后创建 Session 并跳转到 `/dashboard`。

OAuth App 配置：

| 设置 | 值 |
|---|---|
| Homepage URL | `https://pay.lynli.me` |
| Authorization callback URL | `https://pay.lynli.me/api/auth/github/callback` |
| Scope | `read:user user:email` |

环境变量：`GITHUB_CLIENT_ID`（Text）和 `GITHUB_CLIENT_SECRET`（Secret）。服务端只接受 GitHub 返回的已验证邮箱；没有已验证邮箱会跳转到 `/?oauth=email-required`。用户取消授权跳转到 `/?oauth=cancelled`；state 或流程失败跳转到 `/?oauth=failed`。

## 3. 商户工作台 API（只读）

以下接口需要已登录的商户 Session Cookie。所有列表查询由服务端从 Session 解析用户 ID，并在 SQL 中强制使用该 ID 过滤；客户端不能通过传入 user_id 切换账户。

### 3.1 分页规则

适用于订单、提现、资金流水、收款通道列表：

`GET /api/merchant/{resource}?page=1&page_size=20`

| 参数 | 类型 | 默认值 | 限制 |
|---|---|---:|---|
| page | integer | 1 | 最小 1，最大 100000 |
| page_size | integer | 20 | 最小 1，最大 50 |

统一响应外形：

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 0,
    "pages": 0
  }
}
```

时间字段为 Unix 时间戳（秒），金额字段为整数微单位。USDT 换算：`USDT = amount_micro / 1000000`。客户端应使用十进制定点或整数运算展示金额，不要用浮点数进行资金记账。

### 3.2 订单列表

`GET /api/merchant/orders`

返回字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string | 内部订单 ID |
| merchant_order_no | string | 商户订单号 |
| subject | string | 订单标题 |
| amount_micro | integer | 金额微单位 |
| currency | string | 币种，当前默认 USDT |
| status | string | pending / paid / failed / cancelled / refunded |
| payment_channel | string / null | 支付通道标识 |
| created_at | integer | 创建时间（秒） |
| paid_at | integer / null | 支付时间（秒） |

### 3.3 提现记录

`GET /api/merchant/withdrawals`

字段：`id`、`request_no`、`amount_micro`、`fee_micro`、`currency`、`destination_masked`、`status`、`requested_at`、`reviewed_at`。

状态：pending / approved / processing / paid / rejected / cancelled。此接口仅查询记录，当前没有提现申请或审核写入接口。

### 3.4 资金流水

`GET /api/merchant/ledger`

字段：`id`、`entry_no`、`direction`（credit / debit）、`amount_micro`、`balance_after_micro`、`currency`、`category`、`description`、`related_type`、`related_id`、`created_at`。

资金流水是账务记录，不是支付渠道实时余额。当前尚未开放入账、出账或余额调整 API。

### 3.5 收款通道列表

`GET /api/merchant/channels`

字段：`id`、`channel_code`、`display_name`、`status`、`created_at`。

状态：pending / active / disabled / rejected。当前仅查询已有通道配置，没有新增、编辑或启用通道 API。

### 3.6 工作台汇总

`GET /api/merchant/summary`

成功响应：

```json
{
  "balance_micro": null,
  "currency": "USDT",
  "today_paid_orders": 0,
  "today_paid_amount_micro": 0,
  "total_orders": 0
}
```

- `balance_micro`：最近一条账本记录的 `balance_after_micro`；没有账本记录时为 null。
- `today_paid_orders` / `today_paid_amount_micro`：当天已支付订单数量及金额。
- `total_orders`：该商户全部订单数。
- 日期边界按服务端 UTC 日起始时间计算。

## 4. 浏览器调用示例

登录后浏览器同源请求会自动携带 Cookie：

```js
const response = await fetch("/api/merchant/orders?page=1&page_size=20", {
  headers: { Accept: "application/json" },
  credentials: "same-origin"
});

if (response.status === 401) {
  // 跳转登录页或提示重新登录
} else if (!response.ok) {
  const error = await response.json();
  throw new Error(error.error || "请求失败");
} else {
  const data = await response.json();
  console.log(data.items, data.pagination);
}
```

注册示例：

```js
const response = await fetch("/api/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email,
    password,
    code,
    consent: true
  })
});
const result = await response.json();
if (!response.ok) throw new Error(result.error || "注册失败");
```

## 5. 会话与安全

- Session Cookie 名称：`__Host-qt_session`。
- 属性：HttpOnly、Secure、SameSite=Lax、Path=/；有效期 30 天。
- 数据库仅保存 Session Token 的 SHA-256 哈希，不保存明文 Token。
- 密码使用 PBKDF2-SHA256（当前 150,000 次迭代）存储。
- OAuth state 使用独立 Cookie，有效期 10 分钟。
- Turnstile 服务端验证必须成功，且 action、hostname 必须匹配；验证失败时接口拒绝请求。
- 不要在日志、工单、前端代码或 Git 仓库中记录密码、验证码、Session Cookie、OAuth Secret、Resend API Key。
- 生产环境只允许 HTTPS。
- 不要把用户传入的 user_id 当作数据授权依据。
- 所有金额在服务端以整数微单位处理；展示层的换算不能成为账务依据。

## 6. 当前未开放能力

以下能力尚无可供第三方调用的正式 API：

- 创建/查询支付意图及生成支付链接
- 支付渠道配置写入、签名密钥管理
- 支付成功/失败异步回调接收、验签及幂等处理
- 退款申请与退款回调
- 提现申请、审批、打款和提现回调
- 商户 API Key、权限范围和密钥轮换
- 对外 Webhook 订阅、签名、重试和事件查询
- 生产账本入账/出账服务

在这些接口发布并提供正式的请求/响应契约前，请勿自行猜测路径、字段或签名规则，也不要将当前只读记录接口当作支付能力。
