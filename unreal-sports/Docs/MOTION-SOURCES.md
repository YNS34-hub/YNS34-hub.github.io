# 原生动作与本人形象来源

本轮三类篮球动作是本工程原创参数化动作：三种投篮节奏、三种上篮、两种扣篮，通过原生骨骼动画、手脚 IK、角色冲量及 Chaos 球体连接。未导入 NBA 2K 游戏动画，不标注为 2K 官方动作。

[2K 官方 MyPLAYER 说明](https://newsroom.2k.com/news/nbar-2k26-myplayer-builder-delivers-all-new-animation-glossary-scouting-reports-and-build-by-badges-for-increased-customization)介绍游戏内 Animation Glossary、签名动作及装备要求。此次核对未找到可供本工程直接导入的官方授权 Unreal/FBX 下载。官方页面不等于已取得其游戏资产。

人物基础几何来自 Microsoft Rocketbox Sports_Male_04，保留 [MIT 许可](ROCKETBOX-LICENSE.md)。行走、跑步与待机来自本机 Unreal Manny 模板。本人外观使用原博物馆本机保存的人脸贴图和体型参数；这属于贴图与比例适配，并非新采集的三维面部扫描。

2026-10-18 复核的 [NBA 2K27 官方玩法说明](https://nba.2k.com/2k27/features/gameplay/)及 [2K 官方新闻稿](https://newsroom.2k.com/news/nbar-2k27-gameplay-unleashes-complete-on-court-control-in-a-balanced-two-way-era)作为 v0.3 的动作衔接、出手节奏反馈与比赛呈现参考。官方介绍的 ProPLAY、动态上篮与动作库并非本工程已实现的功能。v0.3 使用已安装 UE 模板的起跳、滞空、落地片段，增加原创肩部/腕部/手指接触姿态；原有八类出手仍是本工程的原生参数化实现。

篮网为 132 根实例化网绳的受控衰减形变，只响应真实下降穿框事件。它不参与计分，不是布料求解器；未命中不会产生成功动画。比赛界面中的提前/延后毫秒数来自实际按键蓄力时长，命中和命中率读取真实球体结果。

私人贴图、转换网格、导入资产、包含这些内容的运行包和渲染证据均只在本机。对应目录已加入忽略规则；未提交、上传或公开发布。
