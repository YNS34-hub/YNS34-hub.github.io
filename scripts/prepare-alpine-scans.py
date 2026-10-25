"""Download a small, bounded set of CC0 Poly Haven scans; bake no reference-video assets."""
import json
import os
import urllib.request
import tempfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path(os.environ.get("PALACE_ALPINE_CACHE", str(Path(tempfile.gettempdir()) / "palace-alpine-source")))
DEST = ROOT / "public/media/alpine"
CACHE.mkdir(parents=True,exist_ok=True)
DEST.mkdir(parents=True,exist_ok=True)
HEADERS = {"User-Agent":"Mozilla/5.0", "Referer":"https://polyhaven.com/"}
def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url,headers=HEADERS),timeout=60) as response:
        return response.read()
def source(asset):
    file = CACHE / (asset+".json")
    if not file.exists():
        file.write_bytes(fetch("https://api.polyhaven.com/files/"+asset))
    return json.loads(file.read_text())

for asset in ["rock_09","rock_face_01"]:
    data = source(asset)["gltf"]["1k"]["gltf"]
    directory = DEST / asset
    directory.mkdir(exist_ok=True)
    gltf = json.loads(fetch(data["url"]))
    for name, entry in data["include"].items():
        file = directory / name
        file.parent.mkdir(parents=True,exist_ok=True)
        raw = CACHE / (asset+"-"+Path(name).name)
        if not raw.exists():
            raw.write_bytes(fetch(entry["url"]))
        if name.endswith(".jpg"):
            im = Image.open(raw)
            file = file.with_suffix(".webp")
            im.save(file,"WEBP",quality=93)
            for image in gltf["images"]:
                if image["uri"] == name:
                    image["uri"] = str(Path(name).with_suffix(".webp")).replace("\\","/")
        else:
            file.write_bytes(raw.read_bytes())
    (directory / "scene.gltf").write_text(json.dumps(gltf,separators=(",",":")),encoding="utf8")
    print(asset,[(a.get("count"),a.get("type")) for a in gltf["accessors"]],flush=True)

for asset,prefix in [("aerial_grass_rock","meadow"),("rock_01","rock"),("asphalt_01","road")]:
    data = source(asset)
    for key,suffix in [("Diffuse","color"),("nor_gl","normal")]:
        file = CACHE / (prefix+"-2k-"+suffix+".jpg")
        if not file.exists():
            file.write_bytes(fetch(data[key]["2k"]["jpg"]["url"]))
        Image.open(file).save(DEST / (prefix+"-"+suffix+".webp"),"WEBP",quality=94)
sky_data=source("kloofendal_48d_partly_cloudy_puresky")
sky=sky_data["hdri"]["2k"]["hdr"]
file=CACHE/"clear-daylight-2k.hdr"
if not file.exists():file.write_bytes(fetch(sky["url"]))
(DEST/"clear-daylight-2k.hdr").write_bytes(file.read_bytes())
file=CACHE/"daylight-tone.jpg"
if not file.exists():file.write_bytes(fetch(sky_data["tonemapped"]["url"]))
# 这是下载 API 提供的原始色调映射文件，不是网站缩略预览。JPEG 半分辨率解码避免占用整个高精原图。
Image.MAX_IMAGE_PIXELS=200_000_000
image=Image.open(file);image.draft("RGB",(8192,4096))
image.convert("RGB").resize((8192,4096),Image.Resampling.LANCZOS).save(DEST/"clear-sky-8k.webp","WEBP",quality=91)
print("prepared 1K scans, 2K near-field materials, 2K lighting HDR and 8K viewing sky",flush=True)
