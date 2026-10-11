"""Package genuine neutral-context captures; never copy private profile / atlas frames."""
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
QA = ROOT / "qa-artifacts/personal-athlete"
OUT = ROOT / "docs/personal-athlete/images"
OUT.mkdir(parents=True, exist_ok=True)
font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 18)
before = json.loads((QA / "before/validation.json").read_text(encoding="utf-8"))
after = json.loads((QA / "after-final/validation.json").read_text(encoding="utf-8"))
assert before["sha"] == "c4a474e354d1220ceb070870f2afabc80c8599e2"
assert len(after["sha"]) == 40
for report in [before, after]:
    assert report["passed"] and not report["personal"] and not report["errors"] and not report["uploads"]
    assert report["quality"] == "medium" and report["dpr"] == 1


def put(canvas, folder, filename, col, row, label):
    pixels = Image.open(folder / filename).convert("RGB")
    assert pixels.width / pixels.height == 16 / 9
    pixels = pixels.resize((960, 540), Image.Resampling.LANCZOS)
    canvas.paste(pixels, (col * 960, row * 572 + 32))
    ImageDraw.Draw(canvas).text((col * 960 + 16, row * 572 + 6), label, font=font, fill="#d8e3e7")


for width in [1920, 2560]:
    canvas = Image.new("RGB", (1920, 1716), "#101b20")
    for row, name in enumerate(["court-rest", "cycling-entry", "alpine-ride-entry"]):
        file = f"{width}-{name}.png"
        a = next(f["state"] for f in before["frames"] if f["file"] == file)
        b = next(f["state"] for f in after["frames"] if f["file"] == file)
        assert math.dist(a["body"], b["body"]) < 1e-5
        q, r = a["quaternion"], b["quaternion"]
        dot = abs(sum(x * y for x, y in zip(q, r))) / math.sqrt(sum(x*x for x in q) * sum(x*x for x in r))
        assert 2 * math.acos(min(1, dot)) < 2e-6
        for col, (folder, label) in enumerate([("before", "BEFORE c4a474e"), ("after-final", "AFTER " + after["sha"][:7])]):
            put(canvas, QA / folder, file, col, row, f"{label} / {width} / {name} / medium")
    canvas.save(OUT / f"matched-rest-{width}.webp", quality=88, method=6)

# Moving frames show the native sequence; they are not presented as time-matched A/B captures.
canvas = Image.new("RGB", (1920, 1144), "#101b20")
for index, (filename, label) in enumerate([
    ("1920-jump-release.png", "Native timed release / current ball physics"),
    ("1920-layup-rise.png", "Native near-rim finish / phase varies during capture"),
    ("1920-cycling-pedal.png", "City posture / actual cadence"),
    ("1920-alpine-ride-pedal.png", "Road posture / original alpine route"),
]):
    put(canvas, QA / "after-final", filename, index % 2, index // 2, label)
canvas.save(OUT / "native-actions.webp", quality=88, method=6)

canvas = Image.new("RGB", (1920, 1144), "#101b20")
for index, (filename, label) in enumerate([
    ("1920-wardrobe-front.png", "Wardrobe / owned meshes / neutral public profile"),
    ("1920-wardrobe-训练.png", "Training blue / no private photos"),
    ("1920-wardrobe-日常.png", "Original cap / denim variation"),
    ("1920-wardrobe-林间.png", "Black outerwear / daypack variation"),
]):
    put(canvas, QA / "after-final", filename, index % 2, index // 2, label)
canvas.save(OUT / "wardrobe.webp", quality=88, method=6)
print("6 camera-matched resting views + native actions and public wardrobe packaged; private media excluded")
