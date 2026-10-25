# 原生训练角色来源

参考 Manny 模型、其骨架、材质、纹理和 Idle / Walk / Jog 基础动作取自本机已安装的 Unreal Engine 5.8：

`C:/Program Files/Epic Games/UE_5.8/Templates/TemplateResources/High/Characters/Content/Mannequins`

复制到本工程的 `Content/Characters/Mannequins`，保持包路径以保存依赖。仅供本机 Unreal 工程使用，没有上传到 GitHub 或其他网站。原始引擎文件未修改。

v0.3 同路径追加 `Anims/Unarmed/Jump/MM_Jump`、`MM_Fall_Loop`、`MM_Land`，保留原包路径与骨架依赖。基础跳跃、滞空和落地片段与本工程的上肢接触、肩部移动和手指姿态叠加；没有改写原始引擎资源。

可玩人物为 `Content/PrivateAvatar/PersonalAthlete` 中的本机本人形象。Manny 简化网格仅作骨架参考和缺少私人资源时的显式回退，不能把回退画面当作本人形象验收。

篮球持球、换手、蓄力、出手与骑行握把、脚踏接触是本工程的原生控制与 IK 组合；不声称为官方 NBA / 2K 动作或运动员动作捕捉。

公开人体 GLTF 的单位和绑定转换实验保留在 `Scripts/normalize_athlete.py`、`InputAssets/Athlete` 及历史证据中；该人体未通过画面验收，未用于当前可玩角色。
