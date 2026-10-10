"""A bounded higher resolution SWISSIMAGE atlas for the near road corridor. © swisstopo."""
import math
import json
import os
import urllib.request
import tempfile
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path(os.environ.get("PALACE_ALPINE_CACHE",str(Path(tempfile.gettempdir()) / "palace-alpine-source")))
DEST = ROOT / "public/media/alpine"
meta = json.loads((DEST / "geography.json").read_text())
info = meta["imagery"]
zoom = 16
def point(x,z):
    lon,lat=info["longitude"]+x/info["eastMetresPerDegree"],info["latitude"]-z/111320
    return (lon+180)/360*2**zoom*256,(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**zoom*256
x1,y1=point(-4800,-950)
x2,y2=point(600,1850)
left,top,right,bottom=math.floor(x1/256),math.floor(y1/256),math.ceil(x2/256),math.ceil(y2/256)
def fetch(job):
    x,y=job
    file=CACHE/f"swissimage-{zoom}-{x}-{y}.jpeg"
    if not file.exists():
        url=f"https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{zoom}/{x}/{y}.jpeg"
        for attempt in range(3):
            try:
                with urllib.request.urlopen(url,timeout=45) as response:
                    data=response.read()
                file.write_bytes(data)
                break
            except Exception:
                if attempt==2:raise
                time.sleep(2)
    return x,y,Image.open(file).convert("RGB")
atlas=Image.new("RGB",((right-left)*256,(bottom-top)*256))
with ThreadPoolExecutor(max_workers=4) as pool:
    for x,y,image in pool.map(fetch,[(x,y) for y in range(top,bottom) for x in range(left,right)]):
        atlas.paste(image,((x-left)*256,(y-top)*256))
atlas.save(DEST / "swissimage-near.webp","WEBP",quality=91)
meta["nearImagery"]={**info,"zoom":zoom,"left":left*256,"top":top*256,"width":atlas.width,"height":atlas.height}
(DEST / "geography.json").write_text(json.dumps(meta,separators=(",",":")),encoding="utf8")
print("near atlas",atlas.size,"~1.64 m source pixels",flush=True)
