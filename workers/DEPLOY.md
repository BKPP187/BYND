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

## 两个访问地址

- `https://bynd-push.myluckylxy.workers.dev/<路径>`：部署后立即可用，APK 和网页都能调用。**但 workers.dev 在国内很多网络下连不上。**
- `https://bynd.ccwu.cc/<路径>`：和网页同域名，国内能访问。需要在 `bynd.ccwu.cc` 这个域名上挂 Worker 路由（`wrangler.toml` 里的 `routes`）才生效。

前端的处理方式：
- Jev（`modules/decision/jev.js`）：生产网页先试同域地址，返回 404/405 或网络失败时自动改用 workers.dev。
- 聊天/生图中转（`settings.js` 的 `BYND_PINNED_API_PROXIES`）：只有标了 `sameOriginRoute: true` 的才走同域。路由挂好后，把对应条目改成 `true`（并同步 `tests/api-proxy.test.cjs`）。

## 需要的 Cloudflare API Token 权限

在 Cloudflare 后台 → 右上角头像 → **My Profile → API Tokens**，创建或编辑一个 token，加这些权限：

| 类型 | 权限 | 级别 | 用途 |
|---|---|---|---|
| Account | Workers Scripts | Edit | 上传 Worker 代码 |
| Account | Workers KV Storage | Edit | 推送用的 KV 绑定 |
| Zone | Workers Routes | Edit | 在 `bynd.ccwu.cc` 上挂路由 |

「Zone Resources」选 **Include → Specific zone → bynd.ccwu.cc**。
Account 选 `Myluckylxy@gmail.com's Account`（ID `7962d55c8c26eddfab2bbeb961a249a8`）。

token 只在部署时通过环境变量传给 wrangler，**不要写进仓库、不要提交**。

## 部署步骤

在项目的 `workers` 目录里（Git Bash）：

```bash
export CLOUDFLARE_API_TOKEN='你的 token'
export CLOUDFLARE_ACCOUNT_ID=7962d55c8c26eddfab2bbeb961a249a8
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
curl -s -o /dev/null -D - -X OPTIONS https://bynd.ccwu.cc/jev/v1/systemone \
  -H 'Origin: https://bynd.ccwu.cc' -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: authorization,content-type'
```

把上面的 `bynd.ccwu.cc` 换成 `bynd-push.myluckylxy.workers.dev` 可以检查 workers.dev 地址。

## 常见问题

**`Trigger configuration ... was only partially updated` / `Routes: No access to the specified resource`**
代码已经上线，但 token 没有 `Zone → Workers Routes → Edit` 权限，`bynd.ccwu.cc` 上的新路由没挂上（旧路由不受影响）。按上面的表格给 token 加权限后重新 `npx wrangler deploy`。

**`Not logged in. Your auth token has expired`**
wrangler 的浏览器登录过期了。设置 `CLOUDFLARE_API_TOKEN`，或重新 `npx wrangler login`。

**新增一个需要转发的服务**
1. `bynd-push-worker.js` 的 `PINNED_API_PROXIES` 加一条（固定上游 origin 和允许的接口）。
2. `wrangler.toml` 的 `routes` 加 `bynd.ccwu.cc/<路径>/*`。
3. 前端配置对应地址；部署并确认路由挂上后，再让前端走同域。

## 部署记录

- 2026-09-24：上线 `/l0veyou`、`/jev` 转发（Worker 代码已在 workers.dev 生效）。当时的 token 缺少 Zone 路由权限，`bynd.ccwu.cc/l0veyou/*` 和 `bynd.ccwu.cc/jev/*` 路由未挂上，前端走 workers.dev。BYND 用户使用海外模型本来就开着代理，workers.dev 可以访问，所以**这一步不是必须的**，不要为此让用户去 Cloudflare 后台操作；只有以后要支持不开代理的国内网络时才需要补路由权限。
