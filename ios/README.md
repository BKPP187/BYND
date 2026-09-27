# BYND iOS / HealthKit

这是新增的 SwiftUI + WKWebView 原生容器，最低 iOS 16。HealthKit 实现位于 `BYND/HealthKitReader.swift`，仅查询用户选中的睡眠、步数、Apple 运动分钟和月经流量样本，没有健康写入或后台读取。

## 准备与真机运行

1. 在仓库根目录执行 `node scripts/prepare-ios.cjs`。脚本同步网页资源到 `ios/BYND/www`，并按当前本地版本生成 `ios/BYND.xcodeproj`；没有 npm/XcodeGen 依赖。`www` 是生成资源，不提交。
2. 将整个仓库移到 macOS，再执行同一脚本。用 Xcode 打开 `ios/BYND.xcodeproj`。
3. 选择 BYND target → Signing & Capabilities → 自己的开发团队。项目已有 HealthKit entitlement 与用途说明；开发者账户的 `cc.ccwu.bynd` App ID 和 provisioning profile 也必须允许 HealthKit。若此 Bundle ID 属于其他团队，请使用自己的 ID，并重新生成签名配置。
4. 选择已配对 iPhone 真机，编译和运行。Xcode 编译诊断与签名错误必须解决后才算原生接入通过。
5. 在桌面「角色台」→ 生活状态选择读取类别 → 连接并选择系统授权。系统授权后仍需在「角色授权」独立选择字段和精度。默认不会授权任何角色。
6. 月经流量样本在「月伴」列为候选日期，先由用户确认实际开始日期，填写个人周期或积累足够记录，再为所选角色授权与启用提醒。

当前开发机器是 Windows，没有 Xcode/Swift；本次只有配置检查、JS 桥接测试及浏览器集成验证，**未完成 Swift 编译、IPA 签名、真机授权和真实健康库读取验证**。不能把生成 Xcode 工程视为可安装 IPA。

## 原生和网页边界

本地网页使用 `bynd-app://app/index.html`，资源路径限制在打包目录内。HealthKit 桥接只接受本地首页框架消息，外部网页不能调用。外链由 Safari 打开。查询返回经过汇总的 JSON，不通过 URL 携带数据。桥接请求 ID、超时和连接代次避免重复及断开后的迟到回调恢复数据。

Apple 为保护隐私不暴露是否拒绝了读取权限；空结果显示“可能未授权／未记录／未同步”，不会显示假零或“已获读取授权”。每次读取开始删除上一份原生快照；手动记录与角色授权保留。步数使用统计查询而不是累加多设备样本，睡眠只合并实际睡眠区间，排除卧床／清醒。没有可靠样本时不猜测入睡、情绪或身体症状。

现有 Web 功能和现有 Android 原生服务接口均保留；这个新增 iOS 容器只实现健康桥接，Android 的后台桌宠、屏幕捕获、TTS、备份文件输出等原生接口没有移植成 iOS 等价功能。系统文件上传、浏览器下载、相机／麦克风和自定义 API 网络请求仍需真机单独验收。Web 备份不含健康／月伴私密存储；iOS 系统设备备份与 BYND 的手动导出不是同一机制。

## 真机验收

- 首次、取消、拒绝、部分授权、重新授权；有样本与无样本；授权流程完成不代表读到数据。
- Apple Watch 与 iPhone 重叠睡眠、跨午夜、时区变化、午睡；步数与运动去重及样本时间。
- 健康应用撤权后返回 BYND，旧原生快照不能继续提供给角色。
- 断开时读取仍在进行、查询失败／超时、磁盘满、重载与迟到回调。
- 月伴未授权／概况／日期、Jev 不确定、用户正在聊天、同周期重复、聊天保存失败。
- 状态栏安全区、320px 窄屏、键盘及底部 home indicator。

官方依据：[HealthKit 授权](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)、[睡眠分类](https://developer.apple.com/documentation/healthkit/hkcategoryvaluesleepanalysis)、[统计查询](https://developer.apple.com/documentation/healthkit/executing-statistical-queries)。
