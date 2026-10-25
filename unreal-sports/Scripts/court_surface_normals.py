"""原创微表面高度场：枫木细纹、拼缝和球皮凹凸；不读取人物素材。"""
from pathlib import Path
import numpy as np
from PIL import Image


def write_surface_normals(destination):
    destination = Path(destination)
    rng = np.random.default_rng(20261018)
    n = 1024
    y, x = np.mgrid[:n, :n]
    grain = np.sin(y * .9 + np.sin(x * .018) * 1.8) * .002
    grain += np.sin(y * .22 + x * .004) * .0014
    grain += (rng.random((n, n)) - .5) * .0007
    seam = np.exp(-np.square(np.minimum(y % 128, 128 - y % 128) / 1.4))
    wood_height = grain - .009 * seam
    write_normal(destination / 'CourtWoodNormal.png', wood_height, 180., 52.)
    y, x = np.mgrid[:512, :1024]
    lon, lat = x / 1024 * 2 * np.pi, (y / 511 - .5) * np.pi
    cx, cy, cz = np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)
    seam_distance = np.minimum.reduce([np.abs(cx), np.abs(cy), np.abs(cz), np.abs((cx + cz) * .71)])
    leather = (.012 * np.cos(x * np.pi / 3) * np.cos(y * np.pi / 3)
               - .06 * np.exp(-np.square(seam_distance / .018)))
    write_normal(destination / 'BallNormal.png', leather, 76., 38.)


def write_normal(path, height, width_cm, height_cm):
    dy, dx = np.gradient(height, height_cm / height.shape[0], width_cm / height.shape[1])
    vectors = np.stack([-dx, -dy, np.ones_like(dx)], axis=-1)
    vectors /= np.linalg.norm(vectors, axis=-1, keepdims=True)
    assert np.isfinite(vectors).all() and vectors[..., 2].min() > .5
    Image.fromarray(np.round((vectors * .5 + .5) * 255).astype('uint8')).save(path)


if __name__ == '__main__':
    write_surface_normals(Path(__file__).resolve().parents[1] / 'InputAssets')
