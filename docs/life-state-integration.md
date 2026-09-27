# 角色台与现实生活状态

本次完成桌面「角色台」入口、现有现实工具配置迁移、手动记录、统一 JSON 汇总导入、生活解释、每个角色的独立授权与预览、聊天上下文接入。新增 iOS HealthKit 原生只读适配器、原生容器与 Xcode 工程；已做 JS 桥接与失败路径测试，尚未在 macOS 编译／真机验证。Android Health Connect 自动读取仍待接入；不能把文件导入显示为系统已连接。另增独立桌面应用「月伴」及聊天提醒。

## 数据路径

手机／手表 → 手机健康应用 → 原生只读适配器 → 按天去重汇总 → 本机生活记录 → 当前角色授权过滤 → 生活状态解释 → 当前角色聊天上下文。

角色授权必须在解释之前过滤，不能先把完整健康报告交给模型，再要求模型“不要透露某些项”。全局暂停、角色授权、字段级别、汇总时间每次生成聊天上下文都重新检查。群聊不读取。

当前八个字段分别授权：睡眠时长、入睡时间、起床时间、夜间醒来、步数、运动时长、自述精力、自述心情。每项支持关闭／生活概况／具体数据；角色默认关闭生活读取，时效可选 12／24／36 小时。活动与感受仅提供当天记录。记录缺失与数据为零分别处理，过期记录不会自动以导入时间更新。保存时间不能冒充观测时间。

睡眠时长只与用户自定目标比较；“睡眠不足”不能推断为生病、失眠或已经疲惫。步数不能推断位置、心情、是否工作；零步数可能是未佩戴设备。心情和精力由用户自述，不用心率或活动自动推断。剧情时间与现实记录时间分开。

## 汇总文件格式

只支持经过汇总的 JSON，不直接解析 Apple 健康完整 XML。每条记录描述一个日期；睡眠使用醒来当天的日期，时间必须带时区，数值使用整数。

```json
{
  "version": 1,
  "records": [{
    "date": "2026-09-27",
    "observedAt": "2026-09-27T08:10:00+08:00",
    "source": "apple-health",
    "values": {
      "sleepMinutes": 420,
      "bedtime": "2026-09-27T00:00:00+08:00",
      "wakeTime": "2026-09-27T07:30:00+08:00",
      "awakenings": 2,
      "steps": 1200,
      "exerciseMinutes": 15
    }
  }]
}
```

`source` 支持 `manual`、`apple-health`、`health-connect`、`import`。文件来源标签仅声明来源，不能证明原生授权成功。`energy` 可选 `low / okay / good`，`mood` 可选 `low / steady / good`。没有记录的字段省略；没有样本不能填零。整个文件校验通过后一次保存，失败保留旧数据和授权。同日期同指标只保留汇总时间更新的值，重复导入不会叠加步数。

## Android 自动读取接入

当前 Android 是 Java WebView 壳；`targetSdk 28` 是项目刻意保留的运行行为。正式接入前要验证 Health Connect 所需 SDK、目标版本与现有后台陪伴、屏幕捕获、通知权限的兼容性，不直接全局升级 targetSdk。

使用 Health Connect 官方客户端，先检查可用状态，支持按数据类型申请只读权限，先覆盖睡眠、步数和运动。Android 14 起 Health Connect 属于系统框架；Android 13 及以下需要安装对应应用，不能保证所有 Android 设备都可用。手表厂商应用必须先把数据同步到 Health Connect；不能假定所有品牌手表都会写入。

步数使用官方聚合 API，避免手机与手表重复计数。睡眠需要去重、区分卧床／实际睡着／清醒阶段；午睡与主睡眠也须分别汇总，不能直接把会话起止差当成实际睡眠时长。只输出被授予系统读取权限的指标，缺失样本输出缺失状态。每次读取先复查系统权限，撤权即停；用户取消、部分授权、无数据、提供者不可用和读取超时都要显示真实状态。

第一阶段只在应用前台及用户手动刷新时同步。后台读取需额外权限与平台能力检查，不能默认开启。桥接请求需唯一请求 ID、超时、只允许本地可信页面调用，不能通过 URL 查询参数传健康数据。原生数据要有独立“已撤权／数据过期／未同步”的状态，撤销系统权限时清除或禁用相应缓存；仅撤销某个角色时保留本机记录。

