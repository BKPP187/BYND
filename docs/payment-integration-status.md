# BYND 付款入口准备状态

2026-10-17 更新：爱发电本地接入已完成，包含官方 OAuth 绑定、服务端查单、持久通知重试、幂等发码和前后台核对。见 [爱发电接入与验收](afdian-integration.md)。实际凭证待配置，尚未真实付款、部署或开售。

当前售价为 ¥13.88，保持未开售。`checkout.html` 在普通环境显示关闭入口；本机隔离的支付宝沙箱环境已实现注册、订单、跳转测试收银台、服务端查单与验签、账号自动领取测试激活码。本次没有上线收费，也没有更改 Cloudflare 的销售、账号或邮件开关。

`artifacts/payments/bynd-alipay-framed-preview.png` 是用户提供的第一张个人收款码与新边框的本地设计预览。原码和合成图均已解码，内容完全相同。它们不在网站静态资源目录或发布目录中。即使后来提供的二维码有“经营”标识，也不能据此认定已经具备网站支付接口；需核对实际签约产品、应用及接口权限。

公开页面只加载不含二维码的边框 `assets/website/bynd-payment-frame-e4a9f7ba69a0.webp`（67,486 字节），开售按钮禁用。沙箱测试使用官方电脑网站支付收银台，由服务端对订单金额、收款 PID、订单号、APPID 和回跳地址签名。个人静态收款码不用于自动发码。不读取 URL 的 paid/success 参数作为付款依据；跳回页面只恢复订单并触发后端查单，不直接签发。

## 本机沙箱

运行 `node scripts/payment-sandbox-server.cjs`，默认入口 `http://127.0.0.1:8994/checkout.html`。配置仅在 Git 忽略的 `.bynd-license-secrets/alipay-sandbox.json` 中读取；密钥不写入网页、测试报告或 Worker 公开配置。沙箱数据目录为 `.bynd-license-dev/payment-sandbox/`，与原本机服务及生产库分离，账号、密码散列 pepper、License HMAC 密钥和签名密钥均独立。

开启同时要求 `PAYMENT_SANDBOX_ENABLED=true`、`PAYMENT_ISOLATION=sandbox-v1`，以及与 `PUBLIC_ORIGIN` 相同的 HTTP loopback 来源。正式 HTTPS 域名即使误设沙箱开关也会拒绝支付。客户端参数不能改变环境或售价。注册验证邮件只写本机测试信箱，不发送真实邮件；测试激活码只适用于该本机环境，不能作为正式 Android 授权。

`scripts/check-payment-sandbox-live.cjs` 通过正常注册、邮箱验证和登录流程准备本机演练账号，账号信息保存于 `.bynd-license-dev/payment-sandbox/test-login.json`。需先启动沙箱服务。此脚本会发起真实沙箱查单、验签并打开实际收银台，但**不提交付款**。演练时使用支付宝后台“沙箱账号”里的买家账号和支付密码，不用真实账号。

接口：`GET /payment/v1/config`，登录后 `GET/POST /payment/v1/orders`，`GET /payment/v1/orders/:id`，`POST /payment/v1/orders/:id/check`。写请求要求同源 Origin 和 `X-BYND-Payment:1`。服务器新订单金额固定 1388 分，拒绝传入 paid、amount 或 userId；客户端请求 UUID 在账号内幂等。`0007` 迁移保留已有 1280／1288 分测试订单，回调和查单按订单原价核验，页面展示该笔订单金额。订单恢复继续使用原订单。支付链接过期后不能重新生成该链接，但已实际付款的订单仍可查单恢复授权。

查单固定请求支付宝沙箱 HTTPS 网关、不跟随重定向、限制响应大小及超时。RSA2 验签使用响应里原始 JSON 字节，保留转义、空白和字段顺序，拒绝重复外层字段。官方查单响应不保证返回 seller_id/app_id，收款人与应用绑定在服务端订单及签名支付请求中；如响应提供这两项也必须一致。通知则强制验证签名及 app_id、seller_id、金额、订单号、交易号，再主动查单复核。不会仅凭前台回跳、截图、成功字段或一条未复核的通知发码。

签发与账号归属、交易号占用、审计和订单完成在一个 D1 事务中完成。唯一交易号阻止同一笔款项发给两笔订单；重试签发同一份激活码。保存失败会回滚，前台不能显示领取成功。已确认的关闭/全额退款会停用对应测试授权；不会重新打开已关闭/退款订单。7 秒查单轮询在页面隐藏或完成后停止，返回页面后重新确认登录和订单；连续失败三次停止自动查询并保留手动查询入口。

本机回调地址无法被支付宝公网访问，因此当前实际沙箱联调用主动查单；通知逻辑由 RSA 签名模拟器覆盖。正式环境需要在获批商户产品接入后配置公网 notify_url，并补全生产回调、漏单补偿及退款/对账运行策略。沙箱测试与真正的钱款到账不可混为一谈。

