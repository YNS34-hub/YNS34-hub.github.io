"""复用原世界已署名的公开材质，保留源文件并校准 HDR 天空亮度。"""
from pathlib import Path
from PIL import Image
import numpy as np
import shutil, json, hashlib
ROOT=Path(__file__).resolve().parents[1]
ROAD=Path(r'C:\Users\86135\Documents\Codex\2026-10-04\the-memory-palace-stop-building-a\work\palace\public\media\road')
OUT=ROOT/'InputAssets'
# 原创的周期低频遮罩只打散远景重复，不改动任何公开源照片。
macro_y,macro_x=np.mgrid[0:256,0:256]/256
rng=np.random.default_rng(314159)
field=np.zeros((256,256))
for frequency in [1,2,3,5,8]:
    for _ in range(3):
        ax,ay=rng.integers(-frequency,frequency+1,size=2)
        field+=np.sin(2*np.pi*(ax*macro_x+ay*macro_y)+rng.uniform(0,2*np.pi))/frequency
field=(field-field.min())/(field.max()-field.min())
Image.fromarray(np.uint8(field*255),'L').save(OUT/'MacroVariation.png')
Image.open(ROAD/'sky-4k.webp').save(OUT/'SkyPhoto.png')
for original,name in {'asphalt.webp':'Asphalt','asphalt-normal.webp':'AsphaltNormal','meadow.webp':'Meadow','meadow-normal.webp':'MeadowNormal','ridge-rock.webp':'Rock','ridge-normal.webp':'RockNormal'}.items():
    Image.open(ROAD/original).save(OUT/(name+'.png'))
hdr=ROAD.parent/'alpine'/'clear-daylight-2k.hdr'
shutil.copy2(hdr,OUT/'SkyLighting.hdr')
with hdr.open('rb') as source:
    while source.readline().strip():pass
    resolution=source.readline().decode().strip().split();height=int(resolution[1]);width=int(resolution[3])
    pixels=np.zeros((height,width,4),dtype=np.uint8)
    for y in range(height):
        header=source.read(4)
        if header[:2]!=b'\x02\x02':raise ValueError('不支持的 HDR 扫描线编码')
        for channel in range(4):
            x=0
            while x<width:
                count=source.read(1)[0]
                if count>128:
                    count-=128;pixels[y,x:x+count,channel]=source.read(1)[0]
                else:pixels[y,x:x+count,channel]=np.frombuffer(source.read(count),dtype=np.uint8)
                x+=count
    rgb=pixels[:height//2,:,:3].astype(np.float64)*np.exp2(pixels[:height//2,:,3].astype(float)-136)[:,:,None]
    luminance=rgb@np.array([.2126,.7152,.0722]);median=float(np.median(luminance))
    multiplier=2000/max(median,.0001)
report={'source':'Original public CC0 Kloofendal 48d HDR','sha256':hashlib.sha256(hdr.read_bytes()).hexdigest(),'medianSkyRadiance':median,'intensityMultiplier':multiplier,'sourceModified':False}
(ROOT/'Reports/sky-calibration.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
