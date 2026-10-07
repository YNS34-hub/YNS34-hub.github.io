# Memory Palace — additive motion layer

基线固定为 `63805572054147816699f5ab5b8e513e7447c530`，新分支 `codex/memory-palace-motion-layer`。PR #12 / quality-leap 不改历史、不自动合并。2026-10-07 开始实施。

只改时间和呈现层。建筑、中央玻璃体、导航/碰撞、双槽播放器、歌词解析/同步、IndexedDB v1、素材识别及公开构建排除规则都保持现有实现。

| 阶段 | 最小插入点 | 预算 |
| --- | --- | --- |
| 1 | 共享时长/包络函数、原 DOM 的一次性 cue hook | Level 0–1 |
| 2 | 原欢迎文字、馆标与按钮反馈 | Level 0–1 |
| 3 | 原 Now Playing / 歌曲身份；现有 FFT 的响应包络 | Level 0–1 |
| 4 | 原七行歌词的层次与暂停归位 | Level 0–2 |
| 5 | 原作品的指向反馈、原详情内容入场 | Level 0–1 |
| 6 | 原 Cinema 图像与控件的短暂显现 | Level 0–1 |
| 7 | 原门槛状态、房间标题、真实 ready 的时间编排 | Level 0–1 |
| 8 | 减少动态、键盘、快速切换、隐私与实机性能复核 | Level 0–1 |

没有 Level 3 改写。动画不持有音频/歌词/导航状态，不引入逐帧 React 更新、滤镜、粒子、反射或新的音频引擎。关闭减少动态时可呈现有限的一次性动作；启用减少动态时保持相同静止构图与可用交互。

验收以独立的 6380557 源码预览为 BEFORE，统一已公开内容、相机、medium / DPR 1 与两种窗口尺寸。每阶段先测试和实际查看截图再提交；动态证据与静止画面分别记录。硬件帧率只来自可见安装版 Edge 的独立采样。

## 阶段记录

1. 时间参数 / 包络 / DOM cue（Level 0–1）：TypeScript、lint、76 项单元测试通过；两种分辨率的 6 张静止画面与固定基线并排查看，欢迎页、中庭、聆听室布局相同。包装层未启用时不产生动画、事件或帧循环。
2. 欢迎页 / 馆标 / 按钮（Level 0–1）：只在原元素上编排 60 / 160 / 240 ms 延迟，不改中央雕塑。TypeScript、lint、17 项相关测试通过；12 张双尺寸画面包含标题开始、运动中和归位，两个静止对比板已查看。馆标维持固定字重、字号和约 184 px 宽度，不缩放、不发光。
3. 播放连续性 / 真实频段（Level 0–1）：原标签、曲名和封面加入一次性身份 cue；原唱片暂停保留朝向。只改现有玻璃鳍片的时间包络，不改幅度、位置或灯光数量。TypeScript、lint、30 项相关单元、原 9 项聆听回归（含 38 首 CloudMusic）通过；20 张双尺寸画面及静止对比已查看。播放器文件和 store 没有改动。
4. 原歌词墙（Level 0–2）：每行只增加文本 span 和距离属性，保持原索引、70 px 步长、七行窗口、手动阅读和空间投影。滚动由 900 ms 调为 640 ms；跳转仍立即定位，无模糊滤镜。TypeScript、lint、13 项相关单元、8 项原聆听回归通过（本阶段未重复 CloudMusic 全集采样）；20 张双尺寸画面和静止对比已查看。歌词解析器和持久化没有改动。
5. 原作品 / 编辑观看（Level 0–1）：原 ProjectScreen / VisualWall 保留位置、比例与点击，仅增加指向时显现的短角标；无指向时不绘制。原详情标题和图注加入一次性 cue，iframe 与关闭逻辑不改。TypeScript、lint、23 项相关单元、原 12 项空间/导入/播放流程通过；28 张双尺寸画面与静止/指向对比已查看。
6. 原 Cinema（Level 0–1）：真实纹理就绪后，原单张投影在 360 ms 内恢复原亮度；不增加透明层、纹理、镜面或渲染目标。控件仅透明度显现，标题保留原导航数据。TypeScript、lint、29 项相关单元通过，延迟填充修正后又通过 20 项相关单元；8 项浏览器检查、34 张双尺寸画面通过，两个静止对比板已查看。Next / Previous / metadata / 单层 ESC / 原房间、位置与朝向返回均保持。截图脚本只暂停实际欢迎动画以准确记录指定时刻，并分开记录基线源码 SHA 与脚本 SHA。
7. 原门槛 / 导览（Level 0–1）：房间标题只在原 ready 成立时显现；已有薄幕保留颜色与透明度，缩短到 420 ms。近物提示只淡入，原导览面板微移 4 px 后归位。TypeScript、lint、26 项相关单元、原 12 项完整空间/导入/控制/音频流程通过；10 项双尺寸检查、40 张画面通过，两个静止对比板已查看。没有改相机、门洞、传送、碰撞、Pointer Lock 或 URL。
8. 清理 / 可访问性 / 回归（Level 0–1）：一次性动画结束、取消或卸载后撤下监听，不留下行内 transform。系统与应用的减少动态都能中止当前 cue，继续使用原音频与歌词时钟。TypeScript、lint、78 项单元（保留原 70 项）、6 项动效生命周期流程、9 项原聆听流程（38 首本地录音）、12 项原空间流程、生产浏览器 10 项、原生音频/歌词 5 项、Pointer Lock / 旧入口 / 隐私补查 5 项通过。生产相机诊断仍明确跳过，在开发版覆盖。40 张本阶段画面与全馆 76 张同机位画面已实际查看。