## 商户接口确认后继续

确认商户实际开通的产品适用于网站售卖软件授权，再按该产品官方文档接入，不能仅凭经营收款码选择或假定已开通当面付、电脑网站支付或手机网站支付。密钥放在本地私密配置与 Worker secrets 中，不放聊天、HTML、仓库或截图。

沙箱后端已由经过验证的登录账号创建订单。正式接入时继续保留相同的金额、订单、签名、账号归属、原子签发和去重约束；不能放宽验证来替代尚未取得的商户权限。

正式支付尚未接入，本次测试不能证明真实收款可用。还需要合适的商户资质及产品、正式密钥、网站资料审核、生产邮件和端到端验收。用户曾在聊天中提供的密钥仅保留为沙箱配置；上线时另配正式密钥，不复用本次沙箱密钥。

参考：[支付宝官方支付结果异步通知及验签说明](https://developer.alibaba.com/docs/doc.htm?articleId=105286&docType=1&treeId=203)。

接口实现参考：[官方 Node SDK 的网站支付、PKCS8 和通知验签说明](https://github.com/alipay/alipay-sdk-nodejs)、[官方交易查询参数说明](https://developer.alibaba.com/docs/doc.htm?articleId=757&docType=4&treeId=180)、[官方沙箱说明](https://opendocs.alipay.com/common/02kkv7)。为保持 Worker 依赖精简，仅使用已兼容的 Node RSA 接口及标准 fetch 实现本次需要的两类请求，没有引入商城或支付 SDK 的完整网络依赖。

## 图像生成记录

使用内置 image_gen，三张装饰框作为风格参考；真实收款码未交给模型重绘。生成源文件复制到 `artifacts/payments/bynd-payment-frame-source.png`，网页使用压缩 WebP。合成脚本 `scripts/prepare-payment-frame-preview.cjs` 用原码提取、最近邻缩放并保留白色静区，前后扫码校验一致；不输出收款链接。

最终提示词：

> Use case: stylized-concept. Generate one original, polished, adorable BYND payment QR display FRAME, a portrait 4:5 flat printable stationery graphic. Three supplied images STYLE/COMPOSITION REFERENCES ONLY. Blend soft cream/blush pink kawaii reference2, retro pixel-computer love-letter window reference3 and restrained sticker layering reference1. Warm cream paper, pale peach-pink window border, thin dusty rose/brown outlines, tiny pixel hearts, small gingham corners, bow, love-envelope sticker, one small original floppy-eared puppy peeking lower right. Breathing room, little vintage desktop window holding QR, modest title bar exactly BYND and three small controls. CRITICAL blank PURE WHITE unobstructed square left18% top27% width64% of canvas, for1024x1280 x184,y346,w656,h656. Keep decorations OUTSIDE square + quiet zone. Will insert real QR in HTML; DO NOT generate any QR/barcode/payment number/currency/receipt/paid badge/confirmation. Below square quiet cream for native labels. No copied chars/watermarks/artist signatures/Alipay logo/additional text. Edge-to-edge4:5, intact corners, flat front, crisp printlike lines.

## 本地验证

`scripts/check-payment-preview-browser.cjs`：售价、关闭入口、320/390px 窄屏、47/59px 安全区的父容器与顶栏两种布局；伪造 paid/success 参数、页面恢复及未授权调用管理接口均不签发 License。截图与结果保存在 `artifacts/payments/`。

`scripts/prepare-payment-frame-preview.cjs`：原码及合成码解码一致，结果保存为 `artifacts/payments/qr-check.json`。

`tests/license-payment.test.cjs`：12 项场景测试，覆盖正式域名禁止、登录和来源验证、服务端定价、幂等、重复并发签发、订单/金额/收款方不符、无效签名、重定向、不完整通知、交易号重放、账号越权、事务回滚、晚到付款及退款停用。

`scripts/check-payment-browser.cjs`：真实本机 HTTP/SQLite/账号流程，支付宝响应由独立 RSA 模拟器签名。覆盖创建响应丢失重试、打开收银台直接返回、查询失败、金额不符、领取与刷新找回、账号归属、退出清理以及 8 种窄屏安全区布局。报告位于 `artifacts/payments/sandbox-browser/results.json`。

`scripts/check-payment-worker.cjs`：Cloudflare workerd + D1 实际执行 RSA 请求签名、原始响应验签、未付款与重复付款处理。外部请求全部被测试服务截获；报告位于 `artifacts/payments/sandbox-workerd.json`。

`scripts/check-payment-sandbox-live.cjs`：实际支付宝沙箱请求与响应验签、真实测试收银台打开、打开后仍未付款不发码。`artifacts/payments/actual-sandbox-check.json` 中明确记录未提交模拟付款；实际模拟支付成功仍需使用沙箱买家账号完成一次操作，不能将模拟器通过当作官方付款实测完成。
