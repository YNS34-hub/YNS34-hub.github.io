"""复用仓库已许可的天空摄影，仅生成受限的运行时分辨率，不改变色彩。"""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / 'public/media/alpine/clear-sky-8k.webp'
output = root / 'public/media/road/sky-4k.webp'
with Image.open(source) as image:
    assert image.size == (8192, 4096)
    image.convert('RGB').resize((4096, 2048), Image.Resampling.LANCZOS).save(output, 'WEBP', quality=92, method=6)
print('Shared CC0 sky derivative: 4096 x 2048; original retained')
