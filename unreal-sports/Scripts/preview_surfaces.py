"""本机主视角检查地表、湖岸和水面轮廓；观察机位不计入连续骑行成绩。"""
from pathlib import Path
import json,subprocess,os
alias=Path('E:/Codex/UnrealSports');user=alias/'Reports/UpgradeUser-Surface';saved=user/'Saved'
saved.mkdir(parents=True,exist_ok=True)
events=[]
for at,distance in [(3,400),(12,1050),(21,1800),(31,2450),(40,3200)]:
    events.extend([{'at':at,'viewAtM':distance},{'at':at+4,'capture':f'surface-view-{distance}'}])
events.extend([{'at':27,'cameraYaw':120,'cameraPitch':-4},{'at':28,'capture':'surface-lake-detail'},
               {'at':46,'key':'F10','down':True}])
(saved/'qa-sequence.json').write_text(json.dumps({'basketball':[],'cycling':sorted(events,key=lambda e:e['at'])}),encoding='utf-8')
(saved/'ride-progress.json').write_text('{"distance":0,"gear":7}',encoding='utf-8')
env=dict(os.environ);env['UE-LocalDataCachePath']='E:/Codex/UnrealSportsCache/DDC'
command=[r'C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe',str(alias/'MemorySports.uproject'),
         '/Game/MemorySports/Maps/LakesideRide','-game','-dx11','-windowed','-ForceRes','-ResX=1600','-ResY=900',
         '-SportsQA','-NoSplash',f'-UserDir={user}/',f'-abslog={alias}/Reports/surface-preview.log']
p=subprocess.Popen(command,cwd=alias,env=env)
print('Surface preview PID',p.pid,flush=True)
print('Surface preview exit',p.wait(timeout=360),flush=True)
