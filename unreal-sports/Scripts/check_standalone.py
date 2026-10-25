"""检查打包后实际运行的状态与渲染证据；画面观感仍需逐张查看。"""
from pathlib import Path
from PIL import Image
import json
from datetime import datetime

ROOT=Path(__file__).resolve().parents[1]
EVIDENCE=ROOT/'Reports/StandaloneEvidence'
run=json.loads((ROOT/'Reports/standalone-run.json').read_text(encoding='utf-8-sig'))
started=datetime.fromisoformat(run['started']).timestamp()
fresh_states=[]
def state(name):
    path=EVIDENCE/('standalone-'+name+'.json')
    fresh_states.append(path.stat().st_mtime>=started)
    return json.loads(path.read_text(encoding='utf-8-sig'))

checks={}
shot=state('court-score')
checks['physicalScore']=shot['score']>=1 and shot['attempts']>=1 and shot['ballScored']
checks['dribbleBothHands']=state('court-dribble-left')['dribbling'] and state('court-dribble-right')['dribbling']
checks['jump']=state('court-jump')['position'][2]>state('court-overview')['position'][2]+15
checks['pause']=state('court-pause')['paused']
checks['firstPerson']=state('court-first-person')['firstPerson']
checks['walking']=sum((a-b)**2 for a,b in zip(state('court-moved')['position'][:2],state('court-overview')['position'][:2]))>100**2
checks['pedaling']=state('ride-pedaling')['speedMps']>1
checks['gearChange']=state('ride-geared-up')['gear']==state('ride-start')['gear']+1
checks['braking']=state('ride-braked')['speedMps']<.2
checks['completion']=state('ride-completed')['distanceM']>3519
checks['restart']=state('ride-restarted')['distanceM']<2
checks['returnToCourt']=state('court-return')['mode']=='basketball'
performance={}
for label in ['court','ride']:
    sample=state(label+'-performance')
    checks[label+'RealRender']=sample['worldRenderingEnabled'] and sample['gpuFrameMs']>0 and sample['renderedFrames']>1000
    checks[label+'FrameBudget']=sample['renderedFps']>=45 and sample['p95Ms']<=33.34
    performance[label]={key:sample[key] for key in ['renderedFps','fps','p95Ms','maxMs','gpuFrameMs','renderedFrames','viewportWidth','viewportHeight']}
image_names=['court-overview','court-dribble-right','court-dribble-left','court-score','court-jump','court-pause','court-first-person','ride-start','ride-braked','ride-view-0400m','ride-view-1050m','ride-view-1800m','ride-view-2450m','ride-view-3200m','ride-completed','ride-restarted']
missing_images=[name for name in image_names if not (EVIDENCE/('standalone-'+name+'.png')).is_file()]
checks['allRequiredImages']=not missing_images
checks['f9PhotoKey']=any(p.stat().st_mtime>=started for p in EVIDENCE.glob('ride-20*.png'))
checks['freshEvidence']=all(fresh_states) and not missing_images and all((EVIDENCE/('standalone-'+name+'.png')).stat().st_mtime>=started for name in image_names)
checks['imageSize']=not missing_images and all(Image.open(EVIDENCE/('standalone-'+name+'.png')).size==(1600,900) for name in image_names)
checks['independentGame']=run['completed'] and run['automaticExit'] and run['launchProgram'].endswith('MemorySports.exe') and run.get('modeHistory')==['basketball','cycling','basketball']
log=(ROOT/'Reports/standalone-qa.log').read_text(encoding='utf-8',errors='replace')
checks['noMaterialCompileFailure']='Failed to compile Material' not in log and 'Fatal error' not in log
report={'passed':all(checks.values()),'checks':checks,'missingImages':missing_images,'quiet30SecondSamples':performance,'performanceScope':'1600x900, two fixed cameras, no screenshots during sampling; not a full-route GPU benchmark','method':'Packaged executable, native player-input replay, DX11 viewport capture; physical keyboard and controller feel not measured'}
(ROOT/'Reports/standalone-checks.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
raise SystemExit(0 if report['passed'] else 1)
