# 晴天支付

晴天支付的登录与注册基础工程，使用 Vite + Cloudflare Pages Functions + D1。

## 已接入

- 晴天支付品牌登录 / 注册界面，使用仓库内的 `logo.png`
- 邮箱注册：6 位验证码、10 分钟有效期、60 秒发送冷却、错误次数限制
- 密码使用 PBKDF2-SHA256 保存，登录态使用 HttpOnly + Secure Cookie
- GitHub OAuth 登录回调（需要配置 OAuth App）
- Cloudflare D1 用户、验证码与会话表
- Resend 事务邮件模板，发件人统一为 `晴天支付 <no-reply@lynli.me>`
- Cloudflare Pages 连接 GitHub `main` 分支，提交后自动构建和部署

## 运行环境

Cloudflare Pages 项目：`qingtian-pay`  
线上预览域名：`https://qingtian-pay.pages.dev`  
D1 数据库：`qingtian-pay-auth`（APAC）  
D1 binding：`AUTH_DB`

### 必须配置的加密变量

在 Cloudflare Dashboard → Workers & Pages → qingtian-pay → Settings → Variables and Secrets 中设置：

| 变量 | 类型 | 用途 |
|---|---|---|
| `RESEND_API_KEY` | Secret | Resend 仅发送权限、限制到 `lynli.me` 的 API Key |
| `AUTH_SECRET` | Secret | 已由部署配置生成，用于验证码 HMAC |
| `GITHUB_CLIENT_ID` | Secret / Text | GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | Secret | GitHub OAuth App Client Secret |

发件人已配置为 `晴天支付 <no-reply@lynli.me>`。不要把 API Key、OAuth Secret 写进代码或提交到 Git。

### Resend

Resend 中 `lynli.me` 已验证且 Sending 已启用。创建一个 `sending_access` API Key，并限制发件域名为 `lynli.me`，将其保存为 Cloudflare Pages 的 `RESEND_API_KEY` Secret。

### GitHub 一键登录

在 GitHub Developer Settings → OAuth Apps 创建 OAuth App：

- Homepage URL：`https://qingtian-pay.pages.dev`
- Authorization callback URL：`https://qingtian-pay.pages.dev/api/auth/github/callback`
- Scope：应用会请求 `read:user` 与 `user:email`

将 Client ID 和 Client Secret 设置为上述 Pages 环境变量。配置完成后 GitHub 登录按钮即可走真实 OAuth 流程。

## 本地开发

```bash
npm install
npm run dev
```

本地 Functions 需要通过 Wrangler / Cloudflare Pages 本地环境绑定 D1，并在本地密钥文件中配置服务变量。不要把本地密钥文件提交到 Git。

## 重要说明

当前交付范围是账户认证基础。商户入驻审核、支付订单、支付宝 / USDT 渠道、分账与结算均未在本次登录注册版本中开放。协议文案是产品初稿，上线前应按实际经营主体、服务地区和支付业务合规要求审阅完善。
