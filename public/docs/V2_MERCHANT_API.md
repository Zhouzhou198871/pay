# 晴天支付 V2 商户接入说明

- API 基础地址：`https://pay.lynli.me`
- 下单接口：`POST /api/v2/payments`
- 签名算法：SHA256withRSA（RSASSA-PKCS1-v1_5 + SHA-256）
- 签名编码：标准 Base64

## 1. RSA 密钥

在商户中心「个人资料 → API 信息 → V2 接口」生成 RSA-2048 密钥对：

- **商户私钥**：商户服务端用于请求签名。生成或重置时仅展示一次，请立即保存到服务端密钥管理系统；不要放入浏览器、App、前端代码或日志。
- **商户公钥**：平台保存并用于验证商户请求签名，可在商户中心查看和复制。
- 平台在数据库中仅保存 AES-GCM 加密后的私钥副本及明文公钥；个人资料读取接口不会返回私钥明文。
- 重置密钥会立即使旧密钥失效，需同步更新商户服务端配置。

私钥格式为 PKCS#8 PEM，公钥格式为 SubjectPublicKeyInfo（SPKI）PEM。

## 2. 请求参数

`POST /api/v2/payments`，请求头 `Content-Type: application/json`。

| 参数 | 必填 | 说明 |
|---|---|---|
| merchant_no | 是 | 六位商户号 |
| out_trade_no | 是 | 商户订单号，1–64 位字母、数字、`_ . : -`，同商户不可重复 |
| amount | 是 | USDT 金额，大于 0，最多 6 位小数 |
| pay_type | 是 | `alipay` 或 `alipay_h5` |
| notify_url | 是 | HTTPS 公网异步通知地址 |
| timestamp | 是 | 10 位 Unix 秒级时间戳，与服务器时间差不超过 300 秒 |
| sign | 是 | 对其他参数签名后得到的 Base64 字符串 |

请求示例（`sign` 为示意值）：

```json
{
  "merchant_no": "123456",
  "out_trade_no": "ORDER202611040001",
  "amount": "12.50",
  "pay_type": "alipay",
  "notify_url": "https://merchant.example.com/payment/notify",
  "timestamp": "1793750000",
  "sign": "BASE64_SIGNATURE"
}
```

## 3. V2 签名规则

1. 取所有 POST 参数，排除 `sign` 字段；其他字段均参与签名（包括空字符串字段）。
2. 按参数名 ASCII 字典序升序排列。
3. 每个参数按 `key=value` 格式拼接，参数之间使用 `&`，不添加额外空格、不进行 URL 编码。
4. 使用商户 RSA 私钥执行 SHA256withRSA，即 RSASSA-PKCS1-v1_5 + SHA-256。
5. 将签名原始字节使用标准 Base64 编码，填入 `sign`。

示例待签名字符串：

```text
amount=12.50&merchant_no=123456&notify_url=https://merchant.example.com/payment/notify&out_trade_no=ORDER202611040001&pay_type=alipay&timestamp=1793750000
```

签名必须在商户服务端生成。请确保签名字符串的字段值与实际提交的 JSON 字段值完全一致。

### Node.js 签名示例

```js
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const privateKey = readFileSync('./merchant-private.pem', 'utf8');
const params = {
  merchant_no: '123456',
  out_trade_no: 'ORDER202611040001',
  amount: '12.50',
  pay_type: 'alipay',
  notify_url: 'https://merchant.example.com/payment/notify',
  timestamp: String(Math.floor(Date.now() / 1000))
};
const canonical = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
const signer = createSign('RSA-SHA256');
signer.update(canonical, 'utf8');
signer.end();
params.sign = signer.sign(privateKey, 'base64');
// POST params as JSON to https://pay.lynli.me/api/v2/payments
```

## 4. 支付宝通道配置与下单

V2 已接入支付宝开放平台标准 RSA2 网关请求组装。系统使用服务端 `ALIPAY_PRIVATE_KEY` 对 `alipay.trade.page.pay`（PC）或 `alipay.trade.wap.pay`（H5）请求签名，返回支付宝官方网关 URL；不会在浏览器端暴露应用私钥。

Cloudflare Pages 生产环境需要配置以下变量：

| 变量 | 说明 |
|---|---|
| `ALIPAY_APP_ID` | 支付宝开放平台应用 App ID |
| `ALIPAY_PRIVATE_KEY` | 应用 RSA 私钥，PKCS#8 PEM |
| `ALIPAY_NOTIFY_URL` | 平台支付宝异步通知接收地址（HTTPS） |
| `ALIPAY_USDT_CNY_RATE` | 1 USDT 对应的 CNY 计价汇率 |
| `ALIPAY_RETURN_URL` | 可选，同步跳转地址 |
| `ALIPAY_GATEWAY_URL` | 可选，默认官方生产网关 |

通道启用状态由 D1 的 `payment_providers` 表管理。支付宝订单以 USDT 记录；提交支付宝的 `total_amount` 使用 `amount × ALIPAY_USDT_CNY_RATE` 换算并四舍五入到分。未配置 App ID、私钥、通知地址或汇率时，接口返回 `ALIPAY_CONFIG_MISSING` 和缺少的变量清单，不会创建一个没有支付链接的假订单。开发联调可使用官方沙箱网关 `https://openapi.alipaydev.com/gateway.do`。

