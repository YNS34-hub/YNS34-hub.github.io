"""由已许可的真实高程预计算远山遮光；不增加实时阴影相机。"""
import json
import math
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "public/media/alpine"
meta = json.loads((DEST / "geography.json").read_text(encoding="utf8"))
field = meta["massif"]
source = np.fromfile(DEST / "massif-dem.bin", dtype="<i2").reshape(field["height"], field["width"]) * .5
# 20 米遮光网格；近处物体接触阴影仍使用原来的 2048 阴影贴图。
terrain = source[::2, ::2]
height, width = terrain.shape
step = field["step"] * 2
sun = [-100, 95, 90]
horizontal = math.hypot(sun[0], sun[2])
dx, dz, rise = sun[0]/horizontal, sun[2]/horizontal, sun[1]/horizontal
z, x = np.mgrid[:height, :width].astype(np.float32)
occlusion = np.full_like(terrain, -10.)
# 使用实际山坡的地平线，越过数据边界后不凭空生成遮挡山体。
for distance in range(20, 3001, 20):
    u, v = x+dx*distance/step, z+dz*distance/step
    valid = (u >= 0) & (u < width-1) & (v >= 0) & (v < height-1)
    u, v = np.clip(u, 0, width-1.001), np.clip(v, 0, height-1.001)
    i, j = u.astype(np.int32), v.astype(np.int32)
    a, b = u-i, v-j
    ahead = (terrain[j, i]*(1-a)+terrain[j, i+1]*a)*(1-b)+(terrain[j+1, i]*(1-a)+terrain[j+1, i+1]*a)*b
    depth = ahead-terrain-distance*rise-1.5
    np.maximum(occlusion, np.where(valid, depth, -10), out=occlusion)
# 有限的边缘软化，仅作用于直射光；天空与反射照明保持独立。
t = np.clip((occlusion+2)/4, 0, 1)
visibility = 1-t*t*(3-2*t)
image = Image.fromarray(np.rint(visibility*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(.55))
image.save(DEST / "terrain-sun.webp", "WEBP", lossless=True)
meta["sun"] = {"x0": field["x0"], "z0": field["z0"], "step": step, "width": width, "height": height, "direction": sun, "rayDistance": 3000}
(DEST / "geography.json").write_text(json.dumps(meta, separators=(",", ":")), encoding="utf8")
print({"sunGrid": [width, height], "occludedPercent": round(float(np.mean(visibility < .5))*100, 2)}, flush=True)
