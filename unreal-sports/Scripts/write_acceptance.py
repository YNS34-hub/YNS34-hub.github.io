"""只有独立包运行、完整截图和人工画面检查都通过，才生成最终验收记录。"""
from pathlib import Path
import json,datetime,hashlib

ROOT=Path(__file__).resolve().parents[1]
def load(name):return json.loads((ROOT/'Reports'/name).read_text(encoding='utf-8-sig'))
checks=load('standalone-checks.json');visual=load('visual-review.json');lap=load('ride-full-route-result.json');protection=load('protection-verification.json')
assert checks['passed'] and visual['passed'], '仍有未通过的独立包或画面检查'
package=ROOT/'Delivery/Windows'
files=[path for path in package.rglob('*') if path.is_file() and 'Reports' not in path.relative_to(package).parts]
manifest={'at':datetime.datetime.now().astimezone().isoformat(),'success':'BUILD SUCCESSFUL' in (ROOT/'Reports/package-viewport.log').read_text(encoding='utf-8',errors='replace'),'fileCount':len(files),'bytes':sum(path.stat().st_size for path in files),'runtimeSha256':hashlib.sha256((package/'MemorySports/Binaries/Win64/MemorySports.exe').read_bytes()).hexdigest(),'target':'Windows Development DX11 SM5','publicDeployment':False}
assert manifest['success']
(ROOT/'Reports/package-result.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
performance=checks['quiet30SecondSamples']
rows='\n'.join(f"| {'篮球训练' if mode=='court' else '湖岸骑行'} | {value['renderedFps']:.1f} | {value['p95Ms']:.2f} ms | {value['maxMs']:.2f} ms |" for mode,value in performance.items())
report=f'''# 本机 Unreal 篮球与湖岸骑行验收

验收日期：2026-10-17。结果：通过本机单人训练与骑行可玩版验收。独立 Windows 包已经实际启动，正常游戏不需要打开编辑器。

## 启动

双击工程根目录的 `开始-篮球训练.cmd` 或 `开始-湖岸骑行.cmd`。运行入口为 `Delivery/Windows/MemorySports.exe`，约 {manifest['bytes']/1024**2:.0f} MiB，保留同目录的 Engine 和 MemorySports 文件夹。可编辑工程是 `MemorySports.uproject`。

WASD 移动 / 骑行转向；篮球 E 运球、X 换手、右键瞄准、按住并松开左键投篮、空格跳跃；骑行 W 踩踏、Q/E 换挡、空格或 S 制动、Shift 冲刺。V 切换视角，H 显示操作提示，Esc 暂停，F1/F2 切换模式，F9 保存游戏画面，F10 退出。骑行终点后 R 开始新一程。详细说明见工程 `README.md`。

## 已验证

- 最终独立包的篮球→骑行→篮球切换与 F10 正常退出。
- 实际球体释放、下降穿框计分，左右运球、跳跃、移动、暂停和第一人称切换。快速收球属于训练辅助，释放后的篮球使用 Chaos 碰撞。
- 实际踩踏加速、转向、换挡、制动，终点完成提示与 R 重新开始。正常游玩可自由转向。
- {sum(checks['checks'].values())} 项独立包检查通过；16 张指定 1600×900 视口图片齐全，另有实际 F9 按键图片。截图是引擎渲染结果，没有使用概念图替代。
- 5 个原生物理测试通过，日志为 `physics-tests-final.log`。个别引擎启动阶段的 UnifiedError 演示日志不属于这些测试，不能把整份日志称为没有错误字样。
- 约 {lap['routeMeters']/1000:.2f} km 连续路线回放用时 {lap['elapsedSeconds']:.1f} 秒，恢复次数 {lap['recoveries']}，最大道路中心偏移 {lap['maximumCenterOffsetCm']/100:.2f} m。回放只发送 Unreal 玩家方向、踩踏、制动与换挡输入，没有在途中传送或直接写速度。此项完整路线发生在相同骑行动力学实现上；其后修改为材质、终点恢复提示与截图方式，不把该整圈结果作为最终包的全程 GPU 性能测试。

## 性能范围

GTX 1650 4GB、i5-10300H、16GB 内存；DX11 / SM5，1600×900，高档基础画质，无硬件光追与 Lumen。以下为两个固定机位分别约 30 秒、不含截图压缩的实际渲染采样；保留系统其他正常后台负载，不保证其他机位或其他负载下同样帧率。

| 场景 | 实际渲染 FPS | 95% 帧间隔 | 最大帧间隔 |
| --- | ---: | ---: | ---: |
{rows}

GPU 计时与渲染启用状态均已记录。最大帧间隔提示仍会有偶发停顿，截图压缩另有明显开销。定点观察截图使用明确标注的测试机位移动，不计入连续骑行成绩。

## 画面证据

篮球训练主视角：

![篮球训练](StandaloneEvidence/standalone-court-overview.png)

湖岸骑行主视角：

![湖岸骑行](StandaloneEvidence/standalone-ride-view-2450m.png)

其他主要视角与操作证据位于 `StandaloneEvidence`，包含起点、400 / 1050 / 1800 / 2450 / 3200 m、终点、重新开始、投篮、运球、跳跃、暂停与第一人称。逐张画面检查记录为 `visual-review.json`。旧失败证据保存在 `Iterations`。

## 修正与边界

天空改为真实公开天空照片与静态 HDR 环境照明；材质图重建逐个清理节点，避免旧法线残留，远山使用三轴投影与宏观色差。原生场景以实例化和距离裁剪控制开销。篮球馆、自行车、运动反馈音和控制为本工程新增。

历史独立包曾在后台窗口截图的 Slate / DX11 回读堆栈崩溃，日志保留在 `Iterations/standalone-slate-crash.log`。已改为游戏视口回读；最终包的完整截图、F9 与退出检查重新通过。一次过短的退出等待导致的测试脚本失败也保留，未冒充成功。

当前使用引擎 Manny 训练模型与基础行走动作，运动接触由本工程 IK 驱动。公开人体绑定实验没有通过，因此未用于当前角色。此版本不包含联网对抗、AI 球队、职业球员动作捕捉或完整刚体自行车悬架。真实桌面键鼠、实体手柄与扬声器听感还需要人工体验；输入回放通过不等同于这些硬件手感验收。

## 保护与可复核文件

本工程与原网页、动作实验室、并发篮球工作区分开。动作实验室保护清单 21 项一致；篮球工作区 311 项一致，另有 4 项并发改动保留，没有回滚或覆盖。复核时间为 {protection['at']}，详情见 `protection-verification.json`。私人照片、视频、音乐及媒体清单没有纳入新包，也没有上传或发布公网。

可复核记录：`standalone-checks.json`、`standalone-run.json`、`standalone-qa.log`、`ride-full-route-result.json`、`package-viewport.log`、`physics-tests-final.log`、`代码复核.md`。公开资产来源保留在工程 `Docs`。SDK 与编译说明见 `README.md` 和 `sdk-source.json`。
'''
(ROOT/'Reports/验收记录.md').write_text(report,encoding='utf-8')
print('Acceptance record written after runtime, screenshots and visual gates passed.')
