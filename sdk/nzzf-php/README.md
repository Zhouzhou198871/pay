# 晴天支付 · NZZF V2 PHP SDK

> 由晴天支付根据已提供的 NZZF V2 接口规范实现的兼容 SDK。它不是 NZZF 官方发行包，也未包含未提供文档的支付下单、代付接口。

## 环境要求

- PHP 7.4+
- OpenSSL 扩展
- cURL 扩展

## 安装

将 `sdk/nzzf-php` 放入项目，或在此目录执行：

```bash
composer dump-autoload
```

## 配置

复制配置模板：

```bash
cp epay.config.example.php epay.config.php
```

填写商户后台 API 信息中的商户 ID、平台公钥、商户私钥。**不要将真实私钥提交到 Git。**

## 使用

```php
<?php
require __DIR__ . '/vendor/autoload.php';

use QingtianPay\\Nzzf\\Client;
use QingtianPay\\Nzzf\\Signer;

$config = require __DIR__ . '/epay.config.php';
$client = new Client($config);

// 查询商户信息
$merchant = $client->merchantInfo();

// 查询最近订单（最多 50 条）
$orders = $client->orders([
    'offset' => 0,
    'limit' => 20,
]);

// 验证异步通知 / 同步跳转参数
$isValid = Signer::verify($_POST, $config['platform_public_key']);
if (!$isValid) {
    http_response_code(400);
    exit('invalid sign');
}

// 业务处理完成后，按 NZZF 规范返回纯文本 success
echo 'success';
```

## 签名规范

1. 过滤空值、`sign`、`sign_type`，排除数组/对象参数。
2. 参数名按 ASCII 升序排列。
3. 拼接为 `key=value&key2=value2`。
4. 使用商户 RSA 私钥执行 SHA256WithRSA，签名结果 Base64 编码。
5. 验签使用平台公钥和相同的待签名字符串。

`Signer::canonicalize()`、`Signer::sign()`、`Signer::verify()` 可独立使用。

## 已封装接口

| 方法 | 请求地址 | 说明 |
|---|---|---|
| `merchantInfo()` | `POST /api/merchant/info` | 查询商户信息 |
| `orders($filters)` | `POST /api/merchant/orders` | 查询订单列表 |

通用 `post($path, $params)` 可用于后续已核实文档的接口。当前资料尚未包含支付下单和代付的完整参数定义，因此 SDK 不伪造这两类方法。

## 安全说明

- 商户私钥只保存在商户自己的服务器，不得发送到浏览器。
- 始终启用 HTTPS 证书校验。
- 通知处理应实现幂等，避免重复通知重复发货。
- 对通知验签成功后仍需校验订单号、金额、商户号和订单状态。
- 当前 SDK 对响应中存在的 `sign` 字段执行平台公钥验签；若上游响应结构变化，应先按最新官方文档调整。

## 协议来源与状态

实现依据：用户提供的 NZZF 文档摘录（V2 SHA256WithRSA、商户信息查询、订单列表查询、表单 POST）。尚未使用官方 SDK 源码或真实商户密钥进行联调。