## 改动边界

| 文件 | 只增加的行为 |
| --- | --- |
| `src/motion/tokens.ts` / `useMotionCue.ts` | 共享时间、真实输入包络、可取消的一次性 DOM 动画；不管理业务状态 |
| `src/ui/Hud.tsx` / `MusicPanel.tsx` / `Focus.tsx` | 原元素的 ref / 轻量身份 cue；原事件与内容保留 |
| `src/rooms/ListeningRoom.tsx` | 原分析值的响应曲线与 attack / release；不改构件、灯光数量或幅度 |
| `src/ui/LyricsProjection.tsx` / `motion.css` | 原七行窗口的文本层次、640 ms 滚动、暂停归位和立即 seek |
| `WorkAttention.tsx` / `PersonalRooms.tsx` | 原画框的四个短角标，只在真实指向时显现；不拦截点击 |
| `ProjectionReveal.tsx` / `Wallpapers.tsx` / `CinemaControls.tsx` | 原投影的 360 ms 亮度恢复，原控件透明度编排；导航和原位返回不改 |
| `tests/motion-preservation.test.ts` | 33 个锁定文件的 LF 规范化摘要，以及三处房间组件的建筑、材料与灯光属性摘要 |

播放器、音频状态、歌词解析器、数据库、放置系统、碰撞、回廊分块、玻璃形状与原品牌样式没有修改。没有新依赖、全屏滤镜、模糊动画、渲染目标、实时反射、粒子或逐帧 React 更新。作品角标每件只增加 192 字节顶点数据，静止时不绘制。

## 实际画面

均为 6380557 的独立源码预览与 motion 分支实拍。同公开目录、相机、medium / DPR 1；全馆静止检查启用相同减少动态设置以固定姿态，播放与动画阶段使用同一原创测试录音。没有使用 README 旧图。全馆四组、两种分辨率的 8 张对比板逐张查看：

| 区域 | 1920×1080 | 2560×1440 |
| --- | --- | --- |
| 中庭入口 / 中景 / 玻璃近景 | [对比](comparisons/atrium-1920.jpg) | [对比](comparisons/atrium-2560.jpg) |
| 聆听室 / 回廊三段 | [对比](comparisons/listening-corridor-1920.jpg) | [对比](comparisons/listening-corridor-2560.jpg) |
| 项目 / 研究 / 图像 / 玻璃 / 肖像 | [对比](comparisons/galleries-1920.jpg) | [对比](comparisons/galleries-2560.jpg) |
| 编辑 / Liquid Web / Archive / Unfinished / Collection | [对比](comparisons/archive-editorial-1920.jpg) | [对比](comparisons/archive-editorial-2560.jpg) |

