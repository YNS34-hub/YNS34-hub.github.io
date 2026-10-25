"""只在新版独立包、回归、连续路线和本轮图片都通过后写入验收记录。"""
from pathlib import Path
import datetime,hashlib,json,re
root=Path(__file__).resolve().parents[1]
def load(name):return json.loads((root/'Reports'/name).read_text(encoding='utf-8-sig'))
upgrade=load('upgrade-Standalone-checks.json');regression=load('standalone-checks.json')
route=load('upgrade-route-run.json');visual=load('upgrade-visual-review.json');details=load('final-details-run.json')
arms=load('arms-review-checks.json')
assert upgrade['passed'] and regression['passed'] and visual['passed'] and arms['passed']
assert route['completed'] and route['automaticExit'] and route['route']['recoveries']==0
assert route['route']['maximumCenterOffsetCm'] <= 335 and details['completed']
tests=(root/'Reports'/'upgrade-physics-tests.log').read_text(encoding='utf-8',errors='replace')
assert len(re.findall(r'Test Completed\. Result=\{Success\}.*Path=\{MemorySports.Physics\.',tests))==7
assert not re.search(r'Test Completed\. Result=\{Fail',tests)
binary=root/'Delivery'/'Windows'/'MemorySports'/'Binaries'/'Win64'/'MemorySports.exe'
binary_hash=hashlib.sha256(binary.read_bytes()).hexdigest()
content_files=[p for p in (root/'Delivery/Windows/MemorySports/Content/Paks').iterdir() if p.is_file()]
latest_package_write=max([binary.stat().st_mtime]+[p.stat().st_mtime for p in content_files])
water_scope=load('water-only-protection.json')
assert water_scope['runtimeSHA256']==binary_hash
for relative,expected in water_scope['protectedFiles'].items():
    assert hashlib.sha256((root/relative).read_bytes()).hexdigest()==expected, f'Protected gameplay asset changed: {relative}'
for run_name in ['upgrade-Standalone-run.json','standalone-run.json','upgrade-route-run.json','final-details-run.json']:
    assert load(run_name)['runtimeSHA256'].lower()==binary_hash, f'Stale binary evidence: {run_name}'
    # 水面只改两项资源；核心动作/操作/路线由同一运行文件与 156 项未改资产支撑。
    # 最终水面画面与近景性能必须晚于最后一次打包，不能沿用之前的反光图片。
    if run_name=='final-details-run.json':
        assert datetime.datetime.fromisoformat(load(run_name)['started']).timestamp()>=latest_package_write, f'Stale water evidence: {run_name}'
evidence=Path(upgrade['evidence']).resolve()
def state(name):return json.loads((evidence/('upgrade-'+name+'.json')).read_text(encoding='utf-8-sig'))
normal=state('ride-normal-10s');sprint=state('ride-sprint-10s')
court=state('court-performance');ride=state('ride-performance')
lake=json.loads((Path(details['evidence'])/'detail-lake-performance.json').read_text(encoding='utf-8-sig'))
assert lake['renderedFrames']>1300 and lake['renderedFps']>=45 and lake['p95Ms']<33.4 and lake['worldRenderingEnabled']
content_hashes={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in content_files}
result={'version':'0.2.0','acceptedAt':datetime.datetime.now().astimezone().isoformat(),
        'runtimeSHA256':binary_hash,'contentSHA256':content_hashes,'runtime':str(binary),'upgradeChecks':len(upgrade['checks']),
        'regressionChecks':len(regression['checks']),'physicsTests':7,'armChecks':len(arms['checks']),'imagesReviewed':len(visual['images']),
        'evidence':str(evidence),'routeEvidence':route['evidence'],'sceneDetailEvidence':details['evidence'],
        'waterMaterialOnlyRefinement':True,'protectedGameplayFiles':len(water_scope['protectedFiles']),
        'lakePerformance':{key:lake[key] for key in ['renderedFps','p95Ms','gpuFrameMs']},'localOnly':True,'publicDeployment':False,
        'uiRedesign':'Pending separately; basic HUD and fonts are not final visual design',
        'animationSource':'Original parameterized motion; not imported NBA 2K animations'}
