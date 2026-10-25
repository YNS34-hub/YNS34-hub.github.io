"""验证原生回放的实际状态；图像质量另行逐张检查。"""
from pathlib import Path
from PIL import Image
import json, re
ROOT=Path(__file__).resolve().parents[1]
EVIDENCE=ROOT/'Reports/Evidence'
def state(name):return json.loads((EVIDENCE/(name+'.json')).read_text(encoding='utf-8-sig'))
checks={}
shot=state('court-score')
checks['actualBasketScored']=shot['score']>=1 and shot['attempts']>=1 and shot['ballScored']
checks['rightDribble']=state('court-dribble-right')['dribbling']
checks['leftDribble']=state('court-dribble-left')['dribbling']
checks['paused']=state('court-pause')['paused']
checks['firstPerson']=state('court-first-person')['firstPerson']
checks['jumpHeight']=state('court-jump')['position'][2]>state('court-overview')['position'][2]+15
checks['pedaling']=state('ride-pedaling')['speedMps']>1
checks['braked']=state('ride-braked')['speedMps']<.2
checks['renderSizes']=all(Image.open(path).size==(1600,900) for path in EVIDENCE.glob('*.png'))
log=(ROOT/'Reports/native-qa-final.log').read_text(encoding='utf-8',errors='replace')
checks['noMaterialFallback']='Failed to compile Material' not in log
lap_file=ROOT/'Reports/ride-full-route-result.json'
if lap_file.exists():
    lap=json.loads(lap_file.read_text(encoding='utf-8-sig'))
    checks['fullRoute']=lap['completed'] and lap['routeMeters']>3500 and lap['recoveries']==0
    checks['roadLane']=lap['maximumCenterOffsetCm']<335
report={'passed':all(checks.values()),'checks':checks,'fullRouteFinished':lap_file.exists(),'method':'Actual Unreal player-input replay and DX11 viewport images; not desktop keyboard injection'}
(ROOT/'Reports/evidence-checks.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