官方文档：[接入与授权](https://developer.android.com/health-and-fitness/health-connect/get-started)、[读取数据](https://developer.android.com/health-and-fitness/health-connect/read-data)、[聚合与去重](https://developer.android.com/health-and-fitness/health-connect/aggregate-data)。

## iPhone / Apple Watch 自动读取接入

原生工程位于 `ios/BYND.xcodeproj`，源码在 `ios/BYND`。运行 `node scripts/prepare-ios.cjs` 同步当前网页资源并生成项目；在 macOS Xcode 选择开发团队、启用 App ID 的 HealthKit 能力并真机编译。当前 Windows 环境没有 Swift/Xcode，尚不能证明 Swift 编译、签名、授权面板和真机读取成功。浏览器／PWA 仍不能调用 HealthKit。Apple Watch 数据先同步到 iPhone 健康库。完整步骤及集成边界见 `ios/README.md`。

「角色台」原生入口分别选择睡眠／步数／运动分钟／月经流量样本。只在用户主动连接、刷新和前台恢复时读取。授权请求成功只表示系统流程完成，不显示成每项读取已授权。不存在后台健康权限、写入或读取情绪能力。请求有唯一 ID、60 秒网页超时、45 秒原生查询超时、取消代次及重复回调去重。原生读取返回新快照，开始读取先清除旧快照；空结果、撤权、失败不会沿用旧缓存。原生汇总与手动／导入记录分开，断开只清原生汇总与月经样本候选日期。

使用 HealthKit 查询／统计接口读取授权样本，处理手机与手表来源优先级、重叠睡眠阶段、设备时区、夏令时及跨夜日期。Apple 的读取权限拒绝可能表现为没有可见数据，不能把“请求授权流程成功”或写入授权状态当成读取已获准，也不能自动把没有样本补成零。

当前可用替代路径：用户通过快捷指令查询健康样本，完成去重与汇总，保存符合格式的 JSON 到“文件”，再在角色台导入。这是用户主动导入，不是后台同步；本次没有制作或验证具体快捷指令安装包。原生读取保持系统授权与角色授权两层独立。

官方文档：[HealthKit 授权](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)、[读取授权状态的隐私限制](https://developer.apple.com/documentation/healthkit/hkauthorizationstatus)。

## 存储与撤销

生活记录、月伴记录和原生连接存储于本机专用键 `bynd_life_state_private_v1`、`bynd_moon_private_v1`、`bynd_health_connection_private_v1`，均不进入普通应用备份，也不从备份恢复授权。导入角色备份时撤销本机原生活和月伴授权，避免同 ID 替换角色后继承隐私权限。导入生活汇总本身不能授权任何角色。

发给用户配置的聊天模型的是所选字段的解释文本；选择具体数据时可包含相应数值。撤销授权与全局暂停阻止后续读取；已经发送到模型或已经写入聊天的内容不会被远程撤回。更严格的“不留下聊天痕迹／不入长期记忆／禁止第三方模型”等模式需要贯穿聊天历史、摘要及记忆存储设计，不能只靠提示词保证。

记录最多保留最近 30 个日期，生活状态没有趋势图、长期健康画像或健康驱动的系统推送；月伴只在聊天页面处理提前关心，详见 `docs/moon-companion.md`。新请求的 API 小票隐藏注入的生活和月伴参考，月伴专门请求隐藏全部提示词预览。已经存在的旧小票／聊天不追溯清理。


## Samsung Health / Galaxy Watch 操作

1. 更新手机和手表上的 Samsung Health，先让 Galaxy Watch 同步到手机。
2. 打开手机 Samsung Health → 设置 → Health Connect → 应用权限 → Samsung Health，允许写入所需睡眠、步数与运动数据。
3. BYND 正式接入 Health Connect 后，需要再授予 BYND 相应读取权限。三星写入与 BYND 读取是两份授权。
4. 若从 Android 设置中给 Samsung Health 授权，随后打开一次 Samsung Health。没有数据时，检查 Samsung Health → 设置 → 与三星账户同步 → 立即同步。手表传输可能延迟，不能把缺失当作零。
5. 月经数据是否写入 Health Connect 不能按品牌保证；当前月伴支持手动记录，iOS 流量样本仅作为待核对日期。

Samsung Health 从 6.22.5 起支持 Health Connect，Health Connect 在手机端运行，不能直接装到 Wear OS 手表。直接集成 Samsung Health Data SDK 则需合作方注册应用包名和签名 SHA-256，开发模式不能作为用户正式方案。

官方来源：[三星 Health Connect FAQ](https://developer.samsung.com/health/health-connect-faq.html)、[同步与类型说明](https://developer.samsung.com/health/blog/en/accessing-samsung-health-data-through-health-connect)、[Data SDK 应用校验](https://developer.samsung.com/health/data/guide/app-verification.html)。
