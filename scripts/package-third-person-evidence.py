"""整理实际操作截图；只等比缩小并在画面外加标签，不重绘场景。"""
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
NATIVE = ROOT / "qa-artifacts/third-person/final-native-visible"
RIDE = ROOT / "qa-artifacts/third-person/final-stop-ride-verified"
OUT = ROOT / "docs/third-person-play/images"
native = json.loads((NATIVE / "validation.json").read_text(encoding="utf-8"))
ride = json.loads((RIDE / "journey.json").read_text(encoding="utf-8"))
assert native["passed"] and not native["errors"] and not native["uploads"]
assert len(native["checks"]) == 6
assert ride["passed"] and len(ride["checks"]) == 21
OUT.mkdir(parents=True, exist_ok=True)
font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 18)


def sheet(folder, selections, name, singles=False):
    # 全部源图来自公开素材测试上下文；原尺寸保存在忽略的 QA 目录。
    canvas = Image.new("RGB", (1920, 1144), "#101b20")
    draw = ImageDraw.Draw(canvas)
    for index, (filename, label) in enumerate(selections):
        frame = Image.open(folder / filename).convert("RGB")
        assert frame.width / frame.height == 16 / 9
        frame = frame.resize((960, 540), Image.Resampling.LANCZOS)
        x, y = index % 2 * 960, index // 2 * 572
        draw.text((x + 16, y + 6), label, fill="#d8e3e7", font=font)
        canvas.paste(frame, (x, y + 32))
        if singles:
            frame.save(OUT / filename.replace("1920-", "").replace(".png", ".webp"), quality=88, method=6)
    canvas.save(OUT / name, quality=88, method=6)
    print(OUT / name)


sheet(NATIVE, [
    ("1920-court-sprint-dribble.png", "Native sprint dribble / final build"),
    ("1920-court-dunk.png", "Native run-up dunk / original ball physics"),
    ("1920-cycling-third-detail-angle.png", "Forest ride / synchronized hands and cadence"),
    ("1920-alpine-ride-third-pedal.png", "Alpine ride / original measured terrain"),
], "overview.webp", singles=True)
sheet(RIDE, [
    ("08-lake-scenic-stop.png", "Full native ride / lake stop"),
    ("10-real-climb.png", "Full native ride / real positive grade"),
    ("13-gravity-descent.png", "Full native ride / gravity descent"),
    ("15-last-road-stop.png", "Full native ride / final stop"),
], "full-ride.webp")

# 停靠点比较另用准确的 668bbfc 快照；校验真实机位后才生成拼图。
stop_before = ROOT / "qa-artifacts/scenic-stops/before-aligned"
stop_after = ROOT / "qa-artifacts/scenic-stops/final-aligned"
before = json.loads((stop_before / "captures.json").read_text(encoding="utf-8"))
after = json.loads((stop_after / "captures.json").read_text(encoding="utf-8"))
assert before["passed"] and after["passed"] and not before["errors"] and not after["errors"]
assert len(before["frames"]) == len(after["frames"]) == 6
for a, b in zip(before["frames"], after["frames"]):
    assert (a["width"], a["index"]) == (b["width"], b["index"])
    assert math.dist(a["actual"]["position"], b["actual"]["position"]) < 1e-5
    q, r = a["actual"]["quaternion"], b["actual"]["quaternion"]
    dot = abs(sum(x*y for x, y in zip(q, r))) / math.sqrt(sum(x*x for x in q)*sum(x*x for x in r))
    assert 2*math.acos(min(1, dot)) < 2e-6
for width in [1920, 2560]:
    canvas = Image.new("RGB", (1920, 1716), "#101b20")
    draw = ImageDraw.Draw(canvas)
    for row in range(3):
        for col, (folder, label) in enumerate([(stop_before, "BEFORE 668bbfc"), (stop_after, "AFTER grounded scenic stop")]):
            frame = Image.open(folder / f"{width}-stop-{row}.png").convert("RGB").resize((960, 540), Image.Resampling.LANCZOS)
            draw.text((col*960+16, row*572+6), f"{label} / {width} / stop {row+1}", fill="#d8e3e7", font=font)
            canvas.paste(frame, (col*960, row*572+32))
    canvas.save(OUT / f"scenic-stops-{width}.webp", quality=88, method=6)
print("6 matched scenic-stop views verified")

# 总体球场对比使用最终表面修正的真实帧，避免把较早阶段的 AFTER 当作当前画面。
court_before = ROOT / "qa-artifacts/third-person/before"
court_after = ROOT / "qa-artifacts/surface-realism/final-aligned"
base = json.loads((court_before / "captures.json").read_text(encoding="utf-8"))
current = json.loads((court_after / "captures.json").read_text(encoding="utf-8"))
assert base["sha"] == "e9a3b43e17e659b5021d00eade3c9370673e7558"
assert current["passed"] and not current["errors"]
for width in [1920, 2560]:
    for name, current_name in [("entry", "court-wide"), ("hoop", "court-hoop")]:
        a = next(frame for frame in base["frames"] if frame["width"] == width and frame["name"] == name)
        b = next(frame for frame in current["frames"] if frame["width"] == width and frame["name"] == current_name)
        assert math.dist(a["view"]["position"], b["actual"]["position"]) < 1e-5
        q, r = a["view"]["quaternion"], b["actual"]["quaternion"]
        dot = abs(sum(x*y for x, y in zip(q, r))) / math.sqrt(sum(x*x for x in q)*sum(x*x for x in r))
        assert 2*math.acos(min(1, dot)) < 2e-6
        canvas = Image.new("RGB", (1920, 572), "#101b20")
        draw = ImageDraw.Draw(canvas)
        for col, (folder, frame, label) in enumerate([(court_before, a, "BEFORE e9a3b43"), (court_after, b, "AFTER final court surfaces")]):
            pixels = Image.open(folder / frame["file"]).convert("RGB").resize((960, 540), Image.Resampling.LANCZOS)
            draw.text((col*960+16, 6), f"{label} / {width} / {name}", fill="#d8e3e7", font=font)
            canvas.paste(pixels, (col*960, 32))
        canvas.save(OUT / f"matched-{name}-{width}.webp", quality=88, method=6)
print("4 final court views match the exact e9a3b43 reference")
