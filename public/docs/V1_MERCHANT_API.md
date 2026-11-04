# 晴天支付 V1 商户接入说明

- API 基础地址：`https://pay.lynli.me`
- 协议：HTTPS，UTF-8 JSON
- 当前状态：商户资料与凭据管理已上线；支付下单 API 尚未发布。

## 商户凭据

在商户中心「个人资料 → API 信息」查看商户 ID 与 40 位 MD5 商户密钥。密钥由平台随机生成并保存，重置后旧密钥立即失效。仅在自己的服务端保存密钥，不要写入浏览器、移动端、日志或公开仓库。

## 商户资料 API（需要登录 Session Cookie）

### 读取资料

`GET /api/merchant/profile`

返回当前登录用户的商户号、API 密钥、USDT 地址、网络、支付密码设置状态。首次访问时，若没有商户记录，系统自动在 D1 创建待审核商户资料并分配六位商户号及密钥。

### 修改昵称或登录密码

`PATCH /api/merchant/profile`

```json
{
  "action": "account",
  "display_name": "商户名称",
  "current_password": "当前密码",
  "new_password": "新密码"
}
```

仅修改昵称可省略密码字段。修改登录密码时必须提供当前密码，新密码长度 8–128 位。

### 保存 USDT 提款地址

`PATCH /api/merchant/profile`

```json
{
  "action": "payout",
  "usdt_address": "T...",
  "usdt_network": "USDT-TRC20"
}
```

支持 `USDT-TRC20`、`USDT-ERC20`、`USDT-BEP20`，服务端会检查地址格式并保存到当前商户记录。请务必核对网络和地址，链上转账通常不可撤销。

### 设置支付密码

`PATCH /api/merchant/profile`

```json
{
  "action": "withdraw_password",
  "withdraw_password": "至少 8 位"
}
```

必须先绑定 USDT 地址。修改已设置的支付密码时，还需提供 `current_withdraw_password`。密码使用 PBKDF2-SHA256 加盐哈希存储，接口不会返回明文或哈希。

### 重置 MD5 商户密钥

`PATCH /api/merchant/profile`

```json
{ "action": "rotate_api_key" }
```

成功时返回新生成的 `api_key`，请立即更新调用方配置。

## 错误响应

```json
{ "error": "错误原因" }
```

- 200：成功
- 400：参数或密码校验失败
- 401：未登录或会话失效
- 403：请求来源校验失败
- 503：数据库或服务不可用

## 支付下单接口状态

当前项目尚未提供可供外部商户调用的正式 V1 支付下单、支付宝上游路由、支付异步回调验签或退款 API。MD5 商户密钥已真实生成、保存并可轮换，但在正式支付订单接口发布前，尚不能用于支付下单签名调用。请勿猜测接口路径、字段或签名规则。

待上游通道、订单字段、费率、回调地址、幂等规则及签名协议确定后，再发布正式下单契约。本文不会将尚不存在的支付能力标记为已开放。
