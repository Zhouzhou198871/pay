# PHP-SDK（V2.1）

下载后修改 `lib/epay.config.php`，填入商户后台 API 信息页显示的值即可。

配置项：
- `apiurl`：晴天支付 API 基础地址
- `pid`：商户 ID
- `platform_public_key`：平台公钥，用于验签
- `merchant_private_key`：商户私钥，用于请求签名

密钥只能放在服务端。不要提交到公开仓库或写入浏览器代码。SDK 示例入口见 `QingtianPayClient.php`。
