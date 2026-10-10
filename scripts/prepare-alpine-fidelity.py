"""Prepare offline Swiss open geodata. Raw downloads stay outside the repository.

Requires Pillow, numpy, rasterio and pyproj. Source data: © swisstopo.
Existing OSM horizontal alignment and the original forest map are preserved.
"""
import os
import json
import math
import time
import tempfile
import urllib.request
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image
import rasterio
from pyproj import Transformer

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path(os.environ.get("PALACE_ALPINE_CACHE", str(Path(tempfile.gettempdir()) / "palace-alpine-source")))
DEST = ROOT / "public/media/alpine"
CACHE.mkdir(parents=True, exist_ok=True)
LAT, LON, BASE = 46.5725954, 8.4150861, 1500
EAST = 111320 * math.cos(math.radians(LAT))

def download(url):
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "MemoryPalaceAssetPreparation/1.0"})
            with urllib.request.urlopen(request, timeout=60) as response:
                return response.read()
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 + attempt)

def cache_file(name, url):
    file = CACHE / name
    if not file.exists():
        content = download(url)
        temp = file.with_suffix(file.suffix + ".part")
        temp.write_bytes(content)
        temp.replace(file)
    return file

# 两级实测高程：远山 10 米，沿整条公路的近山 4 米。运行时不请求地图服务。
grids = [dict(name="massif", x0=-10000, z0=-7500, step=10, width=1921, height=1521),
         dict(name="detail", x0=-4800, z0=-950, step=4, width=1351, height=701)]
transform = Transformer.from_crs(4326, 2056, always_xy=True)
for grid in grids:
    x, z = np.meshgrid(grid["x0"] + np.arange(grid["width"])*grid["step"], grid["z0"] + np.arange(grid["height"])*grid["step"])
    grid["east"], grid["north"] = transform.transform(LON+x/EAST, LAT-z/111320)

catalog = CACHE / "swissalti3d-catalog.json"
if not catalog.exists():
    url = "https://data.geo.admin.ch/api/stac/v1/collections/ch.swisstopo.swissalti3d/items?bbox=8.275,46.502,8.54,46.641&limit=100"
    items = []
    while url:
        data = json.loads(download(url))
        items.extend(data["features"])
        url = next((link["href"] for link in data["links"] if link["rel"] == "next"), None)
        print("catalog", len(items), flush=True)
    catalog.write_text(json.dumps(items), encoding="utf8")
items = json.loads(catalog.read_text(encoding="utf8"))
selected = {}
for item in items:
    tile = item["id"].split("_")[-1]
    asset = next((a for name, a in item["assets"].items() if name.endswith("_2_2056_5728.tif")), None)
    if asset and (tile not in selected or item["properties"]["datetime"] > selected[tile][0]):
        selected[tile] = (item["properties"]["datetime"], asset["href"])

needed = set()
for grid in grids:
    grid["tile_x"] = np.floor(grid["east"]/1000).astype(int)
    grid["tile_y"] = np.floor(grid["north"]/1000).astype(int)
    needed.update(zip(grid["tile_x"].ravel(), grid["tile_y"].ravel()))
jobs = [(f"{x}-{y}", selected[f"{x}-{y}"][1]) for x, y in sorted(needed)]
def fetch(job):
    tile, url = job
    return tile, cache_file("swiss-dem-"+url.split("/")[-1], url), url
with ThreadPoolExecutor(max_workers=4) as pool:
    files = list(pool.map(fetch, jobs))
print("DEM tiles", len(files), flush=True)

for grid in grids:
    values = np.full((grid["height"], grid["width"]), np.nan)
    for tile, file, _ in files:
        tx, ty = map(int, tile.split("-"))
        mask = (grid["tile_x"] == tx) & (grid["tile_y"] == ty)
        if not mask.any():
            continue
        with rasterio.open(file) as ds:
            image = ds.read(1)
            col = (grid["east"][mask]-ds.transform.c)/ds.transform.a - .5
            row = (grid["north"][mask]-ds.transform.f)/ds.transform.e - .5
            col = np.clip(col, 0, ds.width-1.001)
            row = np.clip(row, 0, ds.height-1.001)
            i, j = col.astype(int), row.astype(int)
            a, b = col-i, row-j
            values[mask] = ((image[j,i]*(1-a)+image[j,i+1]*a)*(1-b)+(image[j+1,i]*(1-a)+image[j+1,i+1]*a)*b)-BASE
    if not np.isfinite(values).all():
        raise ValueError("Missing measured elevation samples")
    # Signed little-endian half-metre samples, avoiding multi-megabyte JSON arrays.
    np.rint(values*2).astype("<i2").tofile(DEST / (grid["name"]+"-dem.bin"))
    grid["values"] = values
