# THE MEMORY PALACE

> **Live Website:** https://yns34-hub.github.io/
>
> **Museum:** https://yns34-hub.github.io/museum/


**Jie Tian's personal world — collected, not generated.**

真实项目、留下来的画面、梁博的音乐偏好、非线性数学与未完成的想法进入同一个可探索的世界。入口保留 pearl / ice / glass；项目馆、研究馆、音乐室、壁纸库、Imagined Worlds、Archive 与 Unfinished Wing 使用各自的建筑、作品和照明。

原学术页面、非线性玻璃研究和五步人工主导数学审阅流程继续保留。旧页面位于 `/legacy/`，既有 `/Benjamin/`、`/douyin/`、`/douyin-mindazhiguang/` 保留。

## 运行

需要 Node.js 22.12+。Windows Steam 导入脚本需要 PowerShell 7 (`pwsh`)。

```bash
npm ci
npm run dev
npm run lint
npm test
npm run build
npm run preview
```

`npm run dev` 和 `npm run build` 自动扫描私人目录。新增文件后重启 dev 或重新 build；无需编辑网站代码。开发地址以终端输出为准。

## 增加我的东西

```text
personal-media/
  projects/          # 自己项目的图片、截图
  wallpapers/        # 精选壁纸截图或导出图
  chatgpt-images/    # 保存的 ChatGPT 视觉作品
  music/             # 自己合法拥有的本地音频
  research/          # 研究图像、可视化
  collection.json    # 可选全局 metadata
```

图片支持 PNG / JPG / JPEG / WEBP / AVIF，音频支持 MP3 / FLAC / WAV / M4A，子目录会递归扫描。没有 metadata 时以文件名生成标题。文件夹内可放 `collection.json`，按相对文件名索引：

```json
{
  "glass-whale.png": {
    "title": "A quiet organism",
    "category": "glass",
    "year": "2026",
    "favorite": true,
    "order": -10,
    "origin": "AI-assisted visual study"
  }
}
```

`cosmic` / `glass` / `portrait` 分别进入 Cosmic、Glass Life、Portrait 房间，其余进入 Imagined Worlds。`order` 较小的先展示。原图保持比例。作品超过房间容量时通过 **More studies / More horizons** 进入下一展翼。私人研究和项目图片也会扩展展翼。

[完整媒体说明](personal-media/README.md)。ChatGPT Library 没有直接连接；请把导出或保存的作品放入相应文件夹。不要给来源不明的收藏冒认作者或生成来源。

## GitHub 策展

运行 `npm run sync:github`，使用已经登录的 GitHub CLI (`gh`) 检查 YNS34-hub 当前公开仓库、README 和 `docs/public/assets/screenshots/preview/images`。审计快照位于 `content/public-project-audit.json`。运行和 build 不需要联网或 GitHub token。

Hero 展品使用真实项目截图：The Memory Palace、VOID//ECHO、Big Mouth Burger、Giannis Editorial、Sci-Fi Portfolio；Nonlinear Glass Study 使用原有真实玻璃研究素材并链接保留页面。有真实 demo 才显示 **ENTER PROJECT**，公开源码显示 **SOURCE**。截图来源见 [项目视觉说明](public/media/projects/README.md)。

Research Vault 单独展示数学与 Reviewer-First Audit；后者只展示已经公开的合成数据演示图，不暴露私人仓库、评审或论文。fork 明确标为 REFERENCE；未经过策展的新原创仓库先进入 Archive / PROTOTYPE，不会自动成为 Hero。

## Wallpaper Engine 与图片影院

`npm run import:steam` 读取 Steam 注册表和 `libraryfolders.vdf`，检查多个 library 的 `steamapps/workshop/content/431960`。快捷方式 `.url` 不是壁纸。脚本仅复制精选预览图，已存在的高分辨率图片不会被预览覆盖；不会解包场景或复制商业音乐。库存仅保存在本机。使用自己导出的高质量截图替换预览即可。

没有 Steam / Windows 文件系统时，把图放进 `personal-media/wallpapers/` 即可。默认公开仓库不附带生成的 filler 壁纸。

