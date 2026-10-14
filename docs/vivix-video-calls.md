# Vivix 视频电话

设置 → 视频电话填写个人 Key、模型、画质及 Vivix 音色，并选择默认视频方案，测试只调用 `GET /v1/voices`。配置 Vivix 后，未单独指定方案的角色跟随全局设置；已明确选择普通视频或 Vivix 的角色保留自己的选择。没有配置 Vivix 的用户仍走普通视频。角色聊天设置 → 语音与通话提供「跟随全局设置 / 普通视频电话 / AI 实时视频 · Vivix」，显示当前实际方案，修改后保存。语音电话保留原流程。密钥存在 `bynd_vivix_private_v1`，不进入备份导出，也不接受备份里的该字段。

角色主动来电使用本机 Web Audio 铃声，独立于 TTS 服务和余额。先在页面交互时解锁音频；浏览器禁止自动播放时，下次交互会重试。接听、拒绝或挂断立即停止铃声。全屏及来电浮窗接听都会重新绑定当前角色与视频方案；连接或生图失败不会偷偷改用普通通话。

全局「视频声音」与角色「这位角色的视频声音」可选 Vivix 音色、角色原有 TTS、静音。角色可跟随全局，并可填写专属 Vivix 音色 ID。选择 Vivix 时不请求原有 TTS；选择 TTS 时复用角色绑定（未绑定则使用默认 TTS），调用 `requestVoiceAudioWithConfig` 生成 WAV/MP3，将 Base64 文件字节交给 `response.create.script.vocal` 的 `type=audio`、`mime_type`、`audio`，由 Vivix 一并渲染口型与声音。本机不重复播放音频，不向 Vivix 发送 TTS 密钥或受鉴权的音频 URL。TTS 和 Vivix 分别计费。格式、余额或生成失败明确报错，不降级为 Vivix 音色；挂断会取消生成，迟到音频不会发送。静音时不生成台词音频、只发送视觉动作，并在进房前 `muteRemoteAudio('*', true)`，`autoReceiveAudio=false`；用户仍可开麦转写、阅读对白。以上选择从下一次通话生效，已进行的通话保持创建时配置。

用户或角色发起的视频电话接通后，BYND 用当前角色人设、最近剧情和真实/虚拟时间提取场景，默认使用角色卡 `imageReference` 生成开场图。生图失败会停止，不会自动丢弃参考图或创建 Vivix 会话。关闭场景生图时直接使用角色参考图，视觉环境以该图为准。

创建 `vivix-a1-stream` / `vivix-a1-stream-lite` 会话，使用 TRTC 播放连续音视频，WebSocket 控制通道发送 `response.create` 的 `script.vocal` 与 `script.visual`。BYND 仍使用已有聊天接口生成角色台词与动作，按所选声音来源渲染。RTC 麦克风由开麦按钮启动，Vivix manual turn detection 只转写用户语音，转写再交给 BYND。浏览器禁止自动播放时提供开启声音（静音视频为开启播放）按钮。

麦克风与摄像头分开授权：连接成功后点「开麦」并允许权限，即可直接说话；「静音」会停止上行音频，不提交静音期间的转写。语音识别失败会提示重说或输入文字。连接中和连接失败时麦克风按钮禁用，并显示对应状态。当前摄像头只是本地小窗预览，不向 Vivix 上行相机视频，也不能声称角色能识别用户画面。

开场场景提取使用有界的纯文字角色资料、世界书、记忆与近期剧情，避开普通聊天的工具、状态栏任务和图片历史；内部 JSON 请求不自动补写普通聊天状态栏。失败保留聊天接口的 HTTP、额度、超时或 JSON 格式错误（隐藏密钥），只显示一份详细提示；未成功提取场景不会创建 Vivix 会话。此错误属于 BYND 的聊天接口阶段，不能仅据此判断 Vivix Key 无效。通话记录里的用户挂断提示使用角色给用户的 `userTitle` 备注，未设置时使用用户人设姓名；旧的「用户挂断了电话」记录在卡片显示时同样解析备注，不修改原历史。

普通动作保持同一会话。剧情确实换地点/服装时，BYND 生成同一角色的新场景参考图，`avatar.add` 注册新外观，等待 `avatar.added` 后 `session.update` 切换；只有收到匹配的 `session.update.done` 且 status=completed 才更新内部场景。此过程不重新创建会话，但会产生额外生图用量。A1 不保证仅凭文本产生任意新服装或全新环境。

播放首帧前不显示视频已就绪；台词/动作等待 `response.done`，应用维护本地队列，避免超过官方允许的一个待执行响应。挂断会断开 RTC/控制连接并调用关闭接口，创建中的迟到会话也会关闭。关闭未确认会提示重试。每次最长 20 分钟，断连 60 秒/互动闲置 5 分钟会自动回收；超时未知结果应同时在平台核查。

官网 API 未返回跨域预检允许头，因此官方地址通过 BYND Worker 转发。2026-10-07 已上线 `/mcp/relay/vivix`，真实浏览器验证了跨域预检、缺少 Key 的本地拒绝及无效 Key 的官方响应；版本 `0e313878-de48-4190-b2b8-45a6a0f33613`。用户保持 API 地址 `https://api.vivix.ai`，重试测试连接即可。真实 Key、账户额度与付费视频会话仍须实际联调。自定义中转须实现官方 REST 响应信封，以及接受 `{image: dataURL}`、返回 `{code:0,data:{url:HTTPS_URL}}` 的 `POST /images`。本地通话验证使用模拟上游/RTC，没有产生付费 Vivix 会话。

核对的官方文档（创建会话与语音对话于 2026-10-08 再次核对）：

- [创建会话](https://docs.vivix.ai/streaming-avatar/api-references/sessions/create)
- [TRTC 浏览器连接](https://docs.vivix.ai/streaming-avatar/integrate/trtc)
- [语音对话、开麦与打断](https://docs.vivix.ai/streaming-avatar/interaction/conversation)
- [台词与动作](https://docs.vivix.ai/streaming-avatar/api-references/client-events/response-create)
- [新外观注册](https://docs.vivix.ai/streaming-avatar/api-references/client-events/avatar-add)
- [会话切换](https://docs.vivix.ai/streaming-avatar/api-references/client-events/session-update)
- [服装与场景限制](https://docs.vivix.ai/streaming-avatar/interaction/outfits-and-scenes)

验证：`node tests/run.cjs`；`node scripts/check-vivix-browser.cjs`（mock REST/RTC，包含 320/375px、47/59px 与两种安全区所属容器布局）。
