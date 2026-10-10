"""打包同路段、同画质的实际对照；不读取私人图库或参考影片。"""
import json
import os
import shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = Path(os.environ.get("PALACE_ARTIFACTS", ROOT.parents[1] / "outputs/alpine-fidelity"))
DEST = ROOT / "docs/alpine-fidelity/evidence"
DEST.mkdir(parents=True, exist_ok=True)

def report(folder, name="captures.json"):
    value = json.loads((ARTIFACTS / folder / name).read_text(encoding="utf8"))
    assert not value.get("errors") and not value.get("failure"), (folder, value)
    return value

before, after = report("before"), report("release-final")
assert before["sha"] == "f67509e1b663aa42197b41bf7099bafa6d0a0aac" and not before["dirty"]
assert len(after["frames"]) == 14
assert all(frame["actual"]["mounted"] == "true" for frame in after["frames"])
names = ["high-pass", "upper-corniche", "rock-cut", "high-overlook", "switchbacks", "lower-meadow", "arrival"]
font = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 18)

def tile(file, label, width=640):
    source = Image.open(file).convert("RGB")
    height = round(source.height * width / source.width)
    canvas = Image.new("RGB", (width, height+34), "#152027")
    canvas.paste(source.resize((width, height), Image.Resampling.LANCZOS), (0, 34))
    ImageDraw.Draw(canvas).text((14, 5), label, fill="#e5edf0", font=font)
    return canvas

def sheet(tiles, file):
    width, height = tiles[0].size
    canvas = Image.new("RGB", (width*2, height*((len(tiles)+1)//2)), "#152027")
    for i, item in enumerate(tiles):
        canvas.paste(item, ((i % 2)*width, (i // 2)*height))
    canvas.save(DEST / file, "WEBP", quality=91)

comparison = []
for name in names:
    b = next(f for f in before["frames"] if f["name"] == name and f["width"] == 1920)
    a = next(f for f in after["frames"] if f["name"] == name and f["width"] == 1920)
    assert b["progress"] == a["progress"] and b["height"] == a["height"]
    comparison.extend([
        tile(ARTIFACTS / "before" / ("1920-"+name+".png"), "BEFORE f67509e / "+name),
        tile(ARTIFACTS / "release-final" / ("1920-"+name+".png"), "AFTER "+after["sha"][:7]+" / "+name),
    ])
sheet(comparison, "before-after.webp")
for i, name in enumerate(names):
    sheet(comparison[i*2:i*2+2], "compare-"+name+".webp")
sheet([tile(ARTIFACTS / "release-final" / ("2560-"+name+".png"), "1440p / "+name) for name in names+["photo-mode"]], "alpine-1440-contact.webp")
for prefix, folder, width in [("before", "before", 1920), ("after", "release-final", 1920), ("after", "release-final", 2560)]:
    for name in names:
        Image.open(ARTIFACTS / folder / (str(width)+"-"+name+".png")).convert("RGB").save(DEST / (prefix+"-"+str(width)+"-"+name+".webp"), "WEBP", quality=92)
for name in ["threshold", "road-bike", "photo-mode"]:
    Image.open(ARTIFACTS / "release-final" / ("1920-"+name+".png")).convert("RGB").save(DEST / (name+".webp"), "WEBP", quality=92)

for folder, name, target in [
    ("before", "captures.json", "baseline-captures.json"),
    ("release-final", "captures.json", "alpine-captures.json"),
    ("production-release", "validation.json", "alpine-native.json"),
    ("forest-release", "validation.json", "forest-native.json"),
    ("performance-release", "performance.json", "performance.json"),
]:
    value = report(folder, name)
    if folder != "before":
        assert value["sha"] == after["sha"], (folder, "scene implementation mismatch")
    if name != "captures.json":
        assert value["passed"], folder
    shutil.copyfile(ARTIFACTS / folder / name, DEST / target)
privacy = json.loads((ARTIFACTS / "public-privacy.json").read_text(encoding="utf8"))
assert privacy["passed"]
shutil.copyfile(ARTIFACTS / "public-privacy.json", DEST / "public-privacy.json")
print("Packaged actual matched-route screenshots and validated reports:", DEST)