走近图像时，环境主色和光线缓慢适应。点击作品进入 Wallpaper Cinema：← / → 切换，♡ 收藏，i 查看作品信息，ESC 返回。界面隐去，图像以原比例占据主要视野。浏览器 **IMPORT IMAGES** 不上传文件，Blob 和 metadata 存入 IndexedDB。

## Personal Listening Room

梁博 — 男孩 / 出现又离开 / 日落大道 / 灵魂歌手只是偏好 metadata，没有版权歌曲文件。中央是 smoked-glass kinetic audio sculpture，声音只克制地影响折射、细光带与呼吸。

**IMPORT MUSIC / RECONNECT LIBRARY** 在本机读取音频标签、专辑、封面和时长。IndexedDB 保存 Blob 和 metadata，刷新后恢复；存储受限时显示明确提示。清除浏览器数据后通过 Reconnect 重新导入原文件。声音需用户手势启动，可独立调节音乐、环境与空间提示音。

音乐室的墙面跟随当前歌曲显示标题、歌手和歌词。音频内嵌歌词与同名 `.lrc` 自动读取；在播放器 **IMPORT LYRICS** 可绑定本地 LRC / TXT，并在 Record Notes 调整时间偏移。带时间戳的歌词按原生播放器进度滚动，拖动进度立即定位；无时间戳的文字保留手动阅读，缺少歌词或纯音乐提示不伪造内容。歌词与音频都只留在本机。低频照明、中频鳍片、高频细节来自真实分析，暂停后回到静止。

小型 UI 使用自托管 Space Grotesk；展品标题使用编辑字体，大幅入口标题保留 Palace Sans。馆标采用折叠门洞与玻璃核心轮廓，透明底、13 / 8 px 层级与固定字距；只随建筑背景改变字色。

## 探索与舒适度

WASD / 方向键移动，鼠标拖动查看，Shift 加速，M 打开 Guide，ESC 关闭详情。触控使用 Tour；`/?view=index` 提供可读索引。设置包含画质、Reduce Motion、音量和灵敏度。每个主房间有独立 URL，收藏展翼也生成分享路径。自动质量调节、有限纹理分辨率与五个驻留长廊区段限制资源占用。

房间背景、fog、ambient/key light 和图像主色通过逐帧缓动适应。玻璃生命体的光影、音乐室低频进入提示、壁纸降光、Cosmic 开放远景、Archive 干燥近声和 Unfinished UI 消隐构成克制的空间变化。Reduce Motion 保留作品与导航。

## 私人构建与公开发布

私人素材、私人 collection.json、生成的 `public/personal-media/` 与库存不进入 Git。**本机 `npm run build` 会包含私人素材，勿把该 dist 当作公开发布包。**

```bash
npm run build:public
```

这个命令生成空的私人 manifest，排除私人目录的所有文件。已明确选入展馆的图片和网站截图由 `content/selected-collection.json` 与 `public/media/selected/` 提供，因此公开版本也有真实视觉内容。GitHub Actions 使用它验证 / 发布公开版本；线上访客仍可以本地导入。公开后，本机运行 `npm run media:register` 恢复私人预览。商业歌曲和私有网站 HTML 没有进入公开仓库。

## 视觉收藏与房间配乐

当前精选作品来自 Jie Tian 指定的图片文件夹，按 **User-selected visual reference** 标注，不冒认 AI 生成来源或原作者。此前来源不明的 DeepSeek 图片已从活动收藏中移除。冰雪电影画面进入壁纸库，深蓝与红色画面进入 Visual Collection，暖色排版参考进入 Editorial Studio。

**LIQUID WEB** 将 8 个真实网站预览放在巨型主屏和两侧展墙，超过容量会延伸至第二展翼。公开版本展示预览并提供原仓库 SOURCE；本机私人版本也能 ENTER PROJECT 打开原 HTML。原仓库仍保持私有。首页有该展区的入口，Guide 与长廊也可进入。

