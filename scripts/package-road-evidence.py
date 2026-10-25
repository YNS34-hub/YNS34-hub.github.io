"""只整理真实浏览器截图与录像，不修改画面内容；需要 Pillow 和 ffmpeg。"""
import json
import math
import shutil
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]).resolve()
destination = root / "docs" / "road-cycling" / "evidence"
destination.mkdir(parents=True, exist_ok=True)
font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 19)
names = ["threshold", "road-bike", "stationary-cockpit", "forest-road", "woodland-s-curve", "climb", "crest", "first-lake-reveal", "lakeside-road", "high-meadow", "golden-valley", "descent", "waterline", "sunset-road", "scenic-stop", "photo-mode"]

def contact(files, target, columns=4):
    sheet = Image.new("RGB", (columns * 640, math.ceil(len(files) / columns) * 395), "#101d23")
    draw = ImageDraw.Draw(sheet)
    for i, (label, filename) in enumerate(files):
        image = Image.open(filename).convert("RGB")
        image.thumbnail((640, 360))
        x, y = (i % columns) * 640, (i // columns) * 395
        sheet.paste(image, (x, y))
        draw.text((x + 12, y + 370), label, font=font, fill="#dce7e9")
    sheet.save(target, quality=90)

for width in (1920, 2560):
    files = []
    for name in names:
        screenshot = source / "visual-final" / f"{width}-{name}.png"
        if not screenshot.exists():
            raise FileNotFoundError(screenshot)
        # 编码真实截图，保持完整构图、色彩与原分辨率；不生成或修饰建筑和地景。
        Image.open(screenshot).convert("RGB").save(destination / f"{width}-{name}.webp", quality=86)
        files.append((f"{width} / {name}", screenshot))
    contact(files, destination / f"{width}-contact.jpg")

contact([("Round one / 8eadf70 / forest", source / "before-8eadf70-forest.png"), ("Round two / forest / route geometry differs", source / "visual-final" / "1920-forest-road.png")], destination / "forest-before-after.jpg", 2)
journey = json.loads((source / "journey-three" / "journey.json").read_text(encoding="utf-8"))
assert journey.get("passed"), "完整原生旅程必须通过"
contact([(m["name"], source / "journey-three" / (m["name"] + ".png")) for m in journey["moments"]], destination / "native-journey-contact.jpg", 3)

video = source / "journey-three" / "continuous-native-ride.webm"
audio = source / "journey-three" / "actual-coast-pedal.webm"
times = {m["name"]: m["seconds"] for m in journey["moments"]}
offset = journey["videoOriginOffsetSeconds"]
# 只剪真实操作发生的时间段。有效存储位置的静态分镜不用于这份运动录像。
clips = [
    ("museum-to-nature", times["02-nature-threshold"] - 3.5, 7),
    ("mounting", times["03-approach-road-bike"] - .5, 4),
    ("acceleration", times["04-mounting-settled"] + .3, 7),
    ("cruise", times["05-acceleration-and-gear"] + 31, 7),
    ("shifting", times["06-coasting-freehub"] + .5, 6),
    ("actual-freehub", journey["audioStartSeconds"], 4),
    ("climbing", times["10-real-climb"] - 2, 7),
    ("crest-reveal", times["11-crest-reveal"] - 4, 8),
    ("gravity-descent", times["13-gravity-descent"] - 4, 8),
    ("braking", times["07-braking-settled"] - 5.5, 7),
    ("cornering", times["14-fast-cornering"] - 1.7, 6),
    ("scenic-stop", times["08-lake-scenic-stop"] - 4, 6),
    ("photo-mode", times["09-scenic-photo-view"] - .4, 4),
    ("museum-return", times["17-museum-return"] - 3.5, 6),
]
clip_directory = destination / "clips"
clip_directory.mkdir(exist_ok=True)
for name, start, duration in clips:
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", str(max(0, start + offset)), "-i", str(video)]
    if name == "actual-freehub":
        command += ["-i", str(audio), "-map", "0:v:0", "-map", "1:a:0", "-af", "apad", "-c:a", "aac", "-b:a", "128k"]
    else:
        command += ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-map", "0:v:0", "-map", "1:a:0", "-c:a", "aac", "-b:a", "32k"]
    command += ["-t", str(duration), "-vf", "fps=30", "-c:v", "libx264", "-threads", "2", "-preset", "fast", "-crf", "26", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(clip_directory / (name + ".mp4"))]
    subprocess.run(command, check=True)
    print("Clip:", name, flush=True)

list_file = source / "clips-concat.txt"
list_file.write_text("\n".join("file '" + str((clip_directory / (name + ".mp4")).resolve()).replace("\\", "/") + "'" for name, _, _ in clips), encoding="utf-8")
subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(list_file), "-c", "copy", "-movflags", "+faststart", str(destination / "native-motion.mp4")], check=True)
shutil.copyfile(audio, destination / "actual-freehub.webm")
(destination / "motion-index.json").write_text(json.dumps({"scope": "Native controls; all clips from the continuous journey, no injected distance. Only actual-freehub carries captured sound; other clips are silent. Source capture precedes the final grass/contrast-only refinement.", "sha": journey["sha"], "clips": [{"name": n, "sourceSeconds": max(0, s + offset), "duration": d} for n, s, d in clips]}, indent=2), encoding="utf-8")
print("Packaged original screenshots and 14 native motion clips.")
