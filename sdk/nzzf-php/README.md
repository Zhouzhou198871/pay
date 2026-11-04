# 晴天支付 · NZZF V2 PHP SDK

> 晴天支付根据目前收到的 NZZF V2 接口规范制作的兼容 SDK；不是 NZZF 官方原版 SDK。支付下单和代付接口尚未收到完整文档，因此未封装猜测性方法。

## 环境

- PHP 7.4+
- OpenSSL、cURL 扩展

## 安装

在本目录运行 \`composer dump-autoload\`，或将 \`src/\` 复制到项目并按 PSR-4 加载。

## 配置

复制 \`epay.config.example.php\` 为 \`epay.config.php\`，填入商户后台 API 信息中的商户 ID、平台公钥、商户私钥。真实私钥不得提交到 Git，也不得放进浏览器代码。

## 使用

\`\`\`php
<?php
require __DIR__ . '/vendor/autoload.php';

use QingtianPay\Nzzf\Client;
use QingtianPay\Nzzf\Signer;

$config = require __DIR__ . '/epay.config.php';
$client = new Client($config);

$merchant = $client->merchantInfo();
$orders = $client->orders(['offset' => 0, 'limit' => 20]);

if (!Signer::verify($_POST, $config['platform_public_key'])) {
    http_response_code(400);
    exit('invalid sign');
}
// 完成订单号、金额、商户号、状态及幂等校验和业务处理后：
echo 'success';
\`\`\`

## 签名规则

过滤空值、sign、sign_type 及数组/对象参数；参数名按 ASCII 升序排列，拼接为 \`key=value&key2=value2\`；使用商户 RSA 私钥执行 SHA256WithRSA，Base64 编码。验签使用平台公钥及同样的规范化字符串。

## 已封装接口

| 方法 | 地址 | 说明 |
|---|---|---|
| \`merchantInfo()\` | \`POST /api/merchant/info\` | 查询商户信息 |
| \`orders($filters)\` | \`POST /api/merchant/orders\` | 查询订单列表 |

通用 \`post($path, $params)\` 供后续已核实文档的接口使用。订单查询筛选支持 \`offset\`、\`limit\`、\`status\`、\`out_trade_no\`。

## 安全与限制

- 商户私钥仅保存在商户服务器。
- 始终启用 HTTPS 证书校验。
- 通知验签后还必须核对商户号、订单号、金额和业务状态，并保证处理幂等。
- SDK 对响应中存在的 \`sign\` 字段执行平台公钥验签。
- 目前仅根据用户提供的接口摘录实现，尚未使用真实商户密钥进行 NZZF 联调。
