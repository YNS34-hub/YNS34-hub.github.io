# 场景映射与受控升级提案

**本文件保留初始审阅提案。** 用户已批准继续逐一实施，并于 2026-11-01 明确要求合并和部署。当前实现与证据以 [发布整合记录](RELEASE_20261101.md) 为准；以下历史建议不能单独作为完成证明。

## 已核对的源码位置

- 工作容器：`C:/Users/86135/Documents/ChatGPT/博物馆/`。其 Git 尚无提交、无远端；不是可直接构建网站的代码根目录。
- 本次选用现有 checkout：`C:/Users/86135/Documents/ChatGPT/博物馆/visual-audit-work/`，分支 `codex/visual-quality-audit-20261029`。其 `github` 远端确认为 `YNS34-hub/YNS34-hub.github.io`。
- 当前 HEAD 与只读查询的远端 `main` 均为 `a86b3d243d24b6a669407f1a05b662ad2a9f3fe0`。checkout 带有 76 条先前 Git 状态记录，不能把本地预览等同于生产部署；本轮开始前已记录 1,452 个已有文件指纹。
- 读取了用户目录项目规则和本 checkout 的 `AGENTS.md`；使用 Serena 核对符号与场景分派。其他 checkout 保留，不切换其分支。
- 真实结构为 React + React Three Fiber + Drei + Three.js；入口按需加载 `World`，由 `World.Scene` 与 `WorldsBoundary` 分派。保留现有 Zustand 状态、音频、媒体导入、分页和运动系统。

源码入口：[App.tsx](../../../src/App.tsx)、[World.tsx](../../../src/world/World.tsx)、[WorldsBoundary.tsx](../../../src/worlds/WorldsBoundary.tsx)、[rooms.json](../../../content/rooms.json)、[store.ts](../../../src/systems/store.ts)。`roomPath('atrium')` 的规范路径是 `/`；未识别路由会回到中庭。

核查期间，其他工作继续向同一 checkout 写入餐厅和驾驶练习场内容。因此最终发布改用独立 `museum-visual-release` 工作树，从已发布 `a86b3d2` 移植视觉改动，未纳入其他工作线的未发布内容。上述本机路径是初始检查快照；历史铭文审阅不代表新批准，发布保留主分支原文。

## 逐场景映射

下表板编号可在 [素材清单](INVENTORY.md) 中打开；它们指的是板内对应画面，不是建议裁切成运行时贴图。

