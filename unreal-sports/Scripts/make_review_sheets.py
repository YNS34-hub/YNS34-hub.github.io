"""只生成本机原生截图的人工检查拼页，不据此自动判定美术通过。"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, math

root = Path(__file__).resolve().parents[1]
out = root / 'Reports/Private/review-sheets'
out.mkdir(parents=True, exist_ok=True)
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 17)
def sheet(label, paths, columns=2, width=800):
    rows = math.ceil(len(paths)/columns)
    height = round(width*900/1600)
    canvas = Image.new('RGB',(columns*width, rows*(height+25)), '#181c1b')
    draw = ImageDraw.Draw(canvas)
    for i,path in enumerate(paths):
        assert path.is_file(), path
        x = (i%columns)*width; y = (i//columns)*(height+25)
        draw.text((x+6,y+3),path.stem,fill='#e7e7df',font=font)
        with Image.open(path) as native:
            assert native.size in [(1600,900),(1280,720)], path
            canvas.paste(native.convert('RGB').resize((width,height),Image.Resampling.LANCZOS),(x,y+25))
    target = out / (label+'.jpg')
    canvas.save(target,quality=94)
    return {'sheet':str(target),'sources':[str(p) for p in paths]}

run = json.loads((root/'Reports/upgrade-Standalone-run.json').read_text(encoding='utf-8-sig'))
evidence = Path(run['evidence'])
sequence = json.loads((root/'Reports/upgrade-input-sequence.json').read_text())
names = [e['capture'] for events in sequence.values() for e in events if 'capture' in e]
groups = {key:[] for key in ['intro','shots','layups','dunks','ride']}
for name in names:
    key = 'ride' if '-ride-' in name else 'shots' if '-shot-' in name else 'layups' if '-layup-' in name else 'dunks' if '-dunk-' in name else 'intro'
    groups[key].append(evidence/(name+'.png'))
manifest = [sheet('upgrade-'+key,paths,3 if key=='layups' else 2,600 if key=='layups' else 800) for key,paths in groups.items()]
regression_names = ['court-overview','court-dribble-right','court-dribble-left','court-score','court-jump','court-pause',
                    'court-first-person','ride-start','ride-braked','ride-view-0400m','ride-view-1050m','ride-view-1800m',
                    'ride-view-2450m','ride-view-3200m','ride-completed','ride-restarted']
regression_run=json.loads((root/'Reports/standalone-run.json').read_text(encoding='utf-8-sig'))
if regression_run['runtimeSHA256'].lower() == run['runtimeSHA256'].lower():
    manifest.append(sheet('regression',[root/'Reports/StandaloneEvidence'/('standalone-'+name+'.png') for name in regression_names],3,600))
detail_path=root/'Reports/final-details-run.json'
if detail_path.exists():
    details=json.loads(detail_path.read_text())
    if details['runtimeSHA256'] == run['runtimeSHA256']:
        manifest.append(sheet('scene-details',[Path(details['evidence'])/(name+'.png') for name in details['images']]))
# 近景和小分辨率保留各自运行目录，防止拼页混入旧版本截图。
for label, report_name in [
    ('arms','arms-review-run.json'),
    ('quality','v03-quality-Standalone-1600.json'),
    ('compact','v03-quality-Standalone-1280.json'),
    ('route','upgrade-route-run.json')]:
    report=json.loads((root/'Reports'/report_name).read_text(encoding='utf-8-sig'))
    assert report['runtimeSHA256'].lower() == run['runtimeSHA256'].lower(), report_name
    paths=sorted(Path(report['evidence']).glob('*.png'))
    assert paths, report_name
    for offset in range(0,len(paths),6):
        manifest.append(sheet(f'{label}-{offset//6+1}',paths[offset:offset+6]))
(out/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(json.dumps([{'sheet':m['sheet'],'images':len(m['sources'])} for m in manifest],indent=2))
