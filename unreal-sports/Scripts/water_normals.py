"""可复现、无方向棋盘的周期风浪法线；这是着色器数据，不使用照片或人物素材。"""
from pathlib import Path
import json
import numpy as np
from PIL import Image

def write_water_normal(destination):
    size = 512
    rng = np.random.default_rng(20261018)
    y, x = np.mgrid[0:size, 0:size] / size
    dx = np.zeros((size,size)); dy = np.zeros_like(dx)
    modes = set()
    while len(modes) < 128:
        kx, ky = (int(v) for v in rng.integers(-23,24,2))
        length = np.hypot(kx,ky)
        if 2 <= length <= 24:
            modes.add((kx,ky))
    for kx,ky in sorted(modes):
        length = np.hypot(kx,ky)
        phase = 2*np.pi*(kx*x+ky*y) + rng.uniform(0,2*np.pi)
        amplitude = length**-1.25 * rng.uniform(.6,1.4)
        wave = np.cos(phase)*amplitude
        dx += wave*kx/length; dy += wave*ky/length
    scale = .115 / np.sqrt(np.mean(dx*dx+dy*dy))
    normal = np.dstack((-dx*scale,-dy*scale,np.ones_like(dx)))
    normal /= np.linalg.norm(normal,axis=2,keepdims=True)
    assert np.isfinite(normal).all() and normal[:,:,2].min() > .88
    assert abs(np.corrcoef(normal[:,:,0].ravel(),normal[:,:,1].ravel())[0,1]) < .3
    Image.fromarray(np.round((normal*.5+.5)*255).astype(np.uint8)).save(destination)
    return {'size':size,'spectralComponents':len(modes),'seed':20261018,'slopeRms':.115,
            'method':'Periodic plane waves across varied directions, wavelengths and phases; no separable X/Y lattice'}

if __name__ == '__main__':
    root=Path(__file__).resolve().parents[1]
    report=write_water_normal(root/'InputAssets/WaterNormal.png')
    (root/'Reports/water-normal-generation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report))
