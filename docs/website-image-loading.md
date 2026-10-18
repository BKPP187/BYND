# 网站小狗图片加载优化（1.1.908）

用户反馈注册页右上角小狗图片加载慢。复现时该页面将1254×1254的PNG原图缩放为84px显示，每次获取2,196,939字节，线上响应`Cache-Control: no-store`；CF自身的资源缓存已HIT，但浏览器不能保留图片。文件大小复现命令`node scripts/check-site-image-loading.cjs`在修复前失败：`account.html: illustration is 2196939 bytes, budget is 150000`。

使用原PNG构建三个保留透明背景的WebP尺寸，原画及构图不变：注册页256px／22,328字节（覆盖84px的3倍屏），领取页480px／63,832字节，购买页840px／181,814字节。原PNG保留作为源文件及旧链接兼容。文件名包含编码内容的SHA-256前12位，仅这些公开图片的成功响应允许一年immutable缓存；HTML和接口继续按自身原有策略响应，404不缓存。

`scripts/prepare-website-images.cjs`以Sharp重新构建图片并更新三个页面引用；可通过`BYND_SHARP`指定已安装的Sharp模块目录。之后执行`node scripts/prepare-distribution-web.cjs`生成网站部署目录。图片编码参数参考 [Sharp WebP](https://sharp.pixelplumbing.com/api-output/#webp)，内容摘要文件名与缓存策略参考 [MDN Cache-Control](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control)。

验证：`node scripts/check-site-image-browser.cjs`在同一本机HTTP服务、相同1Mbps带宽／40ms延迟模拟条件下，原PNG传输17,741ms，新图579ms，第二次访问传输0字节／0ms。此数据是图片请求的受控慢网测试，不是官网整页实测承诺；CF网络建立连接的延迟仍可能存在。320/390px截图已实际查看，47/59px顶部安全区分别由顶栏／父容器预留均通过。结果与截图在`artifacts/website-image-loading/`。购买页320/390/430/1280px检查也通过。

`node tests/run.cjs`：1324通过，0失败、0跳过；日志`artifacts/website-image-tests.log`。已更新原`bynd-license` Worker，保持原D1、密钥、路由及功能开关，部署版本`01d89b83-5dc9-4813-9ee9-00d613c8eb72`，不推送GitHub或重打APK。线上注册页已确认引用新图，图片HTTP200、22,328字节，逐字节等于本机构建，响应为`public,max-age=31536000,immutable`，记录在`artifacts/website-image-loading/live.json`。批量线上核对曾遇到连接超时；复核用户所指的注册页及图片成功，网络偶发延迟仍需和图片体积问题区分。
