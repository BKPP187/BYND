# BYND Worker 部署说明

`bynd-push` 是 BYND 的 Cloudflare Worker，负责这些事：

| 路径 | 作用 |
|---|---|
| `/subscribe` 等 + 每 15 分钟定时任务 | 后台消息推送 |
| `/mcp/*` | 远程 MCP 转发（GitHub MCP 等） |
| `/font-proxy` | 字体代理 |
| `/wisart/*` | Wisart 生图接口转发 |
| `/l0veyou/*` | l0veyou 中转站转发（模型列表、聊天、生图） |
| `/jev/*` | TypeSafe Jev 决策接口转发 |

这些转发存在的原因：这几家服务不允许浏览器网页直接调用（CORS），网页版必须经过一个服务器中转。每条转发都写死了上游地址和允许的接口，不是开放代理；用户的 API Key 只是原样转发，Worker 不保存。

## 访问地址

前端只使用 BYND 自己的域名，不暴露 Worker 的 workers.dev 地址：

- `bynd.ccwu.cc/mcp/*` 和 `bynd.ccwu.cc/wisart/*`、`/font-proxy*` 的路由早已挂在这个 Worker 上。
- 所有固定转发（Jev、l0veyou、wisart）同时响应 `/<名字>/...` 和 `/mcp/relay/<名字>/...`。前端统一用 `https://bynd.ccwu.cc/mcp/relay/<名字>/...`，网页版和 APK 都一样，不需要为新转发再挂路由。
- 账单里只显示真正的服务方（如 `api.typesafe.ai`、`l0veyou.com`），不显示转发地址。

## 需要的 Cloudflare API Token 权限

在 Cloudflare 后台 → 右上角头像 → **My Profile → API Tokens**，创建或编辑一个 token，加这些权限：

| 类型 | 权限 | 级别 | 用途 |
|---|---|---|---|
| Account | Workers Scripts | Edit | 上传 Worker 代码 |
| Account | Workers KV Storage | Edit | 推送用的 KV 绑定 |
| Zone | Workers Routes | Edit | 在 `bynd.ccwu.cc` 上挂路由 |

「Zone Resources」选 **Include → Specific zone → bynd.ccwu.cc**。
Account 选 BYND 所在的 Cloudflare 账号。

token 只在部署时通过环境变量传给 wrangler，**不要写进仓库、不要提交**。

## 部署步骤

在项目的 `workers` 目录里（Git Bash）：

```bash
export CLOUDFLARE_API_TOKEN='你的 token'
export CLOUDFLARE_ACCOUNT_ID='你的 Account ID'
npx wrangler whoami          # 确认登录的是上面那个账号
npx wrangler deploy --dry-run  # 只打包检查，不上线
npx wrangler deploy
```

也可以不用 token，改用浏览器登录：在能弹出浏览器的终端里运行 `npx wrangler login`，再 `npx wrangler deploy`。

部署前先跑测试：在项目根目录 `node tests/run.cjs`，其中 `tests/api-proxy.test.cjs` 会检查 Worker 路由表和前端配置是否一致。

## 部署后检查

```bash
# 路由已挂上时，同域地址会由 Worker 回应（401/403/JSON），而不是 GitHub Pages 的 404/405 网页
curl -s -o /dev/null -w '%{http_code}\n' -H 'Origin: https://bynd.ccwu.cc' https://bynd.ccwu.cc/wisart/v1/models

# Jev 转发的浏览器预检，应返回 204 且带 Access-Control-Allow-Origin: https://bynd.ccwu.cc
curl -s -o /dev/null -D - -X OPTIONS https://bynd.ccwu.cc/mcp/relay/jev/v1/systemone \
  -H 'Origin: https://bynd.ccwu.cc' -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: authorization,content-type'
```


## 常见问题

**`Trigger configuration ... was only partially updated` / `Routes: No access to the specified resource`**
代码已经上线，只是 token 没有 `Zone → Workers Routes → Edit` 权限，`wrangler.toml` 里新增的路由挂不上。前端走 `/mcp/relay/*`，不依赖这些路由，可以忽略。

**`Not logged in. Your auth token has expired`**
wrangler 的浏览器登录过期了。设置 `CLOUDFLARE_API_TOKEN`，或重新 `npx wrangler login`。

**新增一个需要转发的服务**
1. `bynd-push-worker.js` 的 `PINNED_API_PROXIES` 加一条（固定上游 origin 和允许的接口）。
2. `wrangler.toml` 的 `routes` 加 `bynd.ccwu.cc/<路径>/*`。
3. 前端用 `https://bynd.ccwu.cc/mcp/relay/<名字>/...`，不要写 workers.dev 地址（`tests/api-proxy.test.cjs` 会检查）。

## 部署记录

- 2026-09-24：上线 `/l0veyou`、`/jev` 转发。
- 2026-09-25：所有固定转发加上 `/mcp/relay/*` 入口，前端改走 `bynd.ccwu.cc`，不再出现 workers.dev 地址。