| 用户目标 | 已验证路由与实现 | 主要参考区域 | 建议改进及必须保留的边界 |
|---|---|---|---|
| 入口中庭 | `/` → [Atrium](../../../src/rooms/Atrium.tsx)；[surfaces](../../../src/rooms/atrium/surfaces.tsx)、[environment](../../../src/rooms/atrium/environment.tsx)、[EntryFloor](../../../src/rooms/atrium/EntryFloor.tsx)、[optics](../../../src/rooms/atrium/optics.tsx)。 | G05 左上中庭、G10 左上天光、G12 左上主焦点；S01 仅作单幅建筑辅助参考。 | 优先改善主装置与背景的明暗分离、石材细部尺度、通行留白、反光范围。保留所有门与 Worlds 入口、欢迎/导览交互及主分支原有铭文。 |
| 数学玻璃雕塑 | **没有独立路由**。`Atrium.Core` → `OpticalCore` → [GlassSculpture](../../../src/world/GlassSculpture.tsx)，加载 `public/assets/memory-glass.glb`；`/glass-life` 也复用该组件。 | G01 上排第 2/4 格、G04 右上、G05 右上、G12 上排中格与右下细节。 | 先在中庭独立布光/环境对比中调清轮廓与厚度感；保持真实网格、透射与近距离点击记忆揭示。不要默认把现有形体换成板中的花形；共享材质变动需同时验证 Glass Life。 |
| 研究室 | `/research` 及既有 `research-page-N` → [PersonalResearch / MediaWing](../../../src/rooms/PersonalRooms.tsx)；[ResearchArchitecture](../../../src/rooms/Architecture.tsx)。 | G03 右上、G05 中排左、G06 上中、G10 中排左、G11 中排左。 | 现状是建筑壳体、数学环面/扭结、公式和研究展板，并非板中的完整书桌图书馆。可分步增加真实书桌/座椅/局部书架，建立阅读光池与景窗层次，避开公式与标题。研究内容、点击聚焦、分页和本地素材保留。 |
| 项目画廊 | `/projects` 及 `projects-page-N` → [PersonalProjects / ProjectScreen / MediaWing](../../../src/rooms/PersonalRooms.tsx)；[ProjectArchitecture](../../../src/rooms/Architecture.tsx)。 | G05 中排中、G07 右上、G10 右上日光长廊、G12 中排左。 | 对齐展示中心线、减轻支架厚度、校准屏幕角度和画面间距，让主项目形成焦点；改善专属照明。保留项目 ID、外部链接、交互项目及全部作品，不以删项目实现留白。 |
| 音乐室 | `/music` → [ListeningRoom / Instrument / AcousticWall / RhythmDetails](../../../src/rooms/ListeningRoom.tsx)，并关联 [LyricsWall](../../../src/rooms/LyricsWall.tsx)、`src/audio/` 和收藏界面。 | G03 中排左、G05 中排右、G07 中排中、G10 中排中、G12 中排中。 | 材质与顶棚形成安静的听音尺度，声音驱动的亮度/运动受控且尊重 reduced motion。实际核心是现有声学装置，不能把板中钢琴当作已实现功能；不替换播放器、歌词、导入或音频状态。 |
| 图像档案 / 摄影展陈 | 主要为 `/wallpapers` 及其分页 → [WallpaperVault](../../../src/rooms/ImageRooms.tsx)；主题房 `/imagined-worlds`、`/cosmic`、`/glass-life`、`/portraits` → `ImageRoom`。共同使用 `VisualWall`、[imageLayout](../../../src/world/spatialLayout.ts)、`ImageArchitecture`。 | G03 中排右、G05 下排左、G08 中排第 3 格、G10 中排第 3 格、G12 下排左。 | 校准挂画高度/宽高比/间距、细框和表面照明。保留每页最多 5 件的既有机制、主题归属、全屏查看、收藏与导入。**`/archive` 是资料/项目归档，不能直接当成摄影展厅；没有已验证的 `/image-archive` 路由。** |
| 篮球世界 | `/basketball` → `WorldsBoundary` → [BasketballCourt](../../../src/worlds/BasketballCourt.tsx) + [CourtArchitecture](../../../src/worlds/CourtArchitecture.tsx)；贴图来自 `public/media/court/`。 | G03 左下、G05 下排中、G08 中排第 4 格、G11 下排第 2 格、G12 下排第 2 格。 | 保留现实街头球场定位；用干燥地面细节、真实线宽、篮板光学和建筑/环境受光提升质量。板中的室内重建、湿镜面地面、人物动作和标志不照搬；不修改运球、投篮、持球、篮网响应、物理或按键。 |
| 骑行世界 | `/cycling` → `WorldsBoundary` → `loadRide()` → [road/Experience](../../../src/worlds/road/Experience.tsx) → [Landscape](../../../src/worlds/road/Landscape.tsx)、[Lake](../../../src/worlds/road/Lake.tsx)、`RoadBike`、人物与地形；`/alpine-ride` 是另一个独立入口。 | G03 右下、G06 下排左山路、G07 下排左、G10 下排第 2 格、G12 下排第 3 格。 | 调整地形近中远景比例、路肩/岸线过渡、植被分布和空气透视；先静态停靠点再完整骑行。不是把山湖概念画贴满墙；`ScenicCycling.tsx` 仍在仓库，但当前 `/cycling` 的动态导入实际指向 `road/Experience.tsx`。保留路线、挡位、刹车、上下车、拍照、影院返回和骑行存档。 |

## 补充意向的边界

Cinema 是实际存在的 `/cinema`，使用 [WallpaperCinema](../../../src/rooms/Wallpapers.tsx) 与 `CinemaControls`；G06/G07/G08/G10 的影院画面可供后续参考，本次不增加影院改动阶段。长廊 `/corridor` 也已存在，但不等于每张概念板中的建筑长廊都对应它。

夜间外观、特殊展览、圆形山景门洞、面板里新增的导航栏目没有一对一已验证的实现；仅归档意向，不创建路由，不声称已上线。私人健身房、餐厅、异常空间、legacy 和其余现有房间均在保护范围内，不因本提案被删除或重命名。

## 实施次序与单阶段边界

