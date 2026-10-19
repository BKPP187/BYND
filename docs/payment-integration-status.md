# BYND 付款与 QQ 联系入口

2026-10-19：按用户要求，支付宝和爱发电接入均移出主线。公开页面使用 QQ **3648068162** 联系，支持原图扫码、放大和复制号码。复用既有 BYND 边框，不重新生成图片。自动收款与发码接口、爱发电定时补单入口已移除；账号、激活码与领取链接功能保留。本次未部署 Worker 或操作远端数据库。

## 接口归档与恢复

| 实现 | 保留分支 | 归档提交 |
| --- | --- | --- |
| 支付宝本机沙箱 | `codex/alipay-sandbox-archive` | `4fa3418caa5545182f6c330d99e5dc2fa89b7b50` |
| 爱发电 OAuth、查单及履约 | `codex/afdian-integration-archive` | `4fa3418caa5545182f6c330d99e5dc2fa89b7b50` |

两个分支均保留移除前 v1.1.956 的完整实现、测试及接入说明。恢复时在独立目录检出相应分支，例如 `git worktree add ../BYND-payment-archive codex/afdian-integration-archive`，阅读归档版本的说明，并选择性恢复、适配当时主线，不能整体回退生产代码。归档不代表已有正式收款资格或真实付款验收。

本地密钥 `.bynd-license-secrets/`、本地数据库 `.bynd-license-dev/` 和测试报告仍在原忽略目录中，不进入 Git。独立目录需自行使用已有私密配置，不得提交密钥或覆盖生产配置。用户明确要求发布的 QQ 图片单独作为网站联系资源保留，未发布个人收款码。

## 数据兼容

`workers/license/migrations/0005_sandbox_payment.sql`、`0006_sandbox_payment_price.sql`、`0007_unified_payment_price.sql` 和 `0008_afdian.sql` 原样保留。已有支付表、关联、订单和待处理记录不删除、不改写，不重排或回滚迁移；自动处理器和模板中的定时任务已停用。此修改不操作远端数据库。

## 主线行为与验证

- `/payment/v1/*`、`/license/v1/pay/afdian/*`、`/admin/v1/pay/afdian/recheck` 不再挂载，旧渠道开关不能重新启用；旧记录保留但不会继续自动发码。
- 首页购买按钮始终进入本站 QQ 联系页，不再根据旧购买配置跳往支付平台。下载信息暂时不可读取时，QQ 联系仍可使用。
- QQ 码来自用户提供的原始 PNG，SHA-256 为 `ca44cdaaaaa911127f20eea036a8ad4f0cc4973e3cd40c73f1ab302aaf12088d`；只在 HTML/CSS 中套框显示，没有重绘二维码。原图点击可放大。边框原始生成记录见归档分支的本文件。
- 联系页图片、CSS 及修改过的页面脚本位于 `assets/contact/`，避开线上旧 `/assets/website/*` Worker 静态路由，随 Pages 更新。预览服务、独立网站打包与移动端资源排除规则均覆盖该目录。
- 管理后台保留人工签发、领取链接及邮件交付；移除爱发电订单核对。账号中的既有激活码仍可查看。
- 角色手机的虚构支付宝应用、屏幕陪伴的支付应用隐私排除规则不属于收款接口，保持原功能。
- `node --test tests/license-payment-retirement.test.cjs tests/license-distribution.test.cjs` 检查旧接口不可用、历史数据不变、迁移一致，以及领取、签发和邮件失败路径。
- `node scripts/check-payment-preview-browser.cjs` 检查 QQ 入口、复制成功与失败、后台故障、无旧渠道请求、伪造回跳不发码、退款锚点及窄屏安全区。
- `node scripts/check-license-flow-browser.cjs` 回归管理后台、人工交付、领取、禁用及失败恢复。
