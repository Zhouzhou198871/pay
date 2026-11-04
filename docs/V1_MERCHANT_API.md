# 晴天支付 V1 商户接入说明

- 品牌：晴天支付
- API 基础地址：`https://pay.lynli.me`
- 传输协议：HTTPS
- 编码：UTF-8
- 当前版本：商户资料与凭据管理已上线；支付下单 API 尚未发布。

## 1. 商户凭据

在商户中心「个人资料 → API 信息」获取：

| 字段 | 用途 |
|---|---|
| 商户 ID | 唯一标识商户 |
| 商户 MD5 密钥 | 40 位随机十六进制凭据，由平台生成和轮换 |
| 接口地址 | 当前站点的 API 基础地址 |

MD5 密钥属于服务端机密。仅保存在您自己的服务端环境变量或密钥管理系统中。不要将其写入浏览器代码、移动端客户端、日志或公开仓库。重置密钥会立即替换旧值，所有使用旧值的系统都必须同步更新。

## 2. 当前已上线的商户自助接口

以下接口用于商户本人维护资料，需要有效的晴天支付登录 Session Cookie；它们不是第三方支付下单接口。浏览器同源请求应使用 `credentials: "same-origin"`。

### 2.1 读取商户资料

`GET /api/merchant/profile`

成功响应示例：

```json
{
  "user": {
    "id": "当前用户 ID",
    "email": "merchant@example.com",
    "display_name": "商户名称"
  },
  "merchant": {
    "merchant_no": "六位商户号",
    "api_key": "40 位随机密钥",
    "usdt_address": "",
    "usdt_network": "USDT-TRC20",
    "withdraw_password_set": false,
    "status": "pending"
  }
}
```

首次读取时，若当前账户尚无商户记录，服务端会在 D1 中创建待审核商户资料并分配六位商户号与 API 密钥。

### 2.2 修改账户资料

`PATCH /api/merchant/profile`

请求头：

```http
Content-Type: application/json
Accept: application/json
```

请求体：

```json
{
  "action": "account",
  "display_name": "新的商户名称",
  "current_password": "当前登录密码",
  "new_password": "新的登录密码"
}
```

仅修改昵称时可省略密码字段。修改登录密码时必须提供当前密码；新密码长度为 8–128 位。密码使用 PBKDF2-SHA256 加盐哈希保存，不保存明文。

### 2.3 绑定 USDT 提款地址

`PATCH /api/merchant/profile`

请求体：

```json
{
  "action": "payout",
  "usdt_address": "T...",
  "usdt_network": "USDT-TRC20"
}
```

支持网络：`USDT-TRC20`、`USDT-ERC20`、`USDT-BEP20`。服务端会按所选网络检查地址格式，并将地址和网络保存到当前商户记录。提交前请自行核对地址和网络；链上转账通常不可撤销。

### 2.4 设置或修改支付密码

`PATCH /api/merchant/profile`

首次设置请求体：

```json
{
  "action": "withdraw_password",
  "withdraw_password": "至少 8 位的支付密码"
}
```

修改已设置的支付密码时，另需提供 `current_withdraw_password`。未绑定 USDT 提款地址时服务端拒绝设置。支付密码使用 PBKDF2-SHA256 加盐哈希保存，API 不返回密码或哈希值。

### 2.5 轮换 MD5 密钥

`PATCH /api/merchant/profile`

请求体：

```json
{
  "action": "rotate_api_key"
}
```

成功响应会返回一次新生成的 `api_key`。平台数据库只保存当前有效密钥；轮换后旧密钥立即失效。

## 3. 错误响应

统一格式：

```json
{ "error": "错误原因" }
```

常见状态码：

- `200`：操作成功
- `400`：参数或密码校验失败
- `401`：未登录或会话失效
- `403`：请求来源校验失败
- `503`：数据库或商户服务暂不可用

## 4. 支付下单接口状态

当前代码库尚未提供可供外部商户调用的正式 V1 支付下单、支付宝上游路由、异步支付回调验签或退款接口。因此，当前生成的商户 MD5 密钥已真实保存并支持轮换，但尚不能用于支付订单签名调用。不要根据猜测自行拼接支付接口路径或签名字段。

待支付宝上游通道、订单创建字段、金额币种、异步通知地址、幂等规则及签名规范确定后，才可发布正式的 V1 下单契约。此文档不会把尚不存在的支付接口标记为已开放。
