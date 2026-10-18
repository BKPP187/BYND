# BYND 爱发电接入（本地完成，尚未部署/开售）

售价统一 **¥13.88 / 1388 分**。支付宝沙箱继续独立存在。本地版本 1.1.915。

## 已实现

- 官网开售配置启用爱发电后，购买按钮进入 `checkout.html`；当前生产开关没有修改。
- 已登录且邮箱验证完成的 BYND 用户先通过官方 OAuth 关联爱发电付款身份，再到配置的方案页购买。
- 官方 OAuth 返回的用户 ID 与官方查单返回的付款人 ID 匹配。绑定一对一且不可由用户任意换绑。订单号、备注、邮箱、前端“支付成功”参数都不是所有权证明。
- 通知 `POST /license/v1/pay/afdian/webhook?key=<随机入口密钥>` 只提取订单号。入口密钥不是爱发电数字签名；到账仍必须通过固定官方 HTTPS 查单 API 核验。
- 核对 `status=2`、实际 `total_amount="13.88"`、指定 `plan_id`、单月单份、无兑换码；售卖方案还需准确的 SKU 和数量 1。净到手金额不参与价格比较。
- D1 中通知先持久化，再回复 `{ec:200,em:""}`。接收失败不假装成功；后台异步核验，失败保留重试，五分钟 cron 处理到期任务，过期执行租约可恢复。
- 独立迁移 `0008_afdian.sql`。以 `out_trade_no` 唯一，授权、账号归属、领取链接、审计在同一个 D1 batch 中提交，重复/并发只发一份。
- 用户页面轮询自己的授权；新授权自动跳到现有领取页。已完成的授权可再次查看。丢失通知时用户可输入订单号核对，后台也有“按订单号重新核对”，都要重新查实际订单。
- 管理员核对后打开现有授权详情，可按原流程补发领取链接/邮件；邮件开关没有修改，没有新增未经配置的邮件发送。

## 为什么没有依赖 custom_order_id

目前读取到的官方开发文档没有承诺 `custom_order_id` 透传或 webhook 签名。本实现使用官方 OAuth 确认买家，再由官方 query-order 的 `user_id` 匹配账号，不猜测未公开参数，也不信任用户填写的订单备注。

## 正式配置前需要的资料

1. 爱发电创作者的公开 BYND 方案链接；固定价格 13.88、一次一份，并确认适合该商品的方案及退款条款。
2. 开发者后台的创作者 `user_id` 和 API Token。Token 只放 Worker secret `AFDIAN_API_TOKEN`。
3. 官方 OAuth 应用的 `client_id` 和 `client_secret`。该能力需要向爱发电申请，不能把普通 API Token 当 OAuth secret。可信域名为真实网站；回调精确设为 `https://bynd.ccwu.cc/checkout.html`。secret 放 `AFDIAN_CLIENT_SECRET`。
4. 自行生成至少 32 字符随机入口密钥，存 Worker secret `AFDIAN_WEBHOOK_SECRET`，并将同一个值填入通知 URL 的 `key` 参数。通知 URL 含凭证，不公开、不贴日志。
5. 非秘密变量：`AFDIAN_USER_ID`、`AFDIAN_PLAN_ID`、`AFDIAN_PRODUCT_TYPE`（0 常规方案、1 售卖方案）、`AFDIAN_PURCHASE_URL`、`AFDIAN_CLIENT_ID`，售卖方案额外需要 `AFDIAN_SKU_ID`。
6. 上线时另行应用迁移、部署、配置 `PAYMENT_RATE_LIMITER` 和五分钟 cron（见 wrangler 示例），核对既有账号/邮件配置。这次没有修改真实 wrangler 配置、部署、推送或打开任何生产开关。
7. `AFDIAN_ENABLED` 和 `SALES_ENABLED` 必须同时开启且配置完整，才开放付款/发码。默认都关闭。不会为测试偷偷绕过售卖开关。真实交易应在准备好的隔离测试环境或明确约定的受控开售窗口进行。

## 测试与边界

- `node --test tests/license-afdian.test.cjs`：拒绝伪造入口、信任字段注入、未付款、金额/方案/月份/SKU/数量错误、兑换码、跨账号冒领、过期/重放/跨会话 OAuth、失败响应、跳转、超长响应、并发重复、数据库回滚、通知存储失败、定时补单、崩溃租约恢复、管理员身份、关闭开关。
- `node scripts/check-afdian-worker.cjs`：真实 workerd 的 Node MD5 协议兼容、OAuth、真实 D1 事务和并发验证。
- `node scripts/check-afdian-browser.cjs`：真实 Edge 页面、账号关联、未到账/少付款/故障、付款后领取页、后台补单；320/390 宽屏，47/59 顶部安全区、父容器/顶栏两种预留。
- 测试外部调用全部拦截，使用隔离数据库和虚构凭证；**没有真实付款，不能据此宣称真实爱发电联调成功**。证据目录 `artifacts/payments/afdian/`。
- 当前只支持一个精确配置的单份方案，不支持批量数量、礼品码、优惠价、换绑或自动退款。官方公开文档只说明成功订单通知，未据此推断退款事件；退款仍须按后台核验后用既有授权禁用操作处理。永久离线凭证不能即时远程撤销。
- 查询失败不会发码；未关联买家的通知会保留等待关联后重试。领取链接 30 天有效，过期后可在账号查看授权，管理员也可重新生成链接。

## 官方依据

- [开发者 API 和 Webhook](https://guide.afdian.com/creator/developer)：固定查询地址、签名、实际金额、交易状态与响应格式。
- [OAuth2 关联授权](https://guide.afdian.com/creator/oauth2)：申请要求、授权码交换、官方用户 ID、HTTPS 服务端调用。

核对日期：2026-10-17。尚缺实际创作者/OAuth 配置，真实付款验收待配置后完成。

本轮实测结果：全量 `node tests/run.cjs` 1351 通过、0 失败（其中新增爱发电 14 项）；Edge 浏览器 13 项通过；workerd/D1 4 项通过；既有支付宝 workerd 3 项及关闭购买页回归通过。版本一致性检查为 1.1.915。截图已实际查看；日志与 JSON 结果位于上述证据目录。
