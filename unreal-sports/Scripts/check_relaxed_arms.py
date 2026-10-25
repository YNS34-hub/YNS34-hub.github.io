"""检查原生骨骼实际下垂角度、左右手发力区别与新鲜截图。"""
from pathlib import Path
from datetime import datetime
import hashlib, json
from PIL import Image

root = Path(__file__).resolve().parents[1]
run = json.loads((root / 'Reports/arms-review-run.json').read_text(encoding='utf-8'))
evidence = Path(run['evidence'])
started = datetime.fromisoformat(run['started']).timestamp()
checks = []
def check(name, passed, detail=None):
    checks.append({'name': name, 'passed': bool(passed), 'detail': detail})
def state(name):
    return json.loads((evidence / ('arms-' + name + '.json')).read_text(encoding='utf-8-sig'))

check('Fresh native images at full resolution', all(
    (evidence / (name + '.png')).stat().st_mtime >= started and
    Image.open(evidence / (name + '.png')).size == (1600, 900) for name in run['images']))
for pose in ['relaxed-front', 'relaxed-side', 'one-landed', 'finish-relaxed', 'two-landed', 'left-landed']:
    s = state(pose)
    angles = {side: s[side + 'ArmDownAngleDeg'] for side in ['left', 'right']}
    check('Both arms near vertical: ' + pose, s['activeAction'] == 0 and max(angles.values()) < 18, angles)
for pose, side in [('carry-right','left'), ('carry-left','right'), ('dribble-left','right'),
                   ('shot-release','left'), ('one-takeoff','left'), ('one-release','left'),
                   ('left-layup','right'), ('left-release','right')]:
    s = state(pose)
    check('Free arm remains lowered: ' + pose, s[side + 'ArmDownAngleDeg'] < 18, s[side + 'ArmDownAngleDeg'])
check('Single hand dunk raises only its active arm', state('one-release')['rightArmDownAngleDeg'] > 120)
check('Two hand dunk retains both raised arms', min(state('two-release')[s+'ArmDownAngleDeg'] for s in ['left','right']) > 120)
check('Left hand layup still uses the left arm', state('left-release')['leftHanded'] and state('left-release')['leftArmDownAngleDeg'] > 95)
check('Original physics still scores in this short input sequence', state('left-landed')['score'] == 4)
images = [{'path': str(evidence/(name+'.png')),
           'sha256': hashlib.sha256((evidence/(name+'.png')).read_bytes()).hexdigest()} for name in run['images']]
report = {'passed': run['completed'] and all(c['passed'] for c in checks), 'checks': checks,
          'images': images, 'evidence': str(evidence), 'visualScope': 'Arm pose inspection only; final scene rendering checked separately in packaged executable'}
(root / 'Reports/arms-review-checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'passed': report['passed'], 'checks': len(checks), 'images': len(images)}, indent=2))
raise SystemExit(0 if report['passed'] else 1)
