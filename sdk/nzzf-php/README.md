# 晴天支付 · NZZF V2 PHP SDK

> 晴天支付根据目前收到的 NZZF 接口规范制作的兼容 SDK；不是 NZZF 官方原版 SDK。支付下单和代付接口尚未收到完整文档，因此未封装猜测性方法。

## 环境与安装

- PHP 7.4+，OpenSSL、cURL 扩展
- 在本目录运行 \`composer dump-autoload\`
- 复制 \`epay.config.example.php\` 为 \`epay.config.php\`，填入商户 ID、平台公钥、商户私钥。真实私钥不得提交到 Git 或放进浏览器。

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

// 关闭未支付订单：二选一传入平台订单号或商户订单号
$result = $client->closeOrder(null, 'YOUR_OUT_TRADE_NO');

// NZZF V2 支付结果通知为 GET；使用 $_GET 验签
if (!$client->verifyNotification($_GET)) {
    http_response_code(400);
    exit('invalid sign');
}
// 验签后仍须核对 pid、trade_no、out_trade_no、money、TRADE_SUCCESS，
// 并以数据库事务/唯一约束确保重复通知不会重复发货或入账。
echo 'success';
\`\`\`

## 签名规范

过滤空值、\`sign\`、\`sign_type\` 及数组/对象参数；参数名按 ASCII 升序排列，拼接为 \`key=value&key2=value2\`；使用商户 RSA 私钥执行 SHA256WithRSA，Base64 编码。平台响应、通知及同步跳转使用平台私钥签名，商户使用平台公钥按相同规则验签。

## 已封装接口

| 方法 | 地址 | 说明 |
|---|---|---|
| \`merchantInfo()\` | \`POST /api/merchant/info\` | 查询商户信息 |
| \`orders($filters)\` | \`POST /api/merchant/orders\` | 查询订单列表 |
| \`closeOrder($tradeNo, $outTradeNo)\` | \`POST /api/pay/close\` | 关闭未支付订单，订单号二选一 |

订单列表筛选支持 \`offset\`、\`limit\`、\`status\`、\`out_trade_no\`。关闭订单仅允许尚未支付的订单。代付模块目前仅封装余额和转账查询，不包含发起转账方法，不会触发自动打款。

## 支付结果通知

- NZZF 通知方式为 **GET**，商户从查询字符串读取参数（PHP 使用 \`$_GET\`）。
- V2 下单接口 \`/api/pay/submit\`、\`/api/pay/create\` 的通知使用 RSA；使用 \`verifyNotification($_GET)\` 或 \`Signer::verify()\` 验签。
- V1 兼容接口 \`/submit.php\`、\`/mapi.php\` 使用 MD5。本 SDK 当前未实现 V1 MD5 验签，不可用 RSA 方法验证 V1 通知。
- 通知成功状态固定为 \`TRADE_SUCCESS\`。验签成功后还必须核对商户号、平台订单号、商户订单号、金额和订单状态，并实现幂等。
- 所有业务处理成功后，响应体必须是纯文本 \`success\`。

## 安全与限制

- 商户私钥只保存在商户服务器。
- 始终启用 HTTPS 证书校验。
- 目前依据用户提供的文档摘录实现，尚未使用真实商户密钥进行 NZZF 联调。