[歌词层次](comparisons/phase-4-1920-rest.jpg)、[作品与详情](comparisons/phase-5-1920-rest.jpg)、[影院与原控件](comparisons/phase-6-1920-rest.jpg)、[最终状态 1080p](comparisons/phase-8-1920-rest.jpg)、[最终状态 1440p](comparisons/phase-8-2560-rest.jpg)。八阶段共记录 200 张实际画面；欢迎动画的定点截图暂停实际 WAAPI 动画后采样，不伪造动画。另有 [21 秒实际浏览器录像](native-motion.webm)，展示快速身份切换、减少动态、唱片暂停恢复和影院切图，没有录制或提交音轨。

静止建筑、光照、图像比例与馆标占位保持；歌词相邻行的透明度是有意的局部层次调整。原始全分辨率截图保存在本机 `outputs/motion-layer`。已上传的对比只使用公开目录和自制测试素材，不含私有收藏或歌曲清单。

## 同机性能

安装版可见 Edge 148.0.3967.70 / NVIDIA GTX 1650 / 驱动 32.0.15.9186 / D3D11，1920×1080、DPR 1、medium。两个版本依次单独采样，每边 21 项，每项 5–12 秒。公开目录与自制录音相同，测试期间没有其他浏览器回归任务。

| 样本 | 6380557 平均 FPS | motion 平均 FPS |
| --- | ---: | ---: |
| 中庭静止 | 80.6 | 85.4 |
| 中庭行走 | 94.6 | 98.5 |
| 聆听室静止 | 143.2 | 142.9 |
| 聆听室行走 | 142.4 | 140.3 |
| 真实播放 / FFT / 滚动歌词 | 142.8 | 143.4 |
| 回廊行走 | 136.8 | 135.5 |
| 跨房间 | 80.2 | 95.4 |
| 回廊流式加载 | 139.3 | 138.8 |

常规场景均值变化约 −1.5% 到 +5.9%，没有用短时波动宣称性能提升。motion 全部短样本均值为 85.4–143.8 FPS，P95 帧间隔约 7.1–14.1 ms。最大 draw calls 250、三角形 61,654、灯光 6、renderer 纹理 80，场景贴图未压缩估算约 63.21 MiB；与本次基线相同。估算不包含全部 GPU 内存或 render target。真实指向时角标增加少量 draw calls，静止时没有额外绘制。

保留全部尖峰：本次基线跨房间最大 451.3 ms，motion 为 458.2 ms；回廊流式加载分别 90.3 / 111.1 ms。该轮没有解决原有切换 / 流式加载尖峰。记录来自 rAF 墙钟、renderer.info 与场景统计，没有 GPU timer query；截图脚本中的 headless 计时不作为硬件成绩。

原始公开采样：[基线](performance-before.json)、[motion](performance-after.json)。[验证汇总](validation.json) 记录真实检查结果、明确跳过项与测试时的源码摘要。phase 8 验证在提交证据前完成，报告的父提交 SHA 配合 `testedSourceDigest` 标识被测源码。

未完成实测：30 分钟连续压力、可见窗口 2560×1440 / DPR 2 性能、实体手机。1440p 只完成布局与实际画面验收。没有部署或合并；main 的发布入口与 PR #12 不变。

## 复现与回退

```powershell
npm run dev -- --port 5190 --strictPort
# 在另一终端运行；PALACE_ARTIFACTS 可指定仓库外的输出目录。
$env:PALACE_MOTION_PHASE = '8'
node scripts/check-motion-layer.mjs
node scripts/check-motion-accessibility.mjs
node scripts/capture-motion-architecture.mjs
node scripts/measure-motion-layer.mjs
```

源码截图或实机对比前，设置 `PALACE_URL`、`PALACE_PHASE` / `PALACE_PERFORMANCE_REPORT` 与 `PALACE_SOURCE_SHA` 指向实际运行版本。BEFORE 必须单独启动固定 6380557 源码。性能脚本要求实际 GTX 1650 renderer；在其他设备运行会拒绝把数据标成该硬件验收。

公共生产版用 `npm run build:public` 和 `npm run preview -- --port 5191 --strictPort`。验证后 `npm run media:register` 恢复本机开发目录。浏览器导入仍只在各自 IndexedDB 中，版本与现有数据都保留。每阶段是独立提交，可以逐项 revert；不需要重写 quality-leap 或 PR #12 的历史。
