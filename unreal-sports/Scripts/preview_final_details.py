"""在最终独立包里查看湖岸、俯瞰、路肩和球馆；观察机位不计入连续骑行。"""
from pathlib import Path
from datetime import datetime
import hashlib, json, os, shutil, subprocess, sys

alias = Path('E:/Codex/UnrealSports')
editor = '--editor' in sys.argv
user = alias / ('Reports/UpgradeUser-Details-Editor' if editor else 'Reports/UpgradeUser-Details')
saved = user / 'Saved'
saved.mkdir(parents=True, exist_ok=True)
ride = [{'at':3, 'viewAtM':2450}, {'at':5, 'resetMetrics':True},
        {'at':35, 'record':'detail-lake-performance'}, {'at':36, 'capture':'detail-lake-shore'}, {'at':40, 'viewAtM':1800},
        {'at':44, 'cameraYaw':-154, 'cameraPitch':-8}, {'at':45, 'capture':'detail-lake-overlook'},
        {'at':50, 'viewAtM':400}, {'at':55, 'capture':'detail-road-shoulder'},
        {'at':58, 'key':'F1', 'down':True}]
court = [{'at':3, 'cameraYaw':80, 'cameraPitch':-7}, {'at':5, 'capture':'detail-training-side'},
         {'at':7, 'cameraYaw':160, 'cameraPitch':-7}, {'at':9, 'capture':'detail-personal-front'},
         {'at':11, 'cameraYaw':0, 'cameraPitch':-10}, {'at':13, 'capture':'detail-court-lighting'},
         {'at':16, 'key':'F10', 'down':True}]
ride += [{'at':at, 'cameraYaw':164, 'cameraPitch':-7} for at in range(4,35)]
ride.append({'at':35.3,'cameraYaw':164,'cameraPitch':-7})
if editor:
    ride=[event for event in ride if event['at']<=45]+[{'at':48,'key':'F10','down':True}]
    court=[]
ride.sort(key=lambda event:event['at'])
(saved / 'qa-sequence.json').write_text(json.dumps({'basketball':court,'cycling':ride}), encoding='utf-8')
(saved / 'ride-progress.json').write_text('{"distance":0,"gear":7}', encoding='utf-8')
log = alias / ('Reports/water-preview.log' if editor else 'Reports/final-details.log')
started = datetime.now()
runtime = alias / 'Delivery/Windows/MemorySports/Binaries/Win64/MemorySports.exe'
command = [str(runtime), '/Game/MemorySports/Maps/LakesideRide', '-dx11', '-windowed', '-ForceRes',
           '-ResX=1600', '-ResY=900', '-SportsQA', f'-UserDir={user}/', f'-abslog={log}']
if editor:
    command=[r'C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe',str(alias/'MemorySports.uproject')]+command[1:]+['-game','-NoSplash']
p = subprocess.Popen(command, cwd=alias)
print('Final native scene detail PID', p.pid, flush=True)
code = p.wait(timeout=240)
destination = alias / 'Reports/UpgradeEvidence' / (('WaterEditor-' if editor else 'Details-') + started.strftime('%Y%m%d-%H%M%S'))
destination.mkdir(parents=True, exist_ok=True)
images = [e['capture'] for events in [ride,court] for e in events if 'capture' in e]
for name in images:
    for suffix in ['.png','.json']:
        source = alias / ('Reports/Evidence' if editor else 'Delivery/Windows/MemorySports/Reports/Evidence') / (name+suffix)
        assert source.is_file() and source.stat().st_mtime >= started.timestamp(), f'Missing fresh native capture: {name}'
        shutil.copy2(source, destination / source.name)
shutil.copy2(log, destination / 'engine.log')
performance_source=alias / ('Reports/Evidence' if editor else 'Delivery/Windows/MemorySports/Reports/Evidence') / 'detail-lake-performance.json'
assert performance_source.stat().st_mtime>=started.timestamp()
shutil.copy2(performance_source,destination/performance_source.name)
measured_runtime=alias/'Binaries/Win64/UnrealEditor-MemorySports.dll' if editor else runtime
report = {'completed':code==0,'started':started.isoformat(),'evidence':str(destination),'images':images,
          'kind':'EditorGame' if editor else 'Standalone',
          'runtimeSHA256':hashlib.sha256(measured_runtime.read_bytes()).hexdigest(),
          'method':('Editor game' if editor else 'Packaged game')+' DX11 viewport; marked observation positions, excluded from continuous lap'}
(alias / ('Reports/water-preview-run.json' if editor else 'Reports/final-details-run.json')).write_text(json.dumps(report,indent=2), encoding='utf-8')
print(json.dumps(report,indent=2), flush=True)
raise SystemExit(0 if code==0 else 1)
