"""仅等比缩小真实截图，并在画面外加标签；不修改场景像素。"""
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
BEFORE = ROOT / "qa-artifacts/surface-realism/before-aligned"
AFTER = ROOT / "qa-artifacts/surface-realism/final-aligned"
OUT = ROOT / "docs/third-person-play/images"
OUT.mkdir(parents=True, exist_ok=True)
before = json.loads((BEFORE / "captures.json").read_text(encoding="utf-8"))
after = json.loads((AFTER / "captures.json").read_text(encoding="utf-8"))
assert before["passed"] and after["passed"]
assert len(before["frames"]) == len(after["frames"]) == 16
for a, b in zip(before["frames"], after["frames"]):
    assert (a["name"], a["width"]) == (b["name"], b["width"])
    assert math.dist(a["actual"]["position"], b["actual"]["position"]) < 1e-5
    q, r = a["actual"]["quaternion"], b["actual"]["quaternion"]
    dot = abs(sum(x*y for x, y in zip(q, r))) / math.sqrt(sum(x*x for x in q)*sum(x*x for x in r))
    assert 2*math.acos(min(1, dot)) < 2e-6
font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 18)
groups = {"court": ["court-wide", "court-surface", "court-hoop", "court-night"],
          "rides": ["cycling-wide", "cycling-shoulder", "alpine-ride-wide", "alpine-ride-shoulder"]}
for width in [1920, 2560]:
    for group, names in groups.items():
        sheet = Image.new("RGB", (1920, 572*len(names)), "#101b20")
        draw = ImageDraw.Draw(sheet)
        for row, name in enumerate(names):
            for col, (folder, label) in enumerate([(BEFORE, "BEFORE d542f14"), (AFTER, "AFTER bounded surface detail")]):
                frame = Image.open(folder / f"{width}-{name}.png").convert("RGB")
                frame = frame.resize((960, 540), Image.Resampling.LANCZOS)
                draw.text((col*960+16, row*572+6), f"{label} / {width} / {name}", fill="#d8e3e7", font=font)
                sheet.paste(frame, (col*960, row*572+32))
        file = OUT / f"surface-{group}-{width}.webp"
        sheet.save(file, quality=88, method=6)
        print(file)
print("16 matched camera positions/orientations verified")
