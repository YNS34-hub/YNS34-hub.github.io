"""用实际原生输入检查左右手、出手回落和握把；证据只留在本机。"""
from pathlib import Path
from datetime import datetime
import json, subprocess, os, shutil, hashlib, sys

alias = Path('E:/Codex/UnrealSports')
standalone = '--standalone' in sys.argv
user = alias / ('Reports/UpgradeUser-Arms-Standalone' if standalone else 'Reports/UpgradeUser-Arms')
saved = user / 'Saved'
saved.mkdir(parents=True, exist_ok=True)
court, ride = [], []
def key(t, name, down=True, sequence=court):
    sequence.append({'at': t, 'key': name, 'down': down})
def press(t, name, sequence=court):
    key(t, name, True, sequence)
    key(t + .08, name, False, sequence)
def camera(t, yaw, pitch=-8, sequence=court):
    sequence.append({'at': t, 'cameraYaw': yaw, 'cameraPitch': pitch})
def photo(t, name, sequence=court):
    sequence.append({'at': t, 'capture': 'arms-' + name})

camera(3, 160); photo(4, 'carry-right')
press(5, 'X'); photo(6, 'carry-left')
press(7, 'E'); photo(7.6, 'dribble-left')
press(8, 'E'); press(8.2, 'X'); camera(9, 0, -10)
key(9, 'RightMouseButton'); key(10, 'LeftMouseButton')
photo(10.5, 'shot-gather'); key(10.62, 'LeftMouseButton', False)
photo(10.87, 'shot-release'); key(12, 'RightMouseButton', False)
camera(13, 160); photo(14, 'relaxed-front')
camera(15, 90); photo(16, 'relaxed-side')
press(17, 'R'); camera(17.2, 0, -10)
key(18, 'W'); key(19.7, 'W', False); camera(19.8, 32, -10)
press(20.2, 'G'); photo(20.73, 'one-takeoff'); photo(21.02, 'one-release')
photo(22.5, 'one-landed'); camera(23, 150); photo(24, 'finish-relaxed')
press(25, 'Three'); press(26, 'R'); camera(26.2, 0, -10)
key(27, 'W'); key(28.7, 'W', False); camera(28.8, 32, -10)
press(29.2, 'G'); photo(29.73, 'two-takeoff'); photo(30.02, 'two-release')
photo(32, 'two-landed')
press(33, 'R'); press(34, 'X'); camera(34.2, 0, -10)
key(35, 'W'); key(36.7, 'W', False); camera(36.8, -32, -10)
press(37.2, 'F'); photo(37.65, 'left-layup'); photo(38, 'left-release'); photo(39.5, 'left-landed')
press(41, 'F2')
camera(3, 120, -4, ride); photo(4, 'ride-grip', ride)
key(6, 'W', sequence=ride); key(7, 'LeftShift', sequence=ride)
photo(8, 'ride-power-grip', ride); press(12, 'F10', ride)

sequence = {'basketball': sorted(court, key=lambda e: e['at']), 'cycling': sorted(ride, key=lambda e: e['at'])}
(saved / 'qa-sequence.json').write_text(json.dumps(sequence), encoding='utf-8')
(saved / 'motion-loadout.json').write_text('{"shot":1,"layup":0,"dunk":0}', encoding='utf-8')
(saved / 'ride-progress.json').write_text('{"distance":0,"gear":7}', encoding='utf-8')
env = dict(os.environ)
env['UE-LocalDataCachePath'] = 'E:/Codex/UnrealSportsCache/DDC'
started = datetime.now()
log = alias / 'Reports/arms-preview.log'
command = [r'C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe',
           str(alias / 'MemorySports.uproject'), '/Game/MemorySports/Maps/TrainingHall', '-game', '-dx11',
           '-windowed', '-ForceRes', '-ResX=1600', '-ResY=900', '-SportsQA', '-NoSplash',
           f'-UserDir={user}/', f'-abslog={log}']
if standalone:
    command = [str(alias/'Delivery/Windows/MemorySports/Binaries/Win64/MemorySports.exe')] + command[2:]
    command = [argument for argument in command if argument not in ['-game','-NoSplash']]
p = subprocess.Popen(command, cwd=alias, env=env)
print('Native arm review PID', p.pid, flush=True)
result = p.wait(timeout=300)
destination = alias / 'Reports/UpgradeEvidence' / (('Arms-Standalone-' if standalone else 'Arms-') + started.strftime('%Y%m%d-%H%M%S'))
destination.mkdir(parents=True, exist_ok=True)
expected = [e['capture'] for events in sequence.values() for e in events if 'capture' in e]
for name in expected:
    for suffix in ['.png', '.json']:
        source = alias / ('Delivery/Windows/MemorySports/Reports/Evidence' if standalone else 'Reports/Evidence') / (name + suffix)
        assert source.is_file() and source.stat().st_mtime >= started.timestamp(), f'Missing fresh native capture: {source}'
        shutil.copy2(source, destination / source.name)
shutil.copy2(log, destination / 'engine.log')
report = {'completed': result == 0, 'started': started.isoformat(), 'evidence': str(destination),
          'kind':'Standalone' if standalone else 'EditorGame',
          'runtimeSHA256':hashlib.sha256((alias/('Delivery/Windows/MemorySports/Binaries/Win64/MemorySports.exe' if standalone else 'Binaries/Win64/UnrealEditor-MemorySports.dll')).read_bytes()).hexdigest(),
          'images': expected, 'method': 'Actual native player inputs and separately marked observation cameras',
          'visualReviewRequired': True}
(alias / 'Reports/arms-review-run.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
(destination / 'run.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2), flush=True)
