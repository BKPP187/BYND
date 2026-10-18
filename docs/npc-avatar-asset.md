# NPC 头像

未配置聊天生图服务时，按 NPC 申请 ID 稳定分配以下六款备用头像，分配后保存，不随打开页面变化。图片均为 256 × 256 WebP，由内置 imagegen 生成后缩小压缩；应用仅打包压缩图，不内嵌 Base64 副本或原始 PNG。

| 款式 | 资源 |
| --- | --- |
| 珍珠光环 | `assets/avatars/npc-default-pearl-v1.webp` |
| 星光光环 | `assets/avatars/npc-default-star-v1.webp` |
| 灰白波点 | `assets/avatars/npc-default-dots-v1.webp` |
| 天使小猫 | `assets/avatars/npc-default-cat-v1.webp` |
| 线稿小兔 | `assets/avatars/npc-default-bunny-v1.webp` |
| 冰蓝爪印 | `assets/avatars/npc-default-paw-v1.webp` |

配置了聊天生图服务时，应用依据 NPC 自己的人设与世界书生成头像，压缩为本地小图后保存到角色数据。失败时保留默认头像，详情页提供重试；已有自定义头像不被替换。

珍珠光环使用的完整提示词：

> Use case: stylized-concept. Asset type: a single production-ready default profile avatar for a fictional chat app. Generate ONE square avatar, filling the whole canvas, inspired by the user's soft gray-and-white anonymous profile references: a centered anonymous pearl-white round head and rounded shoulders on a very light cool-gray background, a delicate little silver halo floating above the head, two tiny soft gray paw-print accents near the lower shoulder edges, a few faint white polka dots in the background. Gentle pearlescent highlights, subtle frosted glass depth, simple restrained shapes, cute and calm, gender-neutral and age-neutral, no facial features, no hair, no clothing detail, no actual human likeness. The head and shoulders must remain instantly legible at 40px. Center the subject with generous safe margins so the same square image crops well as a circle or a rounded square. Soft neutral grayscale palette with extremely subtle icy blue and pink pearl sheen. Clean polished raster illustration, not a screenshot, no text at all, no Apple ID label, no logo, no watermark, no border, no grid, no multiple icons. Opaque background, square composition.


星光光环提示词：

> Create ONE square chat profile avatar. Soft clean minimalist flat illustration inspired by the user's grayscale anonymous account avatar references: centered anonymous WHITE round head and rounded WHITE shoulders on a medium-light silver-gray background, a thin white halo above the head and two little white four-point stars near the shoulders. Featureless face, no hair, no clothing detail, no actual human identity. Restrained simple shapes, subtle paper grain, readable at 40px. Centered subject with safe margins for a circle crop or rounded-square crop. Full square opaque background. No text, no Apple ID label, no logo, no watermark, no grid, no multiple icons.

dots 提示词：

> Use case: stylized-concept. Create ONE square chat profile avatar, a clean minimalist flat illustration inspired by gray-white anonymous account avatars. Centered plain WHITE featureless circular head and rounded WHITE shoulders against a soft silver-gray background decorated with evenly scattered small white polka dots. One tiny white four-point star near the top. Calm, cute, restrained, subtle paper texture, no hair, no clothing detail, no identity. Strong legibility at 40px, generous margins for circle and rounded-square crops. Full square opaque background. No text, no Apple ID label, no logo, no watermark, no grid, no multiple icons.

cat 提示词：

> Use case: stylized-concept. Create ONE square chat profile avatar inspired by soft grayscale angel cat anonymous avatars. A centered simple silver-gray cat head and rounded shoulders silhouette with two pointed ears, a tiny floating silver halo, two tiny angel wings peeking beside the shoulders. Featureless face with no eyes or mouth. Gentle near-white background, a few subtle white dots, smooth soft frosted paper texture, minimal cute calm design, no hair or clothing detail. Legible at 40px, safe margins for circular and rounded-square crop, full square opaque background. No text, no Apple ID label, no logo, no watermark, no border, no grid, no multiple icons.

bunny 提示词：

> Use case: stylized-concept. Create ONE square chat profile avatar: a delicate minimalist silver-gray hand-drawn little angel bunny, two long ears, a tiny floating oval halo, tiny dot eyes and a simple small nose, small wings, simple rounded body. Centered on a near-white warm-gray paper background with generous empty margin, soft faint pencil linework with enough contrast to remain recognizable at 40px. Cute calm clean aesthetic inspired by grayscale anonymous account avatars. No border, full square opaque background, circle-crop safe. No text, no Apple ID label, no logo, no watermark, no grid, no multiple characters.

paw 提示词：

> Use case: stylized-concept. Create ONE square chat profile avatar: a centered anonymous frosted pearl-WHITE circular head and rounded shoulders, simple featureless face, pale icy-blue and silver-gray background, two visible soft gray paw prints decorating the head and shoulder, scattered faint tiny dots. Soft gentle pearlescent 3D illustration, powder blue highlights, calm cute neutral aesthetic inspired by gray-white anonymous profile icons. No human likeness, no hair, no clothing details. Readable silhouette at 40px with margins safe for circular and rounded-square crops. Full square opaque background, no border. No text, no Apple ID label, no logo, no watermark, no grid, no multiple icons.

