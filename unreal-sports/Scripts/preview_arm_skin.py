"""肩肘蒙皮的短原生机位序列；输出仅供本轮视觉检查。"""
from pathlib import Path
import json,subprocess,os
root=Path(__file__).resolve().parents[1]
alias=Path('E:/Codex/UnrealSports');user=alias/'Reports'/'UpgradeUser-Skin';saved=user/'Saved';saved.mkdir(parents=True,exist_ok=True)
events=[]
def key(t,k,d=True):events.append({'at':t,'key':k,'down':d})
def press(t,k):key(t,k);key(t+.08,k,False)
def photo(t,name):events.append({'at':t,'capture':'skin-'+name})
events.append({'at':3,'cameraYaw':150,'cameraPitch':-8});photo(4,'front')
events.append({'at':5,'cameraYaw':0,'cameraPitch':-10})
key(6,'RightMouseButton');key(7,'LeftMouseButton');photo(7.5,'shot-gather');key(7.62,'LeftMouseButton',False)
photo(7.87,'shot-release');key(10,'RightMouseButton',False)
press(11,'R');key(12,'W');key(13.7,'W',False);events.append({'at':13.8,'cameraYaw':32,'cameraPitch':-10})
press(14.2,'G');photo(14.73,'one-takeoff');photo(15.02,'one-release')
press(18,'Three');press(19,'R');events.append({'at':19.5,'cameraYaw':0,'cameraPitch':-12})
key(20,'W');key(21.7,'W',False);events.append({'at':21.8,'cameraYaw':32,'cameraPitch':-10})
press(22.2,'G');photo(22.73,'two-takeoff');photo(23.02,'two-release');press(27,'F10')
(saved/'qa-sequence.json').write_text(json.dumps({'basketball':sorted(events,key=lambda e:e['at']),'cycling':[]}),encoding='utf-8')
(saved/'motion-loadout.json').write_text('{"shot":1,"layup":0,"dunk":0}',encoding='utf-8')
env=dict(os.environ);env['UE-LocalDataCachePath']='E:/Codex/UnrealSportsCache/DDC'
command=[r'C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe',str(alias/'MemorySports.uproject'),
         '/Game/MemorySports/Maps/TrainingHall','-game','-dx11','-windowed','-ForceRes','-ResX=1600','-ResY=900',
         '-SportsQA','-NoSplash',f'-UserDir={user}/',f'-abslog={alias}/Reports/skin-preview.log']
p=subprocess.Popen(command,cwd=alias,env=env)
print(json.dumps({'pid':p.pid,'kind':'Native editor game; local arm skin review'}))
print('Native preview exit',p.wait(timeout=240))
