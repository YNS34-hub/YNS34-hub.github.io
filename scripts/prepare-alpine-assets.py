"""离线准备高山地图的公开数据与 CC0 材质；运行时不请求地图服务。"""
import json
import math
import urllib.request
import urllib.parse
import heapq
import os
import tempfile
from pathlib import Path
from io import BytesIO
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path(os.environ.get("PALACE_ALPINE_CACHE", str(Path(tempfile.gettempdir()) / "palace-alpine-source")))
CACHE.mkdir(parents=True, exist_ok=True)
DEST = ROOT / "public/media/alpine"
DEST.mkdir(parents=True, exist_ok=True)
SOURCE = ROOT / "src/worlds/alpine"
SOURCE.mkdir(parents=True, exist_ok=True)
HEADERS = {"User-Agent": "Mozilla/5.0", "Referer": "https://polyhaven.com/"}

def download(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=45) as response:
        return response.read()

# EU-DEM 原始高度只减去 1500 米以保持较小局部坐标，绝不夸张山体的垂直尺度。
LAT, LON, BASE = 46.5725954, 8.4150861, 1500
EAST = 111320 * math.cos(math.radians(LAT))
tiles = {}
def elevation(x, z):
    lat, lon = LAT - z / 111320, LON + x / EAST
    u = (lon + 180) / 360 * 4096 * 256
    v = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * 4096 * 256
    def pixel(a, b):
        key = (a // 256, b // 256)
        if key not in tiles:
            file = CACHE / f"dem-{key[0]}-{key[1]}.png"
            if not file.exists():
                file.write_bytes(download(f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/12/{key[0]}/{key[1]}.png"))
            tiles[key] = Image.open(file).convert("RGB")
        r, g, blue = tiles[key].getpixel((a % 256, b % 256))
        return r * 256 + g + blue / 256 - 32768 - BASE
    a, b = math.floor(u), math.floor(v)
    tx, ty = u - a, v - b
    return (pixel(a, b)*(1-tx)+pixel(a+1, b)*tx)*(1-ty)+(pixel(a, b+1)*(1-tx)+pixel(a+1, b+1)*tx)*ty

width, height, step, x0, z0 = 385, 305, 50, -10000, -7500
values = [round(elevation(x0 + i * step, z0 + j * step) * 2) for j in range(height) for i in range(width)]
(DEST / "terrain.json").write_text(json.dumps({"width": width, "height": height, "step": step, "x0": x0, "z0": z0, "base": BASE, "values": values}, separators=(",", ":")), encoding="utf8")

# 当缓存不存在时，从公开 Overpass 准备路网，沿米制权重寻找山口到谷口的公路；无登录与私人数据。
road_file = CACHE / "road-latlon.json"
if not road_file.exists():
    query = '[out:json][timeout:25];way[highway][name~"Furka"](46.54,8.34,46.59,8.45);out geom;'
    roads = json.loads(download("https://overpass-api.de/api/interpreter?data=" + urllib.parse.quote(query)))
    nodes, edges = {}, {}
    for way in roads["elements"]:
        if way.get("tags", {}).get("highway") not in ["primary", "secondary", "tertiary", "unclassified"]:
            continue
        for node, point in zip(way["nodes"], way["geometry"]):
            nodes[node] = (point["lat"], point["lon"])
        for first, second in zip(way["nodes"], way["nodes"][1:]):
            a, b = nodes[first], nodes[second]
            cost = math.hypot((a[0]-b[0])*111320, (a[1]-b[1])*EAST)
            edges.setdefault(first, []).append((second, cost))
            edges.setdefault(second, []).append((first, cost))
    nearest = lambda lat, lon: min(nodes, key=lambda n: (nodes[n][0]-lat)**2+((nodes[n][1]-lon)*.686)**2)
    start, end = nearest(LAT, LON), nearest(46.5615625,8.3626086)
    queue, costs, previous = [(0,start)], {start:0}, {}
    while queue:
        cost, node = heapq.heappop(queue)
        if node == end:
            break
        if cost != costs[node]:
            continue
        for target, length in edges[node]:
            if cost+length < costs.get(target,float("inf")):
                costs[target] = cost+length
                previous[target] = node
                heapq.heappush(queue,(cost+length,target))
    chain = [end]
    while chain[-1] != start:
        chain.append(previous[chain[-1]])
    chain.reverse()
    road_file.write_text(json.dumps([nodes[n] for n in chain]),encoding="utf8")

# 公路中心线来自 OSM。原始采样保留弯道，均匀重采样与 30 米高度平滑只消除 DEM 噪声。
raw = json.loads(road_file.read_text(encoding="utf8"))
points = [((lon-LON)*EAST, (LAT-lat)*111320) for lat, lon in raw]
distance = [0.0]
for a, b in zip(points, points[1:]):
    distance.append(distance[-1] + math.dist(a, b))
sampled, segment = [], 0
for d in range(0, int(distance[-1]), 12):
    while segment < len(points)-2 and distance[segment+1] < d:
        segment += 1
    t = (d-distance[segment]) / (distance[segment+1]-distance[segment])
    a, b = points[segment], points[segment+1]
    x, z = a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t
    sampled.append([x, elevation(x, z), z])
sampled.append([points[-1][0], elevation(*points[-1]), points[-1][1]])
for i, p in enumerate(sampled):
    p[1] = sum(elevation(q[0], q[2]) for q in sampled[max(0,i-2):i+3]) / len(sampled[max(0,i-2):i+3])
    if i:
        span = math.hypot(p[0]-sampled[i-1][0], p[2]-sampled[i-1][2])
        p[1] = max(sampled[i-1][1]-.115*span, min(sampled[i-1][1]+.115*span, p[1]))
(SOURCE / "road-data.json").write_text(json.dumps([[round(n,3) for n in p] for p in sampled], separators=(",", ":")), encoding="utf8")

for asset, prefix in [("aerial_grass_rock", "meadow"), ("rock_01", "rock")]:
    data_file=CACHE / (asset + ".json")
    if not data_file.exists():
        data_file.write_bytes(download("https://api.polyhaven.com/files/"+asset))
    data = json.loads(data_file.read_text(encoding="utf8"))
    for key, suffix in [("Diffuse", "color"), ("nor_gl", "normal")]:
        url = data[key]["1k"]["jpg"]["url"]
        file = DEST / (prefix + "-" + suffix + ".webp")
        if not file.exists():
            Image.open(BytesIO(download(url))).save(file, "WEBP", quality=91)
sky_file=CACHE / "kloppenheim_06_puresky.json"
if not sky_file.exists():
    sky_file.write_bytes(download("https://api.polyhaven.com/files/kloppenheim_06_puresky"))
sky = json.loads(sky_file.read_text(encoding="utf8"))
file = DEST / "daylight-2k.hdr"
if not file.exists():
    file.write_bytes(download(sky["hdri"]["2k"]["hdr"]["url"]))
print({"terrainSamples": len(values), "roadKnots": len(sampled), "horizontalMetres": round(distance[-1]), "descentMetres": round(sampled[0][1]-sampled[-1][1])})
