"""原创公园球场涂装：布局沿用现有篮圈物理坐标，不复制参考中的商标。"""
from pathlib import Path
import math
import random
from PIL import Image, ImageDraw

out = Path(__file__).resolve().parents[1] / "public/media/court"
out.mkdir(parents=True, exist_ok=True)
size = (2048, 3072)
im = Image.new("RGB", size, "#875f48")
draw = ImageDraw.Draw(im)
sx, sy = size[0] / 24, size[1] / 36
def xy(x, z): return ((x + 12) * sx, (z + 18) * sy)
def rect(x, z, w, d, fill, outline=None, width=1): draw.rectangle([xy(x,z),xy(x+w,z+d)], fill=fill, outline=outline, width=width)
def circle(x,z,r,outline,fill=None,width=5): draw.ellipse([xy(x-r,z-r),xy(x+r,z+r)],fill=fill,outline=outline,width=width)
rect(-7.5,-14,15,28,"#946d52")
rng=random.Random(927)
# 涂装围绕两个篮下观看区组织；边界留出呼吸空间，中心保留一个原创馆标。
for side in [-1,1]:
    for row in range(7):
        for col in range(9):
            x=(col-4)*1.62+rng.uniform(-.55,.55)
            z=side*(4.9+row*1.28)+rng.uniform(-.3,.3)
            rx,r=(.55+rng.random()*.4,.34+rng.random()*.43)
            if abs(x)+rx>7.42 or abs(z)+r>13.92:continue
            pts=[]
            for j in range(36):
                a=j/36*math.tau;v=1+.16*math.sin(a*3+row)+.11*math.cos(a*5+col)
                pts.append(xy(x+math.cos(a)*rx*v,z+math.sin(a)*r*v))
            draw.polygon(pts,fill=rng.choice(["#293237","#323b3e","#434944","#3c4542"]))
    # 保留原有 3.05m 篮圈与 12.1m 轴线；画线始终和物理目标同一坐标。
    circle(0,side*12.1,.34,"#e1d9bc",width=5)
    rect(-2.45,-14 if side<0 else 8.2,4.9,5.8,None,"#ede7d9",5)
    circle(0,side*8.2,1.8,"#ede7d9",width=5)
    box=[xy(-6.7,side*12.1-6.7),xy(6.7,side*12.1+6.7)]
    draw.arc(box,start=0 if side<0 else 180,end=180 if side<0 else 360,fill="#ede7d9",width=5)
    for x in [-6.7,6.7]:draw.line([xy(x,side*12.1),xy(x,side*14)],fill="#ede7d9",width=5)
rect(-7.5,-14,15,28,None,"#ede7d9",5)
draw.line([xy(-7.5,0),xy(7.5,0)],fill="#ede7d9",width=5)
circle(0,0,1.8,"#ede7d9","#3f4742",5)
# 两个折叠门轮廓属于 Memory Palace，而非 NBA 球队标志。
for offset in [-.52,.18]:
    draw.line([xy(offset-.4,.7),xy(offset-.4,-.65),xy(offset+.4,-.9),xy(offset+.4,.5),xy(offset-.4,.7)],fill="#bfa58b",width=8)
for i in range(1600):
    x=rng.uniform(-7.3,7.3);z=rng.uniform(-13.8,13.8);l=rng.uniform(.008,.13)
    draw.line([xy(x,z),xy(x+l,z+rng.uniform(-.035,.035))],fill="#9e8771",width=rng.choice([1,1,2]))
im.save(out/"painting.webp",quality=96)
print("Original 2048 x 3072 court painting prepared")
