# 开发者接入指南

## 1. 接入前准备

晴天支付当前生产入口：

- 商户工作台：https://pay.lynli.me
- API Base URL：`https://pay.lynli.me`
- API 参考：[API_REFERENCE.md](./API_REFERENCE.md)

当前公开 API 主要覆盖账户认证和商户工作台只读数据。支付下单、收款回调、退款、提现申请及商户 API Key 尚未开放。

## 2. 认证接入

### 推荐方式：浏览器同源 Session

用户通过晴天支付页面登录后，浏览器会收到 HttpOnly Session Cookie。前端调用同源 API 时使用：

```js
fetch("/api/merchant/summary", {
  credentials: "same-origin",
  headers: { Accept: "application/json" }
});
```

不要尝试从 JavaScript 读取 HttpOnly Cookie，也不要把 Session Cookie 放到 URL、日志或第三方分析系统。

### 服务端 / 第三方系统接入限制

当前尚未提供商户 API Key、OAuth client credentials 或服务端 Bearer Token 认证。不要把用户浏览器 Session Cookie 复制到服务器作为长期集成凭证。需要服务端到服务端集成时，应等待正式的商户凭证和权限模型发布。

## 3. 邮箱注册流程

1. 请求 `GET /api/auth/config` 获取 Turnstile Site Key。
2. 在页面上加载 Turnstile，并取得验证码 token。
3. 请求 `POST /api/auth/send-code`，传入邮箱、`purpose: "register"` 和 captchaToken。
4. 用户从邮箱取得 6 位验证码。
5. 请求 `POST /api/auth/register`，提交邮箱、密码、验证码及 `consent: true`。
6. 注册成功后服务端设置 Session Cookie；随后可调用 `GET /api/auth/me` 确认登录用户。

验证码 10 分钟有效、同一邮箱同一用途 60 秒冷却，错误尝试最多 5 次。

## 4. GitHub OAuth 流程

在 GitHub OAuth App 中设置：

- Homepage URL：`https://pay.lynli.me`
- Callback URL：`https://pay.lynli.me/api/auth/github/callback`

在生产环境安全配置 OAuth Client ID 和 Client Secret。前端只需将浏览器导航到：

```js
window.location.assign("/api/auth/github");
```

服务端负责 state 校验、Token 交换、GitHub 已验证邮箱读取和 Session 创建。不要在前端交换 OAuth code，也不要将 Client Secret 暴露给浏览器。

## 5. 查询商户工作台数据

订单、提现、资金流水和收款通道均为只读分页接口。示例：

```js
async function getOrders(page = 1, pageSize = 20) {
  const response = await fetch(
    `/api/merchant/orders?page=${page}&page_size=${pageSize}`,
    { credentials: "same-origin", headers: { Accept: "application/json" } }
  );

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload;
}
```

每个商户只能读取自己 Session 对应的数据。不要向接口传入 user_id 来选择账户。

## 6. 金额和时间处理

- 金额字段以整数微单位返回。USDT 的展示值为 `amount_micro / 1_000_000`。
- 不要使用二进制浮点数执行账务计算；建议用整数或十进制定点库。
- 时间戳单位为秒。展示时可转换为毫秒：`new Date(timestamp * 1000)`。
- 工作台“今日”统计按服务端 UTC 日期边界计算。

## 7. 错误处理建议

- 400：展示字段校验或验证码错误，不要自动无限重试。
- 401：提示用户重新登录。
- 409：提示邮箱已注册等资源冲突。
- 429：遵循服务端返回的等待秒数后再重试。
- 5xx：显示通用错误和可重试提示；不要向终端用户展示内部堆栈。

## 8. 生产安全清单

- 仅使用 HTTPS。
- OAuth Secret、Resend Key、Turnstile Secret 只能放在服务端 Secret 环境变量。
- 不要将验证码、密码、Session Cookie 写入日志。
- 不要在浏览器代码中保存服务端密钥。
- 不要假定当前只读接口支持下单、退款或提现。
- 在正式支付接口发布前，不要把测试环境或本地模拟支付结果当作真实到账。

## 9. 版本与变更

当前文档描述仓库 main 分支中已实现的接口。接口字段、状态枚举或认证方式发生变更时，应同步更新 API 参考、示例和版本说明。未在 API 参考中列出的路径不构成稳定公开 API。