注意：当前代码负责生成真实支付宝标准网关签名 URL；要完成资金到账闭环，还需配置真实应用密钥与回调地址，并接入支付宝异步通知验签、订单状态更新及平台签名通知投递。

## 5. 响应

成功时返回 HTTP `201`，订单内部状态为待支付，API 状态为 `unpaid`。已配置支付宝环境变量时返回真实支付宝官方网关签名 URL；未配置时返回 `ALIPAY_CONFIG_MISSING`，不会创建无链接订单。

```json
{
  "code": "SUCCESS",
  "message": "订单创建成功。",
  "data": {
    "order_id": "平台订单 ID",
    "trade_no": "平台流水号",
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

同一商户的 `out_trade_no` 唯一，重复下单返回 HTTP `409` / `ORDER_EXISTS`。时间戳超出 5 分钟返回 `TIMESTAMP_EXPIRED`，签名错误返回 `SIGNATURE_INVALID`。

## 6. 平台异步通知签名与商户验签

平台回调使用全局平台 RSA-2048 密钥对。商户中心「个人资料 → API 信息 → 平台回调验签公钥」展示平台公钥，所有商户共用此公钥。

- 平台私钥存储于 D1 系统配置表 `platform_system_keys`，使用 `AUTH_SECRET` 经 AES-256-GCM 加密；只在服务端解密签名。
- 平台公钥为 SPKI PEM，可公开给商户。算法为 SHA256withRSA（RSASSA-PKCS1-v1_5 + SHA-256），签名为标准 Base64。
- 待签名参数排除 `sign` 与 `sign_type`，忽略 null/undefined，按参数名 ASCII 字典序排序，再以 `key=value` 和 `&` 拼接。
- 回调含 `sign_type=RSA2` 与 `sign=<Base64>`。商户必须先验签，再核对商户号、平台订单号、商户订单号、金额及最终状态。

Node.js 验签示例：

```js
import { createVerify } from 'node:crypto';
import { readFileSync } from 'node:fs';
const platformPublicKey = readFileSync('./platform-public.pem', 'utf8');
const callback = { merchant_no:'123456', trade_no:'QT...', out_trade_no:'ORDER...', amount:'12.50', status:'paid', timestamp:'1793750000', sign_type:'RSA2', sign:'BASE64_SIGNATURE' };
const canonical = Object.keys(callback).filter(k => !['sign','sign_type'].includes(k) && callback[k] != null).sort().map(k => `${k}=${callback[k]}`).join('&');
const verifier = createVerify('RSA-SHA256'); verifier.update(canonical,'utf8'); verifier.end();
if (!verifier.verify(platformPublicKey,callback.sign,'base64')) throw new Error('平台回调签名无效');
// 验签成功后再核对订单金额、商户号、订单号与状态。
```

资料 GET 接口返回 `platform_public_key`；平台私钥绝不通过 API 返回。

## 7. 关于平台响应签名

当前 V2 已实现商户私钥请求签名和平台使用商户公钥验签。若要让商户验证平台响应数据，还需要独立的平台 RSA 签名密钥对：平台私钥仅由平台保管，平台公钥公开给商户。商户私钥不能兼作平台响应签名私钥。平台响应签名将在独立的平台密钥配置完成后提供。

## 8. 当前业务边界

V2 接口当前实现 RSA 验签、时间戳校验、商户订单号幂等和待支付订单创建。支付宝上游、支付链接、异步通知投递与支付宝支付状态回调尚未接通；平台回调 RSA 签名能力和商户验签规范已就绪，通知投递接入时调用服务端 `signPlatformCallback`。

## 支付宝异步通知与账本入账

支付宝异步通知地址：\`POST https://pay.lynli.me/api/v1/payments/alipay/notify\`。

Production 必须配置：\`ALIPAY_APP_ID\`、\`ALIPAY_PRIVATE_KEY\`、\`ALIPAY_PUBLIC_KEY\`、\`ALIPAY_SELLER_ID\`、\`ALIPAY_NOTIFY_URL\`、\`ALIPAY_USDT_CNY_RATE\`、\`ALIPAY_FEE_RATE_BPS\`。应用私钥仅用于平台请求签名；回调验签必须使用支付宝公钥。

回调接收 \`application/x-www-form-urlencoded\`。平台排除 \`sign\` 与 \`sign_type\`，对表单解码后的其他非空参数按键名 ASCII 升序拼接，以 RSA2 / SHA-256 验签。验签后核对 App ID、Seller ID、本地订单、支付宝人民币实付金额和支付宝交易号。仅 \`TRADE_SUCCESS\` 与 \`TRADE_FINISHED\` 入账。重复通知不重复生成账本流水。处理成功（包括有效非成功状态及已处理重复通知）响应体严格为纯文本 \`success\`；校验失败返回 \`failure\`。

手续费使用 \`ALIPAY_FEE_RATE_BPS\`，单位为基点（100 bps = 1%），例如 \`100\` 表示 1%，\`0\` 表示不收手续费。净入账金额 = 订单 USDT 金额 - 手续费。手续费率必须显式配置，允许值为 0–10000。

