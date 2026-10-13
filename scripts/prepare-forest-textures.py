"""Offline photo encoding. Takes already verified CC0 source images; no network or private media."""
from pathlib import Path
import argparse
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path)
parser.add_argument('--output', type=Path, default=Path('public/media/road/forest'))
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)

for asset, kinds in [('fir_tree_01', ['bark', 'twig']), ('pine_sapling_small', ['bark'])]:
    for kind in kinds:
        color = Image.open(args.source / f'{asset}-{kind}_diff.jpg').convert('RGB')
        normal = Image.open(args.source / f'{asset}-{kind}_nor_gl.jpg').convert('RGB')
        assert color.size == normal.size == (1024, 1024), 'Use real 1K sources, do not upscale'
        if kind == 'twig':
            # 原始照片与原 alpha 对齐；没有额外抠图、颜色变换或形态膨胀。
            alpha = Image.open(args.source / f'{asset}-{kind}_alpha.png').convert('L')
            assert alpha.size == color.size
            color = color.convert('RGBA')
            color.putalpha(alpha)
        color.save(args.output / f'{asset}-{kind}-color.webp', quality=95, method=6)
        normal.save(args.output / f'{asset}-{kind}-normal.webp', lossless=True, method=6)
