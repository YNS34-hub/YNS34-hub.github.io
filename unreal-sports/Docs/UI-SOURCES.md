# 比赛界面与字体

v0.3 的界面针对本工程的个人训练场与湖岸骑行重新绘制：角落计分/仪表、靠近人物的弧形出手计量、短暂出手反馈、底边操作提示。没有导入 2K 标识、截图、界面纹理或游戏文件。

参考：2026-10-18 核对的 [NBA 2K27 官方玩法](https://nba.2k.com/2k27/features/gameplay/)与 [Gameplay Courtside Report](https://www.youtube.com/watch?v=ukgQhX1m34g)入口。官方说明的节奏计量与出手反馈用于明确本轮改进方向；不把原生实验工程称为同等规模的商业游戏。

字体来自 Google Fonts 官方仓库，作者为 The Barlow Project Authors，SIL Open Font License 1.1。没有修改字形：

- [Barlow Condensed SemiBold](https://github.com/google/fonts/blob/main/ofl/barlowcondensed/BarlowCondensed-SemiBold.ttf)：标题、计分、速度。
- [Barlow Semi Condensed Medium](https://github.com/google/fonts/blob/main/ofl/barlowsemicondensed/BarlowSemiCondensed-Medium.ttf)：标签、动作与控制说明。

原文件和许可随本机运行包保存在 `Content/Data/Fonts`，运行时使用 UFont 的字体缓存按目标字号生成字形，不放大小字号位图。源文件哈希记录在本轮验收清单。

首轮实机预览曾发现 UFont 对象缺失导致 Canvas 跳过文字，以及地板材质二维/三维坐标类型不匹配导致默认棋盘格。两项均修复后重新编译、渲染；相关失败截图保留，不用于最终画质通过证明。
