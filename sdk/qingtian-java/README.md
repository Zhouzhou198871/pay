# Java-SDK（V2.1）

下载后修改 `epay.config.properties`，填入商户后台 API 信息页显示的值即可。配置字段与 PHP SDK 一致：`apiurl`、`pid`、`platform_public_key`、`merchant_private_key`。

私钥请使用环境变量或密钥管理系统注入，勿将生产私钥提交到代码仓库。JDK 17+，源码见 `src/main/java/me/lynli/qingtian/QingtianPayClient.java`。
