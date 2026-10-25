"""真实原生按键验证出手早晚、实际命中/未中和网绳响应，保存当前版本证据。"""
from pathlib import Path
from datetime import datetime
import hashlib, json, os, shutil, subprocess, sys
from PIL import Image

root = Path('E:/Codex/UnrealSports')
editor = '--editor' in sys.argv
compact = '--compact' in sys.argv
width, height = (1280, 720) if compact else (1600, 900)
court, ride = [], []
def key(events, time, name, down=True):
    events.append({'at': time, 'key': name, 'down': down})
def press(events, time, name):
    key(events, time, name); key(events, time + .08, name, False)
def photo(events, time, name):
    events.append({'at': time, 'capture': 'quality-' + name})
def camera(events, time, yaw, pitch=-10):
    events.append({'at': time, 'cameraYaw': yaw, 'cameraPitch': pitch})

camera(court, 3, 0); key(court, 4, 'RightMouseButton')
key(court, 5, 'LeftMouseButton'); photo(court, 5.5, 'shot-meter')
key(court, 5.62, 'LeftMouseButton', False); photo(court, 5.92, 'follow-through')
photo(court, 7.34, 'net-pull'); photo(court, 7.6, 'net-settle')
court.append({'at': 8.4, 'record': 'quality-clean-result'})
key(court, 8.6, 'RightMouseButton', False)
press(court, 10, 'R'); key(court, 10.5, 'RightMouseButton')
key(court, 11, 'LeftMouseButton'); key(court, 11.2, 'LeftMouseButton', False)
photo(court, 11.55, 'early-feedback'); court.append({'at': 14, 'record': 'quality-early-result'})
key(court, 14.2, 'RightMouseButton', False)
press(court, 15, 'R'); key(court, 15.4, 'RightMouseButton')
key(court, 16, 'LeftMouseButton'); key(court, 17.05, 'LeftMouseButton', False)
photo(court, 17.4, 'late-feedback'); court.append({'at': 20, 'record': 'quality-late-result'})
key(court, 20.2, 'RightMouseButton', False)
press(court, 22, 'R'); camera(court, 22.2, 0)
key(court, 23, 'W'); key(court, 24.7, 'W', False); camera(court, 24.8, 32)
press(court, 25.2, 'G'); photo(court, 25.75, 'dunk-air'); photo(court, 26.18, 'dunk-net')
photo(court, 27.1, 'dunk-landing'); court.append({'at': 28, 'record': 'quality-dunk-result'})
camera(court, 28.2, 160); photo(court, 29, 'relaxed-arms')
press(court, 30, 'R'); camera(court, 30.3, 160); photo(court, 32, 'personal-grip')
press(court, 33, 'H'); photo(court, 33.5, 'controls')
press(court, 35, 'Escape'); photo(court, 35.5, 'pause'); press(court, 37, 'Escape')
press(court, 39, 'F2')
ride.extend([{'at': 3, 'viewAtM': 0}]); photo(ride, 4, 'ride-instruments')
key(ride, 6, 'W'); key(ride, 6, 'LeftShift'); camera(ride, 13, 120, -4)
photo(ride, 14, 'ride-sprint-grip'); key(ride, 17, 'SpaceBar')
key(ride, 19, 'W', False); key(ride, 19, 'LeftShift', False); key(ride, 19, 'SpaceBar', False)
ride.extend([{'at': 22, 'viewAtM': 1800}]); camera(ride, 25, -154, -8)
photo(ride, 26, 'ride-lake-ui'); press(ride, 29, 'F10')
kind = 'Editor' if editor else 'Standalone'
if compact:
    # 小分辨率只验界面边界、计量、暂停和双场景，完整动作已有主流程覆盖。
    court = [event for event in court if event['at'] <= 8.6]
    press(court, 10, 'H'); photo(court, 10.5, 'controls')
    press(court, 12, 'Escape'); photo(court, 12.5, 'pause'); press(court, 14, 'Escape')
    press(court, 16, 'F2')
    ride = [event for event in ride if event['at'] <= 4] + [{'at': 6, 'key': 'F10', 'down': True}]
sequence = {'basketball': sorted(court, key=lambda event: event['at']),
            'cycling': sorted(ride, key=lambda event: event['at'])}
stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
user = root / f'Reports/UpgradeUser-Quality-{kind}-{width}'
saved = user / 'Saved'; saved.mkdir(parents=True, exist_ok=True)
(saved / 'qa-sequence.json').write_text(json.dumps(sequence), encoding='utf-8')
(saved / 'motion-loadout.json').write_text('{"shot":1,"layup":0,"dunk":0}', encoding='utf-8')
(saved / 'ride-progress.json').write_text('{"distance":0,"gear":7}', encoding='utf-8')
runtime = root / ('Binaries/Win64/UnrealEditor-MemorySports.dll' if editor else
                   'Delivery/Windows/MemorySports/Binaries/Win64/MemorySports.exe')
destination = root / 'Reports/UpgradeEvidence' / f'Quality-{kind}-{width}-{stamp}'
destination.mkdir(parents=True)
log = destination / 'engine.log'
args = ['/Game/MemorySports/Maps/TrainingHall', '-dx11', '-windowed', '-ForceRes',
        f'-ResX={width}', f'-ResY={height}', '-SportsQA', f'-UserDir={user}/', f'-abslog={log}']
command = ([r'C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe',
            str(root / 'MemorySports.uproject')] + args + ['-game', '-NoSplash']) if editor else [str(runtime)] + args
env = dict(os.environ); env['UE-LocalDataCachePath'] = 'E:/Codex/UnrealSportsCache/DDC'
started = datetime.now().astimezone()
process = subprocess.Popen(command, cwd=root, env=env)
print(f'Native quality review {kind} {width}x{height} PID {process.pid}', flush=True)
code = process.wait(timeout=300)
source = root / ('Reports/Evidence' if editor else 'Delivery/Windows/MemorySports/Reports/Evidence')
names = [(event['capture'] if 'capture' in event else event['record'], 'capture' in event)
         for events in sequence.values() for event in events if 'capture' in event or 'record' in event]
for name, captured in names:
    for suffix in (['.png', '.json'] if captured else ['.json']):
        path = source / (name + suffix)
        assert path.is_file() and path.stat().st_mtime >= started.timestamp(), f'缺少本轮原生证据 {path}'
        shutil.copy2(path, destination / path.name)
checks = {'cleanExit': code == 0}
if not compact:
    clean, early, late, dunk = [json.loads((destination / f'quality-{name}-result.json').read_text())
                               for name in ['clean', 'early', 'late', 'dunk']]
    checks.update({'cleanActualBasket': clean['score'] == 1 and clean['netReactions'] == 1,
                   'earlyMissNoNetResponse': early['score'] == 1 and early['netReactions'] == 1 and early['lastTimingErrorMs'] < -300,
                   'lateMissNoNetResponse': late['score'] == 1 and late['netReactions'] == 1 and late['lastTimingErrorMs'] > 300,
                   'dunkActualBasket': dunk['score'] == 2 and dunk['netReactions'] == 2,
                   'allFourAttempts': dunk['attempts'] == 4})
    pull = json.loads((destination / 'quality-net-pull.json').read_text())
    power = json.loads((destination / 'quality-dunk-net.json').read_text())
    checks['shotNetActive'] = pull['netReactions'] == 1 and 0 <= pull['netClock'] < .5 and pull['netStrength'] > 0
    checks['dunkNetStronger'] = power['netReactions'] == 2 and power['netStrength'] > pull['netStrength']
for name, captured in names:
    state = json.loads((destination / (name + '.json')).read_text())
    checks[name + 'Viewport'] = state['viewportWidth'] == width and state['viewportHeight'] == height and state['worldRenderingEnabled']
    if captured:
        checks[name + 'ImageSize'] = Image.open(destination / (name + '.png')).size == (width, height)
text = log.read_text(encoding='utf-8', errors='replace')
checks['fontsLoaded'] = all(name in text for name in ['BarlowCondensed-SemiBold.ttf', 'BarlowSemiCondensed-Medium.ttf'])
checks['noMaterialFallback'] = 'Failed to compile Material' not in text
checks['noFatal'] = 'Fatal error!' not in text
report = {'completed': code == 0, 'passed': all(checks.values()), 'kind': kind, 'started': started.isoformat(),
          'evidence': str(destination), 'runtimeSHA256': hashlib.sha256(runtime.read_bytes()).hexdigest(),
          'viewport': [width, height], 'checks': checks, 'visualReviewRequired': True,
          'method': 'Native player key events; marked observation cameras; actual Chaos downward crossings'}
(destination / 'run.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
(root / f'Reports/v03-quality-{kind}-{width}.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2), flush=True)
raise SystemExit(0 if report['passed'] else 1)