音乐目录在 build 时自动读取 artist / title / album / artwork / duration。可以在 `personal-media/music/collection.json` 指定配乐房间：

```json
{
  "song.mp3": {"rooms": ["music", "archive"], "favorite": true}
}
```

浏览器收藏里的歌曲也能在 **RECORD NOTES → ROOM SOUNDTRACK** 选择房间，绑定保存在 IndexedDB。第一次点击或按键后，进入指定房间开始本机播放；展翼沿用母房间配乐，切换歌曲使用现有 crossfade。Settings → Room soundtracks 可关闭自动配乐，Mute 始终生效。没有音频的梁博偏好条目不会自动播放，未指定配乐的房间保留当前歌曲。

## 验证与结构

`npm test` 验证内容、路由、碰撞、音频与私人媒体扫描 / 公开排除。`scripts/verify-personal-world.mjs` 在 dev 服务器验证原生导览、每个房间的 WASD、影院键盘控制、收藏、图片和音频导入及刷新恢复。`npm run qa:visual` 截取八个主空间；环境变量 `PALACE_URL`、`PALACE_BROWSER`、`PALACE_ARTIFACTS` 控制地址、浏览器和输出位置。

旧的 `qa:visual` 记录使用 SwiftShader，不代表独立显卡 FPS。本轮 `qa:quality` 和 `qa:performance` 使用已安装 Edge，并记录实际 renderer；性能验收来自可见桌面浏览器。构建生成静态作品页、SEO、sitemap 和 GitHub Pages 404 fallback。旧版本视觉记录保留在 docs，属于上一轮设计。

核心文件：`src/world/World.tsx`（当前渲染入口）、`src/rooms/`（独立建筑与展陈）、`src/world/artDirection.ts`（房间照明）、`scripts/register-personal-media.mjs`（自动注册）、`src/systems/library.ts`（本地收藏）、`src/ui/LyricsProjection.tsx`（空间歌词）、`src/ui/CinemaControls.tsx`（影院）、`content/`（公开策展）。

This place continues to grow with me.


## 空间与导入（quality-leap 分支）

中庭使用低入口框景、闭合的双凹腔玻璃实体与收藏显影；聆听室由弧形声学构件、厚玻璃鳍片和静止聆听点组成；回廊保持五段常驻，同时改变横截面、侧向开口和光井。回廊 −003 的门在实际访问后开放更大的内部空间；这是有限访问状态与独立内室的转换，没有实现 portal 渲染。

屏幕保持原始 sRGB；摄影印刷品接受受限的照明，保留肤色和暗部；投影仅用于短暂显影。玻璃使用同一闭合实体和 PMREM 环境，在中低画质保留轮廓。没有全馆实时镜面。

Guide → **Arrange / import works** 可预览批量素材，确认目标房间、类别和主展品，再进入实际展位。图片可调整顺序、转移展厅、移除与恢复。资源引用共享稳定 ID，旧 IndexedDB v1 收藏仍保留。影院返回原房间、位置和朝向；二维入口也返回原索引分类。网站预览只在主动激活后装载一个 sandbox iframe，关闭后卸载；受限的网站保留截图与外部入口。

```bash
npm run qa:quality      # 同机位截图；PALACE_PHASE / PALACE_ARTIFACTS 控制输出
npm run test:quality    # 本机开发预览：导入、返回、回廊和真实音频流程
npm run qa:performance # 可见桌面浏览器；实际 renderer 写入报告
```

这些脚本默认连接 `http://127.0.0.1:5190`；先用 `npm run dev -- --port 5190 --strictPort` 启动。Windows 默认使用已安装 Edge；其他环境通过 `PALACE_BROWSER` 指定浏览器。`PALACE_TEST_TRACK` 可选本机已有合法歌曲；默认使用仓库自带 Palace Study，不下载音频。性能报告使用实际 GPU 名称与帧时间，截图的短时 headless 数据不作为目标硬件验收成绩。

本轮同机位对比、实际测试、GTX 1650 采样及未测范围见 [空间重构验证记录](docs/quality-leap/README.md)。
