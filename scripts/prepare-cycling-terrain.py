"""将现有 CC0 地表照片生成森林远景用的 1K 派生图，不改色、不新增来源。"""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
for source, target in [('rock-color', 'ridge-rock'), ('rock-normal', 'ridge-normal'),
                       ('meadow-color', 'meadow'), ('meadow-normal', 'meadow-normal')]:
    with Image.open(root / f'public/media/alpine/{source}.webp') as image:
        image.convert('RGB').resize((1024, 1024), Image.Resampling.LANCZOS).save(
            root / f'public/media/road/{target}.webp', 'WEBP', quality=94, method=6)
    print(target + ': 1024 x 1024, original retained')
