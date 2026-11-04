# Node.js-SDK（V2.1）

下载后修改 `epay.config.js`，填入商户后台 API 信息页显示的值即可。配置字段与 PHP SDK 保持一致：`apiurl`、`pid`、`platform_public_key`、`merchant_private_key`。

密钥仅能保存在 Node.js 服务端环境中，禁止打包进前端。调用示例见 `index.js`。
