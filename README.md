# THE MEMORY PALACE

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

## 探索与舒适度

WASD / 方向键移动，鼠标拖动查看，Shift 加速，M 打开 Guide，ESC 关闭详情。触控使用 Tour；`/?view=index` 提供可读索引。设置包含画质、Reduce Motion、音量和灵敏度。每个主房间有独立 URL，收藏展翼也生成分享路径。自动质量调节、有限纹理分辨率与五个驻留长廊区段限制资源占用。

房间背景、fog、ambient/key light 和图像主色通过逐帧缓动适应。玻璃生命体的光影、音乐室低频进入提示、壁纸降光、Cosmic 顶棚消失、Archive 干燥近声和 Unfinished UI 消隐构成克制的空间事件。Reduce Motion 保留作品与导航。

## 私人构建与公开发布

私人素材、私人 collection.json、生成的 `public/personal-media/` 与库存不进入 Git。**本机 `npm run build` 会包含私人素材，勿把该 dist 当作公开发布包。**

```bash
npm run build:public
```

这个命令生成空的私人 manifest，排除私人目录的所有文件。GitHub Actions 使用它验证 / 发布公开版本；线上访客仍可以本地导入。公开后，本机运行 `npm run media:register` 恢复私人预览。商业歌曲没有进入公开仓库。

## 验证与结构

`npm test` 验证内容、路由、碰撞、音频与私人媒体扫描 / 公开排除。`scripts/verify-personal-world.mjs` 在 dev 服务器验证原生导览、每个房间的 WASD、影院键盘控制、收藏、图片和音频导入及刷新恢复。`npm run qa:visual` 截取八个主空间；环境变量 `PALACE_URL`、`PALACE_BROWSER`、`PALACE_ARTIFACTS` 控制地址、浏览器和输出位置。

截图浏览器使用 SwiftShader，不代表独立显卡 FPS。构建生成静态作品页、SEO、sitemap 和 GitHub Pages 404 fallback。旧版本视觉记录保留在 docs，属于上一轮设计。

核心文件：`src/rooms/PersonalRooms.tsx`（私人世界）、`src/world/artDirection.ts`（房间照明）、`scripts/register-personal-media.mjs`（自动注册）、`src/systems/library.ts`（本地收藏）、`src/ui/CinemaControls.tsx`（影院）、`content/`（公开策展）。

This place continues to grow with me.
