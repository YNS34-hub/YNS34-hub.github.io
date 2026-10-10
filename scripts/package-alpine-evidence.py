"""打包空私人素材 fixture 的验收记录，不读取私人图库或参考视频。"""
import json
import os
import shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = Path(os.environ.get("PALACE_ARTIFACTS", ROOT.parents[1] / "outputs/scenic-realism"))
DEST = ROOT / "docs/alpine-ride/evidence"
DEST.mkdir(parents=True, exist_ok=True)
FINAL = ARTIFACTS / "release-final"

def report(folder, name="captures.json"):
    value = json.loads((ARTIFACTS / folder / name).read_text(encoding="utf8"))
    assert not value.get("errors"), (folder, value.get("errors"))
    assert not value.get("failure"), (folder, value.get("failure"))
    return value

before, after, alpine = report("before"), report("original-visuals"), report("release-final")
assert before["sha"].startswith("a1666d4")
assert after["sha"] == alpine["sha"]
assert len(alpine["frames"]) == 14
assert all(frame["actual"]["mounted"] == "true" for frame in alpine["frames"])

try:
    font = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 18)
except OSError:
    font = ImageFont.load_default()

def tile(file, label, width=640):
    # 对照图只等比缩小原截图，不重绘、修饰或裁掉界面。
    source = Image.open(file).convert("RGB")
    height = round(source.height * width / source.width)
    canvas = Image.new("RGB", (width, height + 34), "#152027")
    canvas.paste(source.resize((width, height), Image.Resampling.LANCZOS), (0, 34))
    ImageDraw.Draw(canvas).text((14, 5), label, fill="#e5edf0", font=font)
    return canvas

def sheet(tiles, file):
    width, height = tiles[0].size
    canvas = Image.new("RGB", (width * 2, height * ((len(tiles) + 1) // 2)), "#152027")
    for i, item in enumerate(tiles):
        canvas.paste(item, ((i % 2) * width, (i // 2) * height))
    canvas.save(DEST / file, "WEBP", quality=88)

tiles = []
for name in ["forest-road", "first-lake-reveal"]:
    b = next(f for f in before["frames"] if f["name"] == name)
    a = next(f for f in after["frames"] if f["name"] == name)
    assert b["progress"] == a["progress"] and b["width"] == a["width"]
    tiles.extend([
        tile(ARTIFACTS / "before" / ("1920-" + name + ".png"), "BASELINE a1666d4 / " + name),
        tile(ARTIFACTS / "original-visuals" / ("1920-" + name + ".png"), "PRESERVED " + after["sha"][:7] + " / " + name),
    ])
sheet(tiles, "forest-preservation.webp")
names = ["high-pass", "upper-corniche", "rock-cut", "high-overlook", "switchbacks", "lower-meadow", "arrival", "photo-mode"]
sheet([tile(FINAL / ("1920-" + name + ".png"), "ALPINE / " + name) for name in names], "alpine-contact.webp")
sheet([tile(FINAL / ("2560-" + name + ".png"), "1440p / " + name) for name in names], "alpine-1440-contact.webp")
for name in ["upper-corniche", "high-overlook", "switchbacks"]:
    Image.open(FINAL / ("1920-" + name + ".png")).convert("RGB").save(DEST / (name + ".webp"), "WEBP", quality=89)

for folder, name, target in [
    ("before", "captures.json", "baseline-captures.json"),
    ("original-visuals", "captures.json", "preserved-captures.json"),
    ("release-final", "captures.json", "alpine-captures.json"),
    ("production-native", "validation.json", "alpine-native.json"),
    ("original-production", "validation.json", "forest-native.json"),
    ("performance-final", "performance.json", "performance.json"),
]:
    value = report(folder, name)
    if name != "captures.json":
        assert value["passed"]
    shutil.copyfile(ARTIFACTS / folder / name, DEST / target)
shutil.copyfile(ARTIFACTS / "public-privacy.json", DEST / "public-privacy.json")
print("Packaged actual screenshots and validated reports:", DEST)
