"""从仓库已有 swisstopo DEM 提取远景形态，重新布置于原创湖谷；并非该湖谷实测地形。"""
import json
from pathlib import Path
import numpy as np

root = Path(__file__).resolve().parents[1]
source = root / 'public/media/alpine'
meta = json.loads((source / 'geography.json').read_text())['massif']
dem = np.fromfile(source / 'massif-dem.bin', dtype='<i2').reshape(meta['height'], meta['width']).astype(float) * .5
windows = [(-8500, -6500, 6000, 4400), (-9500, -800, 5000, 4600),
           (2200, -4200, 5600, 6000), (-5200, 2200, 6000, 4400), (-2500, -6000, 8000, 4500)]
layers = []
for layer, (x, z, width, depth) in enumerate(windows):
    cols, rows = (112, 28) if layer == 4 else (180, 48)
    xx, zz = np.meshgrid(np.linspace(x, x + width, cols + 1), np.linspace(z, z + depth, rows + 1))
    gx = (xx - meta['x0']) / meta['step']; gz = (zz - meta['z0']) / meta['step']
    assert gx.min() >= 0 and gz.min() >= 0 and gx.max() < meta['width'] - 1 and gz.max() < meta['height'] - 1
    ix = gx.astype(int); iz = gz.astype(int); u = gx - ix; v = gz - iz
    a = (dem[iz, ix] * (1-u) + dem[iz, ix+1] * u) * (1-v) + (dem[iz+1, ix] * (1-u) + dem[iz+1, ix+1] * u) * v
    floor = float(np.percentile(a, 3)); span = float(a.max() - floor)
    levels = np.rint(np.clip((a-floor) / span, 0, 1) * 65535).astype(int)
    layers.append({'cols': cols, 'rows': rows, 'sourceWindow': [x, z, width, depth], 'levels': levels.ravel().tolist()})
    print('Ridge', layer, 'source altitude range', round(floor + 1500), round(a.max() + 1500), 'samples', levels.size)
out = root / 'public/media/road/ridge-samples.json'
out.write_text(json.dumps({'origin': 'Existing swissALTI3D massif DEM; © swisstopo. Extracted and compositionally rearranged, not a measured forest-valley location.', 'layers': layers}, separators=(',', ':')), encoding='utf-8')
