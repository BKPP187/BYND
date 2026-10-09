# 音乐搜索与播放

发送音乐和音乐 App 共用 `searchAcrossMusicSources`。网易云模式和多源模式优先调用 BYND 的 `/netease/api/search`，结果保留歌名、歌手和网易云歌曲 ID；没有音频地址的歌曲仍能显示，选中后再通过已有的 `/song/url/v1`、`/song/url` 确认播放地址。获取失败或返回空地址时不允许发送音乐卡片，也不将未验证的 Meting URL 当成成功。

默认 Meting 接口只是补充来源。公开曲库只查标题和创作者，并核对返回曲目的标题、歌手，避免短关键词命中录音正文后返回无关资料。搜索失败和成功但没有结果分别显示；渲染列表不会覆盖失败提示，旧请求不会覆盖新关键词的结果。

本次服务端修改在 `workers/bynd-netease-audio-worker.js`：添加 `/search` 和 `/cloudsearch` 白名单与歌曲搜索处理。上线必须单独部署 `workers/wrangler-netease-audio.toml` 对应的 `bynd-netease-audio` Worker；只更新网页无法消除旧 Worker 返回的 `403 netease api path not allowed`。不需要更换音频票据密钥或新增路由。

验证：`node --test tests/music-search.test.cjs`；`node scripts/check-music-search-browser.cjs` 会用本地 Worker 调用真实曲库搜索《如何》、`PP Krit` 和 `pp`，并在浏览器中验证手机窄屏、音源失败及发送限制。测试使用独立浏览器会话，不读取用户的网易云登录状态。
