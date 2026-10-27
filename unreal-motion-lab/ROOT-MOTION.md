# 保留动画根节点的 Unreal 往返

2026-10-28 新增一条保留动画根骨的本机导入链路。原公共角色的 `Bip01` 参与动画，但不在80个蒙皮关节内；旧导入仅以 Pelvis 开始骨架，导出的动画会丢失上层变换。把名字全部保留下来仍不足以验证动作一致。

`prepare_root_motion_source.mjs` 将这个已有节点追加为第81个零权重关节，并补齐对应逆绑定矩阵。原有80个关节索引、顶点权重、几何和动画不变；源文件保留，输出必须使用新目录。`check_root_motion_roundtrip.py` 只向新的 Unreal 资源命名空间导入，保留旧导出；`check_root_motion_fidelity.mjs` 在每段61个时刻比较全部80个原关节的绝对世界位置，以1毫米作为此往返专项上限。

| 基础片段 | 旧导出最大骨点偏差 | 保留根骨后的最大偏差 |
| --- | ---: | ---: |
| idle | 32.21 mm | 0.927 mm |
| walk | 131.25 mm | 0.622 mm |
| run | 217.94 mm | 0.351 mm |

本机 UE 5.8 的 NullRHI Python commandlet 已实际重新导入、导出三段；独立 Three.js 动画回放也复核了旧失败时刻。原有36项受保护文件的原始摘要一致。公开准备脚本重新生成的六个输入文件与实际引擎实验输入逐一相同。证据和导出资源只保留在本机 Reports 及实验目录。

使用前先执行原有 `prepare_source.mjs`，准备公共角色和 PNG 纹理，并安装网页工程依赖。位于本仓库归档或原本机工作间均可用；必要时设置 `PALACE_WEB_ROOT` 指向网页工程。然后运行新的 `prepare_root_motion_source.mjs`。它默认写入一个全新的 `RootMotionSource`；可用 `PALACE_ROOT_MOTION_SOURCE` 指定另一新目录。

通过 UnrealEditor-Cmd 运行 `check_root_motion_roundtrip.py` 时，使用 `-run=pythonscript -unattended -NullRHI`。`PALACE_ROOT_MOTION_LABEL` 可指定新的字母数字标签；默认使用时间标签，不覆盖旧资源或旧报告。最后将 `PALACE_ROOT_MOTION_EXPORTS` 指向刚生成的 ExportsRootMotion 目录，运行 `check_root_motion_fidelity.mjs`；报告默认保存为新的时间文件。

这个专项验证骨架与动画传递精度。三个 GLB 仍没有带回源纹理，尚缺带材质的实际渲染、Control Rig 篮球精修、手球接触和完整网页动作验收，因此报告始终标记 `productionEligible:false`。这些资源尚未替换网页或本机原生运动游戏中的角色，不是新的2K动作包。
