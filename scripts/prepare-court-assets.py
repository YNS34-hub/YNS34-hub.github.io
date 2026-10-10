"""仅获取公开许可素材；视频只用于观察，不进入网站资源。"""
import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
import requests
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path("E:/Temp/palace-court-source")
OUT = ROOT / "public/media/court"
CACHE.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

def download(url, target):
    target = Path(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        r = requests.get(url, timeout=180)
        r.raise_for_status()
        target.write_bytes(r.content)
    return target

def photo_asset(name):
    info = requests.get("https://api.polyhaven.com/files/" + name, timeout=40).json()
    asset = info["gltf"]["1k"]["gltf"]
    folder = CACHE / name
    download(asset["url"], folder / "scene.gltf")
    jobs = [(v["url"], folder / k) for k, v in asset["include"].items()]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(lambda j: download(*j), jobs))
    print(name, "source files ready", flush=True)

def people():
    tree = requests.get("https://api.github.com/repos/microsoft/Microsoft-Rocketbox/git/trees/master?recursive=1", timeout=50).json()
    commit = tree["sha"]
    names = ["Male_Adult_03", "Male_Adult_08", "Male_Adult_12", "Female_Adult_05", "Female_Adult_08", "Male_Adult_19"]
    jobs = []
    for n in names:
        prefix = "Assets/Avatars/Adults/" + n + "/"
        for f in tree["tree"]:
            p = f["path"]
            if p.startswith(prefix) and (p.endswith("/Export/" + n + ".fbx") or p.endswith("_color.tga") or p.endswith("_normal.tga")):
                jobs.append(("https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/" + commit + "/" + p, CACHE / "people" / n / p.split("/")[-1]))
    for n in ["m_idle_look_around_01.max.fbx", "m_idle_neutral_01.max.fbx", "f_idle_neutral_01.max.fbx", "m_claphands_01.max.fbx"]:
        p = "Assets/Animations/all_animations_max_motextr_static/" + n
        jobs.append(("https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/" + commit + "/" + p, CACHE / "people" / n))
    jobs.append(("https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/" + commit + "/LICENSE.md", OUT / "ROCKETBOX-LICENSE.md"))
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        list(pool.map(lambda j: download(*j), jobs))
    for n in names:
        folder = OUT / "people" / n
        folder.mkdir(parents=True, exist_ok=True)
        for f in (CACHE / "people" / n).glob("*_color.tga"):
            im = Image.open(f).convert("RGBA")
            im.thumbnail((512, 512))
            im.save(folder / (f.stem + ".webp"), quality=88)
    (CACHE / "rocketbox-source.json").write_text(json.dumps({"commit": commit, "names": names}), encoding="utf8")
    print("MIT crowd sources ready", commit, flush=True)

def surfaces():
    for name, prefix in [("asphalt_04", "aggregate"), ("brick_pavement_02", "paving")]:
        info = requests.get("https://api.polyhaven.com/files/" + name, timeout=40).json()
        for part, output in [("Diffuse", "color"), ("nor_gl", "normal"), ("Rough", "rough")]:
            section = info.get(part) or info.get(part.lower())
            if not section:
                raise RuntimeError("Missing source channel " + name + " / " + part)
            entry = section["2k"].get("jpg") or section["2k"].get("png")
            f = download(entry["url"], CACHE / (name + "_" + output + ".jpg"))
            im = Image.open(f).convert("RGB")
            im.save(OUT / (prefix + "-" + output + ".webp"), quality=90)
        print(name, "2K PBR ready", flush=True)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(); parser.add_argument("group", choices=["trees", "people", "surfaces"]); args = parser.parse_args()
    if args.group == "trees": photo_asset("jacaranda_tree")
    if args.group == "people": people()
    if args.group == "surfaces": surfaces()
