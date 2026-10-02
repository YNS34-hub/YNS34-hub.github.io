# THE MEMORY PALACE

**An Infinite Gallery of Projects, Research, Music, Images and Experiments**

Jie Tian 的可进入数字艺术馆。非线性数学研究、公开项目、私人原型、音乐、图像与未完成的想法，成为一座持续生长的建筑。白色主大厅中的蓝白玻璃核心连接 Project Gallery、Research Hall、Listening Room、Wallpaper Archive、AI Playground、Unfinished Futures 和确定性生成的 Infinite Corridor。

原有身份、科研方向、五步 AI 数学审阅流程与非线性玻璃研究保留。原学术页面在 [/legacy/](https://yns34-hub.github.io/legacy/)，既有 `/Benjamin/`、`/douyin/`、`/douyin-mindazhiguang/` 继续可访问。

> A convincing explanation is not the same as a proof.

## 开发与验证

需要 **Node.js 22.12+**。

```bash
npm ci
npm run dev
npm run lint
npm test
npm run build
npm run preview
```

实际浏览器检查使用 `npm run test:browser`。首次运行前安装 Chromium：`npx playwright install chromium`。生产产物在 `dist/`。

2026-10-02 的生产验证：41 项单元测试、lint、build 与 10 项浏览器检查通过；42 个静态路径、31 个本地资源、4 个旧页面及 404 fallback 检查通过。详细范围、截图与性能测量限制见 [验收记录](docs/verification.md)。

## 探索方式

桌面 Explore：WASD / 方向键移动，鼠标查看，Shift 轻微加速，点击展品进入 Focus，ESC 释放鼠标或关闭详情，M 打开建筑导览。移动端默认 Tour，使用拖动查看与触控导航。Guide 提供 Quick Travel、最近访问、书签与 RETURN TO ATRIUM。

设置可切换 Explore、Tour 或完整的 **2D INDEX VIEW**；`/?view=index` 直接打开文字索引。索引仍然支持作品详情、音乐和图片，不依赖 WebGL。首次引导只展示一次。本地记住访问、已查看作品、书签、上次房间、播放列表、音量、画质与偏好。再次进入可继续探索或返回主大厅，无账号和服务器。

## 内容系统

```text
content/
  profile.json             # 身份、联系与研究方向
  projects.json            # 公开项目及诚实标注的私人原型
  research.json            # 在修研究、数学方法
  experiments.json         # 交互与生成实验
  archive.json             # 未完成作品和有归属的外部参考
  music.json               # 静态音乐与官方分享链接
  wallpapers.json          # 静态图像
  rooms.json               # 展馆定义
  review-workflow.json     # 原有五步审阅流程
  github-snapshot.json     # 可选公开仓库同步快照
```

类型在 `src/content/types.ts`，统一入口在 `src/content/catalog.ts`。新增内容只需要 JSON 与 media，不修改核心组件。`id` 应唯一，使用小写字母、数字与短横线。

### 添加项目、实验或档案

将视觉素材放入 `public/media/projects/`，在对应 JSON 数组添加：

```json
{
  "id": "my-project",
  "title": "My Project",
  "subtitle": "One sentence describing the idea.",
  "description": "Purpose, my role, and current limitations.",
  "category": "project",
  "github": "https://github.com/YNS34-hub/my-project",
  "demo": "https://example.com/",
  "cover": "/media/projects/my-project.webp",
  "video": "/media/video/my-project.mp4",
  "year": "2026",
  "date": "2026-10-02",
  "featured": true,
  "roomType": "installation",
  "roomRule": "floating",
  "tags": ["TypeScript", "WebGL"],
  "status": "Prototype"
}
```

`github`、`demo`、`cover`、`video`、`roomRule` 可省略；不要填写不存在的链接。类别为 `project` / `research` / `experiment` / `archive`。内容超过当前展翼容量后会生成更多展翼。

科研可额外填写 `abstract`、`equation`、`authors`、`journal`、`links: [{"label":"PDF","url":"/media/research/paper.pdf"}]`。只有真实作者、发表记录与来源才应填写。当前研究稿明确处于 revision，没有虚构期刊或论文作者。外部 fork 明确保留上游归属。

### 可选 GitHub 同步

```bash
npm run sync:github -- --dry-run
npm run sync:github
```

GitHub Public API 无需私人 Token。同步保存经过筛选的本地快照，把新非 fork 仓库加入配置；保留已有策展描述、私人原型与 fork 归属。新增仓库随后需要补充角色说明和视觉素材。API、网络或限流失败时保持原配置；运行与构建不依赖 GitHub API。`curl` 是原生 fetch 不支持当前代理时的可选传输回退。

### 添加静态音乐

合法拥有的音频放入 `public/media/music/`，修改 `content/music.json`：

```json
{
  "id": "my-track", "title": "Track title", "artist": "Artist",
  "album": "Album", "cover": "/media/music/cover.webp",
  "src": "/media/music/my-track.mp3", "year": "2026",
  "favorite": true, "source": "static"
}
```

支持 MP3、M4A、OGG、WAV，以及浏览器可解码的 FLAC 等格式。附带 **Palace Study — No. 01** 是本项目新生成的原创合成环境乐，无采样或商业歌曲，也不代替主人的真实音乐收藏。

Listening Room 的 **IMPORT MUSIC** 用 File API 读取本机文件，尝试解析 Title、Artist、Album、Year 与内嵌封面；读取失败时使用文件名，Record Notes 可手动修改。音频 Blob 与收藏信息存入 IndexedDB，不上传。刷新后恢复；隐私模式、存储配额或清除站点数据可能影响恢复，失败会显示提示。

播放器支持 Play / Pause、Previous / Next、Progress、Volume、Shuffle、Repeat 与可选 Crossfade。跨房间继续播放。刷新后恢复列表、最后曲目、位置与音量，再次主动点击才能启动音乐，遵守 autoplay 限制。

### 网易云收藏

点击 **+ NETEASE LINK**，保存官方歌曲、歌单或专辑分享 URL，填写标题和 Artist。静态 JSON 可使用 `"source":"netease"`、`"url":"https://music.163.com/#/song?id=..."` 并省略 `src`。链接打开官方页面；可在 Record Notes 的 **PAIR WITH LOCAL AUDIO** 中配对合法拥有的本地文件。

仅收藏分享链接与用户提供的 metadata，不抓取受保护音源，不绕过会员、版权、DRM 或反盗链。没有可播放音频时保留外部链接。

### 添加图片与 Wallpaper Cinema

素材放入 `public/media/wallpapers/`，在 `content/wallpapers.json` 添加：

```json
{
  "id": "my-image", "title": "Image title",
  "src": "/media/wallpapers/my-image.webp",
  "description": "A short curatorial note.", "tags": ["Light"],
  "category": "Photography", "source": "Original / attribution or URL",
  "date": "2026-10-02"
}
```

**IMPORT IMAGES** 接受 JPG、PNG、WEBP、AVIF，在本机读取并保存到 IndexedDB，不上传。可查看原比例全屏、来源、标签与收藏日期，点击 **ENTER WALLPAPER CINEMA** 将图像带入建筑。Cinema 使用投影、层次与克制的主色适应，不声称重建真实 3D 世界。

内置五幅图像是本项目原创数值艺术：建筑光线追踪、标量场等值线、参数地形与夜间几何构图。用于项目展览时明确标注为艺术解释，不冒充真实项目截图。

## 房间模板与特殊规则

`content/rooms.json` 定义 `id`、`number`、`title`、`subtitle`、`type` 和可选 `rule`、`color`、`hidden`。同模板内容通过配置扩展；全新建筑模板在 `src/rooms/` 添加组件，并在世界入口加入映射。

七种模板：`white-cube`、`black-box`、`archive`、`installation`、`listening`、`image-gallery`、`anomaly`。内容的 `roomType` / `roomRule` 决定确定性长廊展室，每件作品有 `/exhibit-<id>/` 地址。长廊将主展馆、单件展室与少量异常空间编织在一起。`src/world/roomPlan.ts` 是配置与模板的共同解析入口。

| 规则 | 表现 |
| --- | --- |
| `mirror` | 重复镜像几何，避免无限递归反射 |
| `gravity` | 平滑改变建筑方向；Reduce Motion 跳过旋转 |
| `floating` | 漂浮装置与透明路径 |
| `compressing` | 空间逐渐收束，保留可通行区域 |
| `impossible` | 门内尺度大于门外建筑 |
| `loop` | 重复访问时小细节改变 |
| `memory` | 本地访问记忆、灯光与隐藏空间 |

长廊按区段编号和种子生成，保持五个相邻的 22 米区段，用实例化构件复用楼板、柱与玻璃碎片。离开房间后卸载几何、材质和纹理；同一扇门再次进入保持一致。建筑壳在 `src/rooms/Architecture.tsx`，模板与规则在 `src/rooms/Galleries.tsx`，入口映射在 `src/world/World.tsx`。少量记忆空间通过探索解锁，Guide 不直接显示隐藏房间。

## 性能与舒适度

Automatic 根据设备与实际帧耗调整档位，用户也可手动选择 High / Medium / Low。High 的 DPR 上限 1.6，Medium 上限 1.25，Low 为 0.85（触控设备最高 0.8）；中高档使用 1024 阴影，低档关闭阴影与 MSAA。持续低于 42 FPS 时自动降档，较长时间高于 57 FPS 后谨慎升档。档位还控制玻璃复杂度、纹理预算与建筑细节。低档不用原始 80,000 三角形 GLB；移动端始终使用轻量材质与纹理预算。纹理最长边为 Low 768 / Medium 1280 / High 2048。渲染器首次创建时决定 MSAA，运行中降档同时降低 DPR、关闭阴影并缩减折射缓冲区。移动端采用较低预算和触控 Tour。局部加载、实例化、距离细节、视锥裁剪、纹理尺寸控制与卸载回收限制资源。镜面使用有限模拟，无递归镜面、重型 SSR、远程 HDR 或重型后期。

视角 FOV 60°，眼高 1.65 米，正常速度 2.7 米/秒，Shift 速度 4.45 米/秒，有加减速惯性、无镜头晃动。生成资产的来源和可选 Python 再生成方法在 `public/media/generated/README.md`；构建不需要 Python。

设置包含 Reduce Motion、Mute All、Music / Atmosphere / Spatial cues 音量、Mouse Sensitivity 和导航模式。声音只在用户手势后启动。

**性能目标**：GTX 1650 级别 1080p 尽量 ≥45 FPS，较好现代电脑 60 FPS。云端浏览器检查不是实际 GTX 1650 硬件基准。应在目标机器上通过设置中的 FPS 遍历展馆，必要时调整画质。低档位保留内容和交互。

## URL、SEO 与部署

分享 `/projects/<id>/`、`/research/<id>/`、`/music/`、`/wallpapers/` 等 URL，直接进入对应空间。构建后的 `scripts/postbuild.mjs` 生成展馆和作品独立 HTML，含搜索可读语义文本、title、description、canonical、OpenGraph、JSON-LD、sitemap、robots、`404.html` 与 `.nojekyll`。重要文字同时存在于 Canvas 外；旧路由不会被覆盖。

当前仓库为用户站点 **YNS34-hub.github.io**，Vite base 为 `/`。在 GitHub **Settings → Pages → Source** 选择 **GitHub Actions**。main 分支的工作流验证 lint、test、build 后发布 `dist/`，PR 仅验证。无需数据库、后台或私人 Token。

更换域名需修改 `index.html` 和 `scripts/postbuild.mjs` 的 canonical / origin。迁移到 GitHub 子路径仓库需统一修改 Vite base、资源前缀与路由前缀。

## 目录

```text
src/
  App.tsx                  # 体验编排与路由
  content/                 # 类型与 catalog
  world/                   # 相机、质量、局部世界和共用组件
  rooms/                   # 主大厅、展馆、长廊与特殊空间
  systems/                 # 状态、IndexedDB、本地收藏
  audio/                   # 持久播放器、空间声音
  ui/                      # Guide、Focus、设置、索引与收藏
public/
  assets/                  # 原有字体、模型与素材
  media/generated/         # 原创图像、OG 图、音乐研究
  media/music/             # 静态音频
  media/wallpapers/         # 静态图像
  media/projects/          # 项目视觉
  media/research/           # PDF 与研究图示
  media/video/             # 视频
  legacy/                  # 保留的学术网站
scripts/
  sync-github.mjs           # 可选公开同步
  postbuild.mjs            # 静态路由与 SEO
  check-palace.mjs          # 浏览器 QA
tests/                     # 内容、空间与本地收藏检查
```

新世界使用 React、TypeScript、Vite、Three.js、React Three Fiber、Drei、Zustand、原生 Web Audio 与 IndexedDB。字体、核心视觉和 fallback 均本地提供。旧 `sphere.js`、vendor Three.js 和模型保留供 legacy 使用。

This place continues to grow with me.

## 生产环境浏览器验证

启动 `npm run preview -- --port 4173`，另开终端：

```bash
PALACE_URL=http://127.0.0.1:4173 PALACE_VERIFY_DIST=1 PALACE_ARTIFACTS=./qa-artifacts npm run test:browser
PALACE_URL=http://127.0.0.1:4173 PALACE_ARTIFACTS=./qa-artifacts npm run test:audio-travel
```

Windows PowerShell 可先设置 `$env:PALACE_URL="http://127.0.0.1:4173"`、`$env:PALACE_VERIFY_DIST="1"`。`PALACE_STATIC_ONLY=1` 只检查部署文件、路由、SEO 与资源；无需运行 WebGL。浏览器脚本覆盖本地音频／封面／图像导入和刷新恢复、合法网易云链接、播放器跨房间状态、所有主展馆、独立作品展室、Guide、设置、嵌套全屏键盘交互、桌面和手机布局。开发模式另检查实际相机位置、碰撞和五个驻留长廊区段；生产构建不暴露调试相机。测试记录和截图写入 `PALACE_ARTIFACTS`。这些是功能与视觉证据，不是 GTX 1650 的硬件基准。
