"""Offline volumetric sculpting. No radial displacement or browser mesh generation.

Run with Python and scripts/mesh-requirements.txt. Smooth CSG unions rounded
lip volumes with a solid sphere, then subtracts ellipsoidal cavity volumes.
The resulting closed solid has undercut lips and a substantial central core;
it needs no artificial solidify shell. Marching cubes, Taubin smoothing and
quadric decimation produce one indexed, smooth-normal GLB mesh.
"""
import argparse
import json
from pathlib import Path
import numpy as np
from scipy.ndimage import map_coordinates, gaussian_filter
from skimage.measure import marching_cubes
import trimesh

parser = argparse.ArgumentParser()
parser.add_argument('--resolution', type=int, default=192)
parser.add_argument('--triangles', type=int, default=80000)
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
axis = np.linspace(-1.85, 1.85, args.resolution, dtype=np.float32)
step = float(axis[1] - axis[0])
x, y, z = np.meshgrid(axis, axis, axis, indexing='ij', sparse=True)

def smooth_min(a, b, k):
    h = np.maximum(k - np.abs(a - b), 0) / k
    return np.minimum(a, b) - h * h * k * .25

# Three dominant front bowls and four quieter, unevenly spaced rear bowls.
# Cutter centers sit inside the parent: the openings are narrower than their
# interior shoulders, producing actual overhangs rather than a height field.
cavities = [
    ((.52, .45, .73), .74, .57, 1.22),
    ((-.69, .17, .70), .64, .55, 1.24),
    ((.10, -.72, .69), .69, .56, 1.23),
    ((.70, .35, -.62), .56, .49, 1.28),
    ((-.60, .65, -.47), .52, .47, 1.30),
    ((-.66, -.55, -.50), .57, .49, 1.28),
    ((.51, -.55, -.66), .54, .47, 1.29),
]
field = (np.sqrt(x*x + y*y + z*z) - 1.55).astype(np.float32)
cuts = []
for direction, width, depth, center in cavities:
    n = np.array(direction, dtype=np.float32); n /= np.linalg.norm(n)
    along = x*n[0] + y*n[1] + z*n[2]
    tangent = np.sqrt(np.maximum(x*x + y*y + z*z - along*along, 0))
    # Rounded lip volume has its own cross-section, independent of radial rays.
    lip = np.sqrt((tangent - width*.91)**2 + (along - 1.40)**2) - .095
    field = smooth_min(field, lip, .105)
    cutter = (np.sqrt((tangent/width)**2 + ((along-center)/depth)**2) - 1) * depth
    cuts.append(cutter.astype(np.float32))
for cutter in cuts:
    field = -smooth_min(-field, cutter, .105)
del cuts

vertices, faces, _, _ = marching_cubes(field, 0, spacing=(step,)*3, allow_degenerate=False)
vertices += axis[0]
mesh = trimesh.Trimesh(vertices, faces, process=True)
mesh.fix_normals()
trimesh.smoothing.filter_taubin(mesh, lamb=.45, nu=.5, iterations=6)
mesh = mesh.simplify_quadric_decimation(face_count=args.triangles)
mesh.fix_normals()
# Sample the implicit surface gradient for continuous optical normals instead
# of letting irregular decimation triangles introduce sparkle-shaped facets.
normal_field = gaussian_filter(field, .85)
coordinates = ((mesh.vertices - axis[0]) / step).T
normals = np.column_stack([map_coordinates(gradient, coordinates, order=1)
                           for gradient in np.gradient(normal_field, step)])
normals /= np.linalg.norm(normals, axis=1)[:, None]
mesh.vertex_normals = normals
assert mesh.is_watertight and mesh.is_winding_consistent and mesh.volume > 0
assert len(mesh.split()) == 1, 'The sculpture must remain one connected solid'
assert 50000 <= len(mesh.faces) <= 100000
assert np.isfinite(mesh.vertex_normals).all()

# Verify a volumetric feature impossible for a sphere height field: three
# positive intersections on a ray from the center (exit, undercut lip, exit).
rng = np.random.default_rng(710)
directions = rng.normal(size=(6000, 3)); directions /= np.linalg.norm(directions, axis=1)[:, None]
radii = np.linspace(.02, 1.8, 260)
points = directions[:, :, None] * radii[None, None, :]
sampled = map_coordinates(field, ((points - axis[0])/step).transpose(1, 0, 2), order=1)
crossings = np.count_nonzero(np.diff(sampled < 0, axis=1), axis=1)
candidates = directions[crossings >= 3]

def intersections(direction):
    tri = mesh.triangles
    e1, e2 = tri[:, 1]-tri[:, 0], tri[:, 2]-tri[:, 0]
    h = np.cross(np.broadcast_to(direction, e2.shape), e2)
    determinant = np.einsum('ij,ij->i', e1, h)
    valid = np.abs(determinant) > 1e-9
    inv = np.zeros_like(determinant); inv[valid] = 1/determinant[valid]
    s = -tri[:, 0]
    u = inv * np.einsum('ij,ij->i', s, h)
    q = np.cross(s, e1)
    v = inv * (q @ direction)
    t = inv * np.einsum('ij,ij->i', e2, q)
    hits = np.sort(t[valid & (u >= 0) & (v >= 0) & (u+v <= 1) & (t > 0)])
    return hits[np.r_[True, np.diff(hits) > 1e-5]].tolist() if len(hits) else []

undercut = None
for direction in candidates[:120]:
    hits = intersections(direction)
    if len(hits) >= 3:
        undercut = {'direction': direction.tolist(), 'distances': hits}; break
assert undercut, 'Exported mesh must contain genuine non-radial undercut geometry'
mesh.metadata['name'] = 'Volumetric nonlinear glass sculpture'
out = root / 'assets' / 'nonlinear-glass.glb'
out.write_bytes(trimesh.exchange.gltf.export_glb(trimesh.Scene(mesh), include_normals=True))
report = {'generator': 'volumetric smooth CSG / marching cubes / Taubin / quadric decimation',
          'cavities': len(cavities), 'triangles': len(mesh.faces), 'vertices': len(mesh.vertices),
          'watertight': bool(mesh.is_watertight), 'volume': float(mesh.volume),
          'bounds': mesh.bounds.tolist(), 'undercutProof': undercut, 'bytes': out.stat().st_size}
(root/'assets'/'nonlinear-glass.mesh.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
print(json.dumps(report))
