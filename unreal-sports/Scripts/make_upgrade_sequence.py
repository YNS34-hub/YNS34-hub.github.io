"""生成原生玩家输入验收序列；动作起步使用真实行走，观察机位单独标记。"""
from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
court=[];ride=[]
def key(events,t,k,d=True):events.append({'at':t,'key':k,'down':d})
def press(events,t,k):key(events,t,k);key(events,t+.08,k,False)
def photo(events,t,name):events.append({'at':t,'capture':'upgrade-'+name})
court.extend([{'at':4,'resetMetrics':True},{'at':34,'record':'upgrade-court-performance'},
              {'at':35,'cameraYaw':160,'cameraPitch':-7}])
photo(court,36,'avatar-front');court.append({'at':37,'cameraYaw':0,'cameraPitch':-12})
photo(court,38,'court-environment')
time=40
for index,(name,hold,cycle) in enumerate([('classic',.62,False),('high',.78,True),('quick',.46,True)]):
    press(court,time,'R');time+=1
    if cycle:press(court,time,'One');time+=.3
    key(court,time,'RightMouseButton');key(court,time+1,'LeftMouseButton')
    photo(court,time+1+hold-.04,'shot-'+name+'-gather')
    key(court,time+1+hold,'LeftMouseButton',False)
    photo(court,time+1+hold+({'classic':.20,'high':.26,'quick':.14}[name])+.08,'shot-'+name+'-release')
    court.append({'at':time+4,'record':'upgrade-shot-'+name+'-result'})
    key(court,time+4.1,'RightMouseButton',False);time+=6
for dunk,count in [(False,3),(True,2)]:
    for index in range(count):
        kind='dunk' if dunk else 'layup';name=f'{kind}-{index}'
        press(court,time,'R');time+=.5
        if index:press(court,time,'Three' if dunk else 'Two');time+=.3
        key(court,time,'W');key(court,time+1.7,'W',False)
        # 第一组上篮和扣篮保留侧面机位，手球和膝部更易检查。
        court.append({'at':time+1.8,'cameraYaw':32,'cameraPitch':-10})
        press(court,time+2.2,'G' if dunk else 'F')
        photo(court,time+2.31,name+'-gather')
        photo(court,time+2.73,name+'-takeoff')
        photo(court,time+3.02,name+'-release')
        court.append({'at':time+4.6,'record':'upgrade-'+name+'-result'})
        photo(court,time+4.9,name+'-landed')
        court.append({'at':time+5.2,'cameraYaw':0,'cameraPitch':-12})
        time+=7
court.append({'at':time,'cameraYaw':160,'cameraPitch':-7})
photo(court,time+1,'arms-relaxed-front')
court.append({'at':time+2,'cameraYaw':90,'cameraPitch':-7})
photo(court,time+3,'arms-relaxed-side')
time+=4
press(court,time,'F2')
ride.extend([{'at':3,'viewAtM':0},{'at':5,'resetMetrics':True},
             {'at':35,'record':'upgrade-ride-performance'}])
photo(ride,37,'ride-start')
key(ride,39,'W');ride.append({'at':49,'record':'upgrade-ride-normal-10s'})
key(ride,50,'W',False);press(ride,51,'R')
ride.append({'at':52,'viewAtM':0})
key(ride,54,'W');key(ride,54,'LeftShift')
ride.append({'at':64,'record':'upgrade-ride-sprint-10s'});photo(ride,64.2,'ride-sprint')
key(ride,65,'SpaceBar');ride.append({'at':67,'record':'upgrade-ride-brake-overrides-pedal'})
key(ride,68,'SpaceBar',False);key(ride,68,'W',False);key(ride,68,'LeftShift',False)
ride.append({'at':73,'record':'upgrade-ride-recovery'})
for at,distance in [(75,400),(83,1050),(91,1800),(99,2450),(107,3200)]:
    ride.append({'at':at,'viewAtM':distance});photo(ride,at+3,'ride-view-'+str(distance))
    if distance in (1050,1800):
        ride.append({'at':at+4,'cameraYaw':120,'cameraPitch':-4});photo(ride,at+5,'ride-detail-'+str(distance))
press(ride,114,'F10')
sequence={'basketball':sorted(court,key=lambda e:e['at']),'cycling':sorted(ride,key=lambda e:e['at'])}
(root/'Reports'/'upgrade-input-sequence.json').write_text(json.dumps(sequence,indent=2),encoding='utf-8')
print(json.dumps({'courtSeconds':time,'rideSeconds':114,'events':len(court)+len(ride)}))