meta = {g["name"]: {k: g[k] for k in ["x0", "z0", "step", "width", "height"]} | {"base": BASE} for g in grids}
(DEST / "geography.json").write_text(json.dumps(meta, separators=(",", ":")), encoding="utf8")

# SWISSIMAGE: one bounded offline atlas. Actual aerial land cover replaces tiled far-field grass.
# WebMercator UV is calculated from latitude in the shader, not stretched across a rectangular map.
zoom = 14
def mercator(lon, lat):
    return (lon+180)/360*2**zoom*256, (1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**zoom*256
x1,y1 = mercator(LON-10000/EAST, LAT+7500/111320)
x2,y2 = mercator(LON+9200/EAST, LAT-7700/111320)
left, top, right, bottom = math.floor(x1/256), math.floor(y1/256), math.floor(x2/256)+1, math.floor(y2/256)+1
def imagery(job):
    x,y = job
    url = f"https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{zoom}/{x}/{y}.jpeg"
    file = cache_file(f"swissimage-{zoom}-{x}-{y}.jpeg", url)
    return x, y, Image.open(file).convert("RGB")
atlas = Image.new("RGB", ((right-left)*256, (bottom-top)*256))
with ThreadPoolExecutor(max_workers=4) as pool:
    for x,y,im in pool.map(imagery, [(x,y) for y in range(top,bottom) for x in range(left,right)]):
        atlas.paste(im, ((x-left)*256,(y-top)*256))
atlas.save(DEST / "swissimage.webp", "WEBP", quality=92)
meta["imagery"] = {"zoom":zoom,"left":left*256,"top":top*256,"width":atlas.width,"height":atlas.height,"latitude":LAT,"longitude":LON,"eastMetresPerDegree":EAST}
(DEST / "geography.json").write_text(json.dumps(meta, separators=(",", ":")), encoding="utf8")

# 公路仅修正垂直高程以贴合新实测地表，保留 OSM 的全部水平弯道、方向和保存键。
road_file = ROOT / "src/worlds/alpine/road-data.json"
road = json.loads(road_file.read_text(encoding="utf8"))
grid = grids[1]
def height(x,z):
    u, v = (x-grid["x0"])/grid["step"], (z-grid["z0"])/grid["step"]
    i,j = int(u),int(v)
    a,b = u-i,v-j
    f = grid["values"]
    return (f[j,i]*(1-a)+f[j,i+1]*a)*(1-b)+(f[j+1,i]*(1-a)+f[j+1,i+1]*a)*b
heights = [height(p[0],p[2]) for p in road]
for i,p in enumerate(road):
    p[1] = sum(heights[max(0,i-1):i+2])/len(heights[max(0,i-1):i+2])
    if i:
        span = math.hypot(p[0]-road[i-1][0],p[2]-road[i-1][2])
        p[1] = max(road[i-1][1]-.115*span,min(road[i-1][1]+.115*span,p[1]))
    p[1] = round(p[1],3)
road_file.write_text(json.dumps(road,separators=(",", ":")),encoding="utf8")
(CACHE / "fidelity-source-manifest.json").write_text(json.dumps({"dem":[{"tile":t,"url":u} for t,_,u in files],"imagery":meta["imagery"],"attribution":"© swisstopo","date":"2026-10-10"},indent=2),encoding="utf8")
print({"atlas":atlas.size,"massifSamples":grids[0]["width"]*grids[0]["height"],"nearSamples":grids[1]["width"]*grids[1]["height"],"roadDescent":road[0][1]-road[-1][1]},flush=True)
