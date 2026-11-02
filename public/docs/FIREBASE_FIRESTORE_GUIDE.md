# Firebase / Cloud Firestore 接入规范（晴天支付）

- 目标 Firebase 项目：SOSKS5（项目 ID、数据库区域和 Web App 配置须从 Firebase Console 核验）
- 目标站点：https://pay.lynli.me
- 部署平台：Cloudflare Pages Functions / Workers
- 状态：技术规范已纳入仓库；生产凭据和真实 Firebase 项目连通性尚未验证

## 1. 接入原则

晴天支付现有账户、会话和认证数据以 Cloudflare D1（AUTH_DB）为准。接入 Firestore 时先作为业务资料/非账务数据存储，不直接替换 D1 的用户主键、登录会话或资金账本。

以下数据不得仅依赖浏览器写入 Firestore：支付订单状态、支付回调结果、余额、冻结金额、账本流水、提现状态、渠道密钥。它们必须由服务端校验并写入权威账本；任何客户端字段都不能证明已付款。

建议初期数据边界：
- D1：用户账户、密码摘要、登录 Session、邮箱验证码、资金账本和支付订单权威状态。
- Firestore：非敏感用户偏好、商户展示资料、帮助/开发者文档索引、非账务业务配置（服务端校验后写入）。
- 后续如决定把某类数据迁入 Firestore，必须先定义唯一写入源、迁移策略、回滚方案和一致性校验，不能双写后任意一端都当权威。

## 2. Cloudflare Workers 兼容方案

不要直接假设 Firebase Admin Node.js SDK 可在 Cloudflare Workers 运行。Workers 环境与传统 Node.js 服务器不同。推荐服务端通过 Firestore REST API 访问数据库，并使用 Google 服务账号 OAuth 2.0 JWT Bearer 流程取得短期 access token。

生产环境所需变量（均配置为 Cloudflare Secret，不能提交到 Git）：
- FIREBASE_PROJECT_ID：Firebase / Google Cloud 项目 ID（需在 Console 核实，不能把显示名称 SOSKS5 当作项目 ID）。
- FIREBASE_CLIENT_EMAIL：专用服务账号邮箱。
- FIREBASE_PRIVATE_KEY：该服务账号私钥 PEM，作为 Secret 保存；部署配置中需正确处理换行。
- FIREBASE_DATABASE_ID：通常为 (default)，以实际 Firestore 数据库为准。

建议为晴天支付创建专用、最小权限的服务账号，只授予目标 Firestore 数据库所需角色。不要复用个人账号密钥，不要把私钥放入 Vite 前端变量（如 VITE_*）、HTML、浏览器 localStorage 或 Git。

## 3. REST API 访问形态

Firestore REST 根路径：
`https://firestore.googleapis.com/v1/projects/{projectId}/databases/{databaseId}/documents`

服务端应：
1. 从 Cloudflare Secret 读取服务账号配置。
2. 使用 Web Crypto 对服务账号 JWT 进行 RS256 签名，向 Google OAuth Token Endpoint 交换短期 access token。
3. 通过 Authorization: Bearer <access_token> 调用 Firestore REST API。
4. 设置请求超时、有限重试与结构化错误日志；日志不得包含私钥、JWT、access token 或用户敏感字段。
5. 仅暴露晴天支付自己的同源 API，不把 Google 服务账号凭据或通用 Firestore 代理暴露给浏览器。

常见 API：
- 创建/覆盖文档：`POST .../documents/{collectionId}` 或 `PATCH .../documents/{documentPath}`
- 读取文档：`GET .../documents/{documentPath}`
- 查询：`POST .../documents:runQuery`
- 删除：`DELETE .../documents/{documentPath}`

具体字段类型必须按 Firestore REST Value 格式编码（stringValue、integerValue、booleanValue、timestampValue、mapValue、arrayValue 等），不可把普通 JSON 直接当成 Firestore REST Document.fields。

## 4. 安全规则与访问控制

- 浏览器不直接持有服务账号凭据。
- 如果启用 Firebase Web SDK 直接读取公开/用户私有数据，必须配置严格 Firestore Security Rules，并使用 Firebase Authentication 的身份声明校验用户身份。
- 服务端 Admin/REST 服务账号访问不受 Firestore Security Rules 约束，必须在晴天支付 Functions 内自行完成身份认证、资源归属校验和字段白名单校验。
- 不允许客户端决定 ownerId、merchantId、balance、paid、settled、role 或 admin 等可信字段。
- 不允许通过一个任意 collection/document path 的通用代理读写数据库。
- 使用 App Check 作为额外滥用防护时，不可将其当作身份认证或授权替代品。

## 5. 与现有晴天支付接口的映射

当前线上仓库已经实现的登录认证仍由 D1 提供：
- `/api/auth/register`
- `/api/auth/login`
- `/api/auth/me`
- `/api/auth/logout`
- 邮箱验证码与密码重置接口

当前商户工作台订单、提现、资金流水等 API 在开发者 API 参考中标注为只读或尚未开放。Firestore 接入不会自动创建支付渠道、支付下单、回调、退款或提现能力。

任何支付相关写入都必须走晴天支付服务端的业务 API，校验支付服务商签名/回调、金额、币种、商户订单号和幂等键，再更新唯一权威账本。Firestore 的写成功不等于支付成功。

## 6. 上线前检查

- [ ] 在 Firebase Console 核实项目 ID、Firestore 数据库 ID、区域与目标 Web App。
- [ ] 建立专用服务账号并授予最小权限。
- [ ] 在 Cloudflare Pages Production 环境设置上述 Secret。
- [ ] 部署 Firestore REST 客户端封装与明确的业务路由（不开放通用代理）。
- [ ] 增加超时、限流、错误处理、幂等键和审计日志。
- [ ] 添加单元测试、模拟测试与真实 Firebase 项目的只读连通性测试。
- [ ] 验证无权限用户不能读取/修改其他商户数据。
- [ ] 确认资金、支付状态仍以服务端权威账本为准。
- [ ] 验证 Production 环境变量不泄露到前端构建产物。

## 7. 官方开发文档

- Firebase JavaScript SDK 初始化：https://firebase.google.com/docs/web/setup
- Firebase Authentication Web：https://firebase.google.com/docs/auth/web/start
- Firebase Admin SDK 与服务账号：https://firebase.google.com/docs/admin/setup
- Firestore 安全概览：https://firebase.google.com/docs/firestore/security/overview
- Firestore Security Rules 与 Authentication：https://firebase.google.com/docs/rules/rules-and-auth
- Firestore 事务与批量写入：https://firebase.google.com/docs/firestore/manage-data/transactions
- Firestore 客户端库与服务端库区别：https://firebase.google.com/docs/firestore/client/libraries

## 8. 当前状态说明

本文件是接入规范与官方文档索引，不代表已经连接 SOSKS5。尚未从 Firebase Console 读取到可核验的项目 ID、数据库 ID，也尚未执行生产读写验证。完成真实接入必须先配置专用服务账号 Secret，再由部署后的 Functions 执行只读健康检查；通过后才能逐项开放业务写入接口。