(root/'Reports'/'upgrade-package-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
text=f'''# 人物、篮球动作与骑行升级验收

版本 0.2.0，{result['acceptedAt']}。本记录只验收本轮人物、三类动作、骑行加速、环境细节与本机运行。UI 与字体按用户要求另行重做；不宣称完成最终游戏 UI 或达到 2K 商业游戏制作规格。

- 已保存本人头像贴图、肩胸腰臂和面部比例适配，89 根骨骼与原生参考绑定一致。使用 Rocketbox 基础人体与本机外观，并非新采集的三维面扫。人脸源文件哈希复核未变化。
- 空闲手在身体两侧近乎垂直下垂；左右肘独立计算，出手后连续回落，骑行保持握把。原生手臂专项 **{len(arms['checks'])} 项**通过，正侧面、左右持球、单手与双手终结均保存了实际渲染与骨骼角度。独立包另对每种单手终结和动作恢复的下垂方向重新核验。
- 1 切投篮包：快出手、经典跳投、高出手；2 切上篮包：长步、挑篮、欧洲步；3 切扣篮包：单手、双手。F 上篮，G 扣篮。八种动作均通过独立包实际输入与真实下降穿框，最终 8 / 8；动作不会直接增加分数。
- 本轮动作是原创参数化动作。已核对 2K 官方资料，未取得可直接导入的官方授权动画资产，没有把当前动作标为 2K 官方包。来源见 `Docs/MOTION-SOURCES.md`。
- 骑行 W 踩踏、Shift 冲刺；相同挡位与起点踩踏 10 秒，普通为 **{normal['speedMps']*3.6:.1f} km/h**，冲刺为 **{sprint['speedMps']*3.6:.1f} km/h**。制动优先归零驱动力；验证停车、耐力消耗与恢复。实际加速受路段、挡位和踏频影响。
- 球馆增加球架、训练标、长凳、毛巾、水瓶、窗框和训练牌；骑行增加路肩草石、地形贴合岸石、短护栏、里程牌、休息长凳和停车架。草簇等使用实例与距离裁剪。
- 最后近景发现旧水波产生棋盘反光，随后改为 128 个不同方向、波长和相位的周期风浪分量、双层不同尺度流动法线、非金属水面及更宽的浅水透明过渡。仅更新湖水材质和法线；核心源码、配置、人物、地图和碰撞共 **{len(water_scope['protectedFiles'])} 项**哈希核对未变。动作、原操作与连续路线对应同一运行文件；最终材质另行重打包，并重新检查近景、俯瞰、场景切换与 30 秒湖岸性能。
- 原生物理测试 **7 项**、新版功能检查 **{len(upgrade['checks'])} 项**、原操作回归 **{len(regression['checks'])} 项**通过。F9 的 PNG 压缩已移至后台，原首轮失败记录保留，不用旧截图代替本轮结果。
- 新版独立包连续骑完 **{route['route']['routeMeters']:.2f} 米**，用时 **{route['route']['elapsedSeconds']:.1f} 秒**，额外恢复 **0** 次；最大道路中心偏移 **{route['route']['maximumCenterOffsetCm']:.1f} 厘米**。控制器只通过玩家输入发送踩踏、转向和换挡，连续骑行期间没有设置位置或速度。

## 渲染与性能

GTX 1650 4GB，DX11，1600 × 900，约 60 FPS 上限。独立包 30 秒固定主视角：

| 场景 | 实际渲染 FPS | 帧时间 p95 | 最后采样 GPU 帧时间 |
| --- | ---: | ---: | ---: |
| 球馆 | {court['renderedFps']:.1f} | {court['p95Ms']:.2f} ms | {court['gpuFrameMs']:.2f} ms |
| 骑行 | {ride['renderedFps']:.1f} | {ride['p95Ms']:.2f} ms | {ride['gpuFrameMs']:.2f} ms |
| 最终水面近景 | {lake['renderedFps']:.1f} | {lake['p95Ms']:.2f} ms | {lake['gpuFrameMs']:.2f} ms |

这些数值对应记录的分辨率和机位，截图写入、场景切换、其他程序负载会产生额外波动，不能当作所有视角的最低帧率。实际游戏视口图片已逐张检查，清单与 SHA256 在 `upgrade-visual-review.json`。观察机位与连续骑行成绩分开记录。

## 本机入口和证据

双击工程根目录 `开始-篮球训练.cmd` 或 `开始-湖岸骑行.cmd`。操作见 `README.md`。本轮截图目录：`{evidence.relative_to(root) if evidence.is_relative_to(root) else evidence}`。连续路线证据：`{route['evidence']}`。

实际运行文件 SHA256：`{binary_hash}`。旧版完整运行包和源码配置回退位置见 `v0.1-rollback.json`。旧基线报告另存于 `Iterations/Baseline-v0.1`。

私人外观、导入资产、独立包和包含人物的截图均保留本机，没有公网部署、上传或提交。原网页和并发篮球分支的现有改动保持各自状态；原动作实验室文件核对未改变。
'''
(root/'Reports'/'人物动作与骑行升级验收.md').write_text(text,encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
