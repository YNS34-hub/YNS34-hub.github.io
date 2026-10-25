"""检查本轮独立包新鲜证据；图像的美术质量仍需逐张人工查看。"""
from pathlib import Path
import json, re, sys
from PIL import Image
root=Path(__file__).resolve().parents[1]
kind=sys.argv[1] if len(sys.argv)>1 else 'Standalone'
run=json.loads((root/'Reports'/f'upgrade-{kind}-run.json').read_text(encoding='utf-8-sig'))
evidence=Path(run['evidence']);checks=[]
def check(name,passed,detail=None):checks.append({'name':name,'passed':bool(passed),'detail':detail})
def state(name):return json.loads((evidence/('upgrade-'+name+'.json')).read_text(encoding='utf-8-sig'))
sequence=json.loads((root/'Reports'/'upgrade-input-sequence.json').read_text(encoding='utf-8'))
expected=[e['capture'] for mode in sequence.values() for e in mode if 'capture' in e]
check('Every expected rendered image is present',all((evidence/(s+'.png')).is_file() for s in expected),len(expected))
if not all((evidence/(s+'.png')).is_file() for s in expected):
    print(json.dumps({'passed':False,'checks':checks},indent=2));sys.exit(1)
check('All native images are 1600 x 900',all(Image.open(evidence/(s+'.png')).size==(1600,900) for s in expected))
check('Native scene switch and normal exit',run['modeHistory']==['basketball','cycling'] and run['automaticExit'])
for name in ['avatar-front','court-environment','ride-start','ride-sprint']:
    s=state(name)
    min_head=100 if s['mode']=='cycling' else 150
    check('Personal athlete active: '+name,s['personalAvatar'] and s['avatarMesh']=='PersonalAthlete' and
          min_head<s['headHeightCm']<195 and 60<s['meshExtentZ']<170,
          {'height':s['headHeightCm'],'extent':s['meshExtentZ']})
previous=0
for name,pack in [('classic',1),('high',2),('quick',0)]:
    s=state('shot-'+name+'-result')
    check('Shot package and real basket: '+name,s['shotPack']==pack and s['score']>previous and s['ballReleased'],s['score'])
    previous=s['score']
for dunk,count in [(False,3),(True,2)]:
    kind_name='dunk' if dunk else 'layup'
    for index in range(count):
        name=f'{kind_name}-{index}'
        before=state(name+'-gather');release=state(name+'-release');after=state(name+'-result')
        check('Native takeoff and physical release: '+name,before['activeAction']==(3 if dunk else 2) and
              release['ballReleased'] and after['attempts']>=4 and after['score']>previous,
              {'score':after['score'],'ballHeight':release['ballHeightCm'],'action':before['activeAction']})
        check('Landing and bounded mesh: '+name,abs(state(name+'-landed')['position'][2]-90)<15 and
              state(name+'-landed')['activeAction']==0 and state(name+'-landed')['meshExtentZ']<150)
        previous=after['score']
def relaxed(s):
    return s['activeAction']==0 and max(s['leftArmDownAngleDeg'],s['rightArmDownAngleDeg'])<18
check('Both idle arms settle close to vertical in front and side views',
      all(relaxed(state('arms-relaxed-'+view)) for view in ['front','side']),
      {view:{hand:state('arms-relaxed-'+view)[hand+'ArmDownAngleDeg'] for hand in ['left','right']} for view in ['front','side']})
for name in ['layup-0','layup-1','layup-2','dunk-0']:
    s=state(name+'-takeoff');hand='right' if s['leftHanded'] else 'left'
    check('Off-hand stays naturally lowered: '+name,s[hand+'ArmDownAngleDeg']<18,s[hand+'ArmDownAngleDeg'])
check('All jump-shot arms settle after release',all(relaxed(state('shot-'+name+'-result')) for name in ['classic','high','quick']))
check('Every finishing action recovers both relaxed arms',all(relaxed(state(name+'-landed')) for name in ['layup-0','layup-1','layup-2','dunk-0','dunk-1']))
normal=state('ride-normal-10s');sprint=state('ride-sprint-10s');brake=state('ride-brake-overrides-pedal');recovery=state('ride-recovery')
check('Same road and gear sprint improves 10s speed by at least 6 km/h',
      sprint['gear']==normal['gear'] and (sprint['speedMps']-normal['speedMps'])*3.6>6,
      {'normalKph':normal['speedMps']*3.6,'sprintKph':sprint['speedMps']*3.6})
check('Sprint has power, stamina and camera feedback',sprint['sprintActive'] and sprint['riderPowerW']>350 and
      sprint['stamina']<.4 and sprint['cameraFov']>normal['cameraFov'])
check('Brake cuts power while W and Shift remain held',brake['braking'] and brake['riderPowerW']==0 and brake['speedMps']<.2)
check('Coasting restores stamina',recovery['stamina']>brake['stamina']+.1)
for mode in ['court','ride']:
    s=state(mode+'-performance')
    check(mode+' native 30 second rendered budget',s['worldRenderingEnabled'] and s['viewportWidth']==1600 and
          s['renderedFrames']>1300 and s['renderedFps']>=45 and s['p95Ms']<33.4,
          {k:s[k] for k in ['renderedFrames','renderedFps','p95Ms','gpuFrameMs']})
log=root/'Reports'/f'upgrade-{kind}.log'
text=log.read_text(encoding='utf-8',errors='replace')
check('No native fatal or material compile failure',not any(x in text for x in ['Fatal error!','Failed to compile Material','Failed to find object \'SkeletalMesh']))
check('Two dunk packages release above actual rim reach',len(re.findall(r'SPORTS_FINISH_RELEASE .*dunkReach 1',text))>=2)
check('Only actual baskets trigger the net, once each',state('dunk-1-result')['netReactions']==state('dunk-1-result')['score']==8)
check('Packaged HUD loads both licensed Barlow fonts',all(name in text for name in ['BarlowCondensed-SemiBold.ttf','BarlowSemiCondensed-Medium.ttf']))
check('All jump shots extend the shooting arm after release',all(state('shot-'+name+'-release')['rightArmDownAngleDeg']>140 for name in ['classic','high','quick']),
      {name:state('shot-'+name+'-release')['rightArmDownAngleDeg'] for name in ['classic','high','quick']})
report={'passed':all(c['passed'] for c in checks),'kind':kind,'evidence':str(evidence),'checks':checks,
        'visualReviewRequired':True,'animationOrigin':'Original; no imported 2K animation files'}
(root/'Reports'/f'upgrade-{kind}-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2));sys.exit(0 if report['passed'] else 1)
