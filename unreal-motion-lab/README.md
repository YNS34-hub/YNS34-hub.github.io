# Memory Palace 本机动作工作间

本机已安装 Unreal Engine 5.8.0，运行位置为 `C:\Program Files\Epic Games\UE_5.8`。本工作间只处理项目原有的公共基础角色；用户的照片头像、音乐、馆藏清单没有被导入，也没有网络上传或改动网页生产素材。

已实际运行的流程：

1. `Scripts/probe_engine.py` 通过 UnrealEditor-Cmd 原生 Python commandlet 验证 Control Rig、IK Rig、IK Retargeter、动画序列和 glTF 导出类可用，进程正常退出。
2. `Scripts/prepare_source.mjs` 将基础角色的四张 WebP 纹理无损转为 PNG 副本，保留源文件 SHA-256。该步骤解决 Interchange 不支持此 WebP 导入的错误。
3. `Scripts/check_athlete_roundtrip.py` 在独立 `/Game/MemoryPalace/CompatibleAthlete` 中导入角色、骨架、四张纹理和 idle/walk/run 三段动画，再导出三份 GLB。PNG 适配后的原生进程退出码为 0。

证据保存在 `Reports/engine-capabilities.json`、`Reports/source-adaptation.json`、`Reports/athlete-roundtrip.json` 和原生日志。`Exports` 是兼容性样本，尚未接入网页。当前 NullRHI 验证不包括材质烘焙、引擎渲染画面或动作观感；不能把成功导出当作篮球动作已经优化完成。当前 GLB 的材质烘焙警告和原骨架非共同根提示保留在日志中，接入前仍要核对骨骼名称、坐标单位、接触和实际回放。

后续可在 UE 中用 Control Rig 调整肩、肘、腕，用 IK Rig 保持手球和脚地接触，再把烘焙后的轻量动画带回现有网页。网页依然负责交互、运球物理与计分；本机工作间不要求改变用户的访问方式。
