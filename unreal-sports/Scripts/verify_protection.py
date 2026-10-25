"""只核对已有清单；并发项目的变化单列记录，不回滚也不覆盖。"""
from pathlib import Path
import json, hashlib, datetime
ROOT=Path(__file__).resolve().parents[1]
WORKSPACE=ROOT.parent
baseline=json.loads((ROOT/'Reports/source-protection.json').read_text(encoding='utf-8-sig'))
groups={}
for item in baseline['files']:
    relative=Path(item['file'])
    if relative.is_absolute() or '..' in relative.parts:raise ValueError('保护清单路径越界')
    source=WORKSPACE/relative
    group=relative.parts[0]
    status=groups.setdefault(group,{'matched':0,'changed':[],'missing':[]})
    if not source.exists():status['missing'].append(str(relative));continue
    actual=hashlib.sha256(source.read_bytes()).hexdigest()
    if actual.lower()==item['sha256'].lower():status['matched']+=1
    else:status['changed'].append(str(relative))
report={'at':datetime.datetime.now().astimezone().isoformat(),'groups':groups,'action':'read-only verification; no original files changed or restored','concurrentWork':'basketball-work may contain changes from its ongoing task'}
(ROOT/'Reports/protection-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({key:{'matched':value['matched'],'changed':len(value['changed']),'missing':len(value['missing'])} for key,value in groups.items()}))
