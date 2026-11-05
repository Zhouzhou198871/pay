# 晴天支付 V1 商户接入说明

- 品牌：晴天支付
- API 基础地址：`https://pay.lynli.me`
- 传输协议：HTTPS
- 编码：UTF-8
- 当前版本：V1 签名验签与支付订单创建已上线；支付宝上游支付链接尚未接通。

## 1. 商户凭据

在商户中心「个人资料 → API 信息」获取：

| 字段 | 用途 |
|---|---|
| 商户号（merchant_no） | 六位商户唯一标识 |
| 商户 MD5 密钥（api_key） | 40 位随机十六进制签名密钥 |
| 接口地址 | 当前站点的 API 基础地址 |

MD5 密钥属于服务端机密。仅保存在您自己的服务端环境变量或密钥管理系统中。不要将其写入浏览器代码、移动端客户端、日志或公开仓库。重置密钥会立即替换旧值，所有使用旧值的系统都必须同步更新。

## 2. V1 支付下单

`POST /api/v1/payments`

请求头：

```http
Content-Type: application/json
Accept: application/json
```

请求体：

```json
{
  "merchant_no": "123456",
  "out_trade_no": "ORDER202611040001",
  "amount": "12.50",
  "pay_type": "alipay",
  "notify_url": "https://your-merchant-domain.com/payment/notify",
  "timestamp": "当前 Unix 秒级时间戳",
  "sign": "按下方规则生成的小写 MD5"
}
```

字段说明：

| 字段 | 必填 | 说明 |
|---|---|---|
| merchant_no | 是 | 六位商户号 |
| out_trade_no | 是 | 商户订单号，1–64 位，仅允许字母、数字、`_`、`.`、`:`、`-`；同一商户不可重复 |
| amount | 是 | USDT 金额，大于 0，最多 6 位小数 |
| pay_type | 是 | `alipay` 或 `alipay_h5` |
| notify_url | 是 | HTTPS 公网异步通知地址 |
| timestamp | 是 | Unix 秒级时间戳，与服务器时间相差不得超过 300 秒 |
| sign | 是 | MD5 签名 |

### 2.1 签名规则

1. 将请求参数按参数名 ASCII 字典序升序排列。
2. 排除 `sign`，排除空值；其余参数按原始字符串值参与签名。
3. 拼接为 `key=value&key=value`。
4. 末尾追加 `&key=商户API密钥`。
5. 对完整字符串执行 MD5，结果转为 32 位小写十六进制。

示意：

```text
amount=12.50&merchant_no=123456&notify_url=https://your-merchant-domain.com/payment/notify&out_trade_no=ORDER202611040001&pay_type=alipay&timestamp=当前时间戳&key=你的api_key
```

`sign = MD5(上面完整字符串)`

请在商户服务端生成签名。不要把 api_key 暴露给前端。时间戳校验与商户订单号唯一约束共同防止过期请求和重复建单。

### 2.2 成功响应

HTTP `201`：

```json
{
  "code": "SUCCESS",
  "message": "订单创建成功。",
  "data": {
    "order_id": "平台订单 ID",
    "trade_no": "平台支付流水号",
    "merchant_no": "123456",
    "out_trade_no": "ORDER202611040001",
    "amount": "12.5",
    "currency": "USDT",
    "pay_type": "alipay",
    "status": "unpaid",
    "created_at": 1793750000,
    "expires_at": 1793750900,
    "checkout_url": null
  }
}
```

目前接口已完成商户验签、时间戳检查、订单持久化和商户订单号幂等校验。数据库沿用现有支付订单表：内部 `pending` 状态对应 API 返回的 `unpaid`。由于支付宝上游适配尚未接入，`checkout_url` 当前为 `null`；订单创建成功不代表用户已经获得可支付链接或已付款。

### 2.3 常见错误码

| HTTP | code | 说明 |
|---|---|---|
| 400 | MISSING_PARAMETER | 缺少参数 |
| 400 | TIMESTAMP_EXPIRED | 时间戳无效或超出 5 分钟 |
| 400 | INVALID_AMOUNT | 金额格式不正确 |
| 400 | INVALID_NOTIFY_URL | 通知地址不是有效 HTTPS 公网地址 |
| 401 | MERCHANT_NOT_FOUND | 商户号不存在或未配置密钥 |
| 401 | SIGNATURE_INVALID | 签名验证失败 |
| 409 | ORDER_EXISTS | 商户订单号已存在 |
| 503 | SERVICE_UNAVAILABLE | 支付服务暂不可用 |

## 3. 商户自助资料接口

以下接口用于商户本人维护资料，需要有效的晴天支付登录 Session Cookie；它们不是第三方支付下单接口。浏览器同源请求应使用 `credentials: "same-origin"`。

### 3.1 读取商户资料

`GET /api/merchant/profile`

首次读取时，若当前账户尚无商户记录，服务端会在 D1 中创建待审核商户资料并分配六位商户号与 API 密钥。

### 3.2 修改账户资料

`PATCH /api/merchant/profile`

```json
{
  "action": "account",
  "display_name": "新的商户名称",
  "current_password": "当前登录密码",
  "new_password": "新的登录密码"
}
```

仅修改昵称时可省略密码字段。修改登录密码时必须提供当前密码；新密码长度为 8–128 位。密码使用 PBKDF2-SHA256 加盐哈希保存，不保存明文。

### 3.3 绑定 USDT 提款地址

`PATCH /api/merchant/profile`

```json
{
  "action": "payout",
  "usdt_address": "T...",
  "usdt_network": "USDT-TRC20"
}
```

支持网络：`USDT-TRC20`、`USDT-ERC20`、`USDT-BEP20`。服务端会按所选网络检查地址格式，并将地址和网络保存到当前商户记录。提交前请自行核对地址和网络；链上转账通常不可撤销。

### 3.4 设置或修改支付密码

`PATCH /api/merchant/profile`

```json
{
  "action": "withdraw_password",
  "withdraw_password": "至少 8 位的支付密码"
}
```

修改已设置的支付密码时，另需提供 `current_withdraw_password`。未绑定 USDT 提款地址时服务端拒绝设置。支付密码使用 PBKDF2-SHA256 加盐哈希保存，API 不返回密码或哈希值。

### 3.5 轮换 MD5 密钥

`PATCH /api/merchant/profile`

```json
{ "action": "rotate_api_key" }
```

成功响应会返回一次新生成的 `api_key`。轮换后旧密钥立即失效。

## 4. 尚未开放的业务能力

当前还没有接通支付宝当面付/H5 上游，因此下单接口只创建待支付订单，不会返回真实支付宝收银台链接。异步支付通知发送、上游回调验签、退款以及实际 USDT 提现链上广播也尚未实现。后续会分阶段接入，不应将当前订单创建成功误认为已收款。
