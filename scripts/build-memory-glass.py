"""Offline Memory Palace sculpture: a closed sphere with two asymmetric natural bowls.

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
parser.add_argument('--resolution', type=int, default=176)
parser.add_argument('--triangles', type=int, default=40000)
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
axis = np.linspace(-1.85, 1.85, args.resolution, dtype=np.float32)
step = float(axis[1] - axis[0])
x, y, z = np.meshgrid(axis, axis, axis, indexing='ij', sparse=True)

def smooth_min(a, b, k):
    h = np.maximum(k - np.abs(a - b), 0) / k
    return np.minimum(a, b) - h * h * k * .25

# Two deliberately unequal front/rear bowls keep a near-spherical closed silhouette.
# Cutter centers sit inside the parent: the openings are narrower than their
# interior shoulders, producing actual overhangs rather than a height field.
cavities = [
    ((.28, .39, .87), .88, .73, 1.19),
    ((-.66, -.51, -.55), .61, .48, 1.28),
]
field = (np.sqrt(x*x + y*y + z*z) - 1.55).astype(np.float32)
cuts = []
for index, (direction, width, depth, center) in enumerate(cavities):
    n = np.array(direction, dtype=np.float32); n /= np.linalg.norm(n)
    e1 = np.cross(n, np.array([0., 1., 0.], dtype=np.float32)); e1 /= np.linalg.norm(e1)
    e2 = np.cross(n, e1)
    along = x*n[0] + y*n[1] + z*n[2]
    u = x*e1[0] + y*e1[1] + z*e1[2]
    v = x*e2[0] + y*e2[1] + z*e2[2]
    # Smooth local Cartesian warps, not high-frequency surface noise. Each
    # bowl has a subtly different oval shoulder and a drifting lip plane.
    aspect = float(1.34 + .17 * np.cos(index * 1.7))
    local_u = (u + .19*v*v/width) / aspect
    local_v = (v + .13*u*v/width) * aspect
    tangent = np.sqrt(local_u*local_u + local_v*local_v)
    lip_plane = 1.40 + .045*np.tanh(u/width) - .03*np.tanh(v/width)
    lip_thickness = .10 * (1 + .22*np.tanh(u/width) + .12*np.tanh(v/width))
    # Rounded lip volume has its own cross-section, independent of radial rays.
    lip = np.sqrt((tangent - width*.91)**2 + (along - lip_plane)**2) - lip_thickness
    # The cavity itself forms its lip; no toroidal rim is unioned into this sphere.
    # Reserve a continuous glass web between neighboring interior shoulders.
    cutter = (np.sqrt((tangent/(width*.93))**2 + ((along-center)/depth)**2) - 1) * depth
    cuts.append(cutter.astype(np.float32))
void = cuts[0]
for cutter in cuts[1:]:
    void = smooth_min(void, cutter, .025)
field = -smooth_min(-field, void, .105)
del cuts

vertices, faces, _, _ = marching_cubes(field, 0, spacing=(step,)*3, allow_degenerate=False)
vertices += axis[0]
mesh = trimesh.Trimesh(vertices, faces, process=True)
mesh.fix_normals()
trimesh.smoothing.filter_taubin(mesh, lamb=.45, nu=.5, iterations=10)
mesh = mesh.simplify_quadric_decimation(face_count=args.triangles)
mesh.fix_normals()
# Sample the implicit surface gradient for continuous optical normals instead
# of letting irregular decimation triangles introduce sparkle-shaped facets.
normal_field = gaussian_filter(field, 1.15)
coordinates = ((mesh.vertices - axis[0]) / step).T
normals = np.column_stack([map_coordinates(gradient, coordinates, order=1)
                           for gradient in np.gradient(normal_field, step)])
normals /= np.linalg.norm(normals, axis=1)[:, None]
mesh.vertex_normals = normals
assert mesh.is_watertight and mesh.is_winding_consistent and mesh.volume > 0
assert mesh.euler_number == 2, f'Keep a closed sphere topology without through-tunnels: Euler={mesh.euler_number}'
assert len(mesh.split()) == 1, 'The sculpture must remain one connected solid'
assert 30000 <= len(mesh.faces) <= 45000
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
out = root / 'public' / 'assets' / 'memory-glass.glb'
out.write_bytes(trimesh.exchange.gltf.export_glb(trimesh.Scene(mesh), include_normals=True))
report = {'generator': 'volumetric smooth CSG / marching cubes / Taubin / quadric decimation',
          'cavities': len(cavities), 'triangles': len(mesh.faces), 'vertices': len(mesh.vertices),
          'watertight': bool(mesh.is_watertight), 'volume': float(mesh.volume),
          'bounds': mesh.bounds.tolist(), 'undercutProof': undercut, 'bytes': out.stat().st_size}
(root/'public'/'assets'/'memory-glass.mesh.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
print(json.dumps(report))
