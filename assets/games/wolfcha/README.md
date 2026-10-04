# 狼人杀 · 月夜钟盘

`moonlit-clock-v1.webp` 是通过内置 imagegen 工具生成的原创界面背景，压缩为 WebP（约 196 KiB），用于入口、邀请席和白昼／夜间对局。用户的九张图片只作为视觉方向参考，未直接嵌入参考图中的文字、签名、二维码或水印。

生成提示：竖幅暗色哥特月夜插画；象牙白古典天文钟盘、罗马数字、旧金色细环与轨道线、月牙、稀疏星光、悬浮的抽象塔罗牌及远处披风剪影；墨黑、象牙白、克制旧金和灰蓝阴影；蚀刻与绘画纹理，柔和月光；顶部和底部留暗色空间，主体在中部；无文字、标志、水印、界面、脸部特写及霓虹色。

浏览器验证：`node scripts/check-wolfcha-browser.cjs`，截图保存在 `.qa-screenshots/wolfcha/`，覆盖 84 组 320／375／430px、47／59px 安全区及两种安全区预留方式，以及角色选择、身份保密、发言草稿、投票、API 失败、存储失败和声音面板。

## 旁白与氛围音

- 声音入口在对局右上角。自动旁白与氛围音默认关闭，点击开启后才播放；旁白卡片的“朗读”也可单次试听。
- 旁白只使用 Android `ByndAndroid.speakText` 或网页设备提供的中文 Web Speech 音色，不调用默认或角色 TTS API。无需密钥；中文音色不可用时明确提示安装语音包。网页等待 `voiceschanged` 再选择中文音色，退出时取消等待和本局朗读。
- 天亮、入夜钟声使用 PWL 的 CC0 音效 `audio/bell-ding.wav`，授权和来源记录在 `audio/CREDITS.md`；夜晚以 0.72 倍速播放，素材播放失败明确提示并降级为本地合成钟声。
- 风声与选牌音由 Web Audio 本地合成。音量独立控制，读旁白时减弱；没有持续 API 请求，外部音效文件已随应用保存。
- 只读玩家视角可见的旁白；选座、查看记录和界面重绘不会重复朗读。新的旁白会取消旧声音，关闭游戏、切换应用或隐藏页面会停止声音，丢弃迟到的语音结果。
- `node --test tests/wolfcha-audio.test.cjs` 验证错误、取消、去重与隐私；浏览器检查真实钟声文件的播放、变速和退出停止，以及 `AudioContext` 的启动及关闭。系统音色由设备提供，自动化检查覆盖模拟语音及真实音频／Web Audio 生命周期，未验证各手机的实际音色。

实现参考：[SpeechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis)、[语音错误事件](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance/error_event)、[Web Audio 最佳实践](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)。

## 规则与角色 agent

`apps/games/wolfcha-rules.js` 保存对参考规则的独立概述，入口、邀请页与牌局均有折叠的“规则与玩法”。公开身份配置只含数量。当前陪玩模式与标准规则分开说明，不宣称未实现的技能、警长、多人投票或自动胜负已经结算。

`buildWolfchaAiSpeechPrompt` 与实际 `runWolfchaAiSpeech` 请求的系统消息共用该规则；裁判记录按请求角色自己的视角过滤身份，保留狼人队友信息，不使用用户的身份视角。玩家主动跳身份的发言保留为陈述，不当成裁判查验结果。重开使用独立牌局标识，旧 AI 请求的成功／失败结果均不写进新局。夜间旁白也使用同一顺序，并只点名仍在场的身份。2–10 人身份池按人数调整，保证狼人和村民同时存在。未扩展为完整 12 人竞技规则引擎。

参考规则：https://langrensha.ijinshan.com/pages/guide/rules/index.html 。参考页人数配置有两种写法，本局采用实际人数对应的身份池，不照搬其配置数字。
