# BYND 网页发布

用户要求“提交推送／上传 GitHub”时，默认目标是 `origin/main`。GitHub Pages 已核对为 `main` 分支的根目录；推送工作分支不能代表网页已发布。

先 fetch，检查 main 的独立提交。工作区有其他窗口的改动时，在隔离目录合并，保留线上启动与图标修复；不要强推或覆盖。完成版本同步、测试与浏览器启动检查后，显式推送 `HEAD:main`。未要求 APK 时，提交信息包含 `[skip ci]`。推送后核对远端提交、Pages 部署状态与线上 `core/storage/backup.js` 的 `APP_VERSION`，网页仍是旧版时不得宣告完成。

运行 `node scripts/install-publish-guard.cjs` 安装共享 Git pre-push 检查。同一仓库的窗口和 worktree 都受约束：默认只允许目标 `refs/heads/main`。仅在用户明确指定其他分支时，才可对单次命令设置 `BYND_ALLOW_NON_MAIN_PUSH=1`。已有其他 pre-push hook 时，安装脚本会停止并保留它；不得覆盖。

2026-10-01：功能分支推送被误当成生产发布，导致网页仍为 1.1.764。项目约定已明确默认 main，并在当前仓库的共享 hooks 目录安装检查；新的 clone 需要重新安装 hook。