| 阶段 | 范围 | 进入/退出条件 |
|---|---|---|
| P0，本轮 | 参考归档、去重识别、真实场景映射。 | 交付 README、清单、映射、验证与 manifest；用户审阅后才进入场景实现。 |
| P1，建议试点 | 中庭构图 + 玻璃核心的光学层次。优先 G05/G10/G12；先保持既有网格与入口。 | 先捕获欢迎视角、馆内全景和玻璃近景基线；只提交局部材质/光线/细部补充，附匹配相机对比，验证 `/glass-life` 与所有门。 |
| P2 | Projects 与图片展厅。 | 先各自基线；保持内容数、稳定 ID、分页与全部操作；检查窄屏、画框避让、清晰度与图像预算。 |
| P3 | Research 与 Music，逐室独立提交。 | 先基线与音频状态记录；家具不挡路，公式可读，播放/歌词/导入及 reduced motion 通过。 |
| P4 | Basketball，再 Cycling。 | 每世界单独记录受光/纹理/性能；先不触碰物理、动作包和路线。完整运动回归通过后再评审。 |

`tests/motion-preservation.test.ts` 锁定了包括 `World.tsx`、`GlassSculpture.tsx`、`Architecture.tsx`、`ListeningRoom.tsx`、`PersonalRooms.tsx`、`primitives.tsx` 在内的已有文件。后续首先使用独立组件和既有允许的扩展接缝；任何必须触及锁定文件的变动都要说明位置、保留原摘要/物理属性，按现有精确逆向适配规则证明保护仍成立。不能改期望哈希、放宽断言或阈值来换取通过。

不升级主要依赖；现有 Canvas 已启用 `antialias: true` 与 ACESFilmic，不能把“添加抗锯齿”当作修复事实。额外反射、折射采样或后处理单列预算，不在本轮自动引入。

## 未来单幅作品接入方案

所有候选先确认是作品、项目展示图还是建筑参考，并记录公开展示批准。当前 S01 仍为建筑参考，故没有运行时接入。

批准后优先沿用：`content/selected-collection.json` → `readPersonal()` → `worksForRoom()` → `ImageRoom/WallpaperVault` 或项目 `VisualWall`。项目封面则使用既有 `content/projects.json` 等内容记录，避免注册成不相关的私人素材。

公开衍生图放 `public/media/selected/` 或相应既有类别目录，登记稳定 ID、准确尺寸、`src`、较小的 `displaySrc`、标题、description、房间与来源；保留原件和变换记录。优先评估 WebP，再按目标浏览器解码和视觉比较决定 AVIF，不把格式支持等同于质量已验证。

`WallpaperPanel` 的缩略图已有 `loading="lazy"`、异步解码和标题 alt；新增作品应提供描述画面的替代文字，并在实际 DOM 接入时验证尺寸占位和响应式显示。Three.js Canvas 本身没有 HTML `img alt`，可访问索引/作品说明要同步校验。

已有 `useImageTexture` 按画质把纹理边长限制为 1024/1600/2560，`textureCache` 共享和释放纹理；这是**下载后**的显存约束，不会自动降低原图网络字节。新增图片应制作合理尺寸的预览衍生图，复用按房间/分页加载，完整原图只在用户查看时加载；不一次性预热全部高清作品。

私人素材继续只走 `personal-media/`、浏览器本地收藏与既有私人清单。公开模式需要 `build:public` 并检查零私人条目、公开输出及请求记录；不能用普通本地 build 代替公开发布验收。

## 场景验收约定

每个改动都要先存 `before`，再用相同捕获配置存 `after`。记录 commit、已有差异摘要、浏览器/GPU、视口/DPR、实际画质、相机 position/quaternion/FOV、房间与页码、人物/运动/昼夜状态、音频/收藏状态、等待纹理完成条件；避免个人原图进入公开报告。

最初以现有建筑与 sports 捕获/测量脚本作为起点；本次使用 `scripts/capture-reference-{atrium,rooms,details}.mjs` 明确记录位置、朝向、FOV、曝光、画质、DPR 与视口。开发态的 `__PALACE_DEBUG__` 用于确认实际渲染房间；未知路由回到中庭不算检查目标房间成功。正式构建另验无开发状态导出。

性能在同一设备、同一浏览器/GPU、固定画质与视口下，串行重复同一路线，比较帧时间分位数、FPS、draw calls、三角形、纹理数量与网络新增字节；报告绝对值与差值。自动画质降档和 SwiftShader 结果不能冒充硬件提升。建议中位帧时间增加超过 5% 时先解释/调整，再交用户判断；该阈值是提案，不是已经满足的结论。

场景阶段必须运行 TypeScript、lint、内容/私人媒体/保护测试与相关单元测试、桌面和移动浏览器路线与功能检查。改动篮球补运动回归，改动骑行补全路线/存档回归，改动音乐补播放/歌词/导入回归。每阶段列出残留限制。用户于 2026-11-01 已明确授权合并和部署；未授权重写 Git 历史。
