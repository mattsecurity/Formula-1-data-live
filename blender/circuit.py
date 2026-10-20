"""Build a real-time circuit model (glTF) from blender/<id>.json (see osm_prep.py).

    blender -b --factory-startup --python blender/circuit.py -- blender/monza.json public/models/circuits/monza.glb

Everything is modelled flat (z = 0) in metres, X east / Y north. The app aligns
the model to the session telemetry and drapes it over the real elevation, so:
  * meshes whose name starts with "D_" are deformed per vertex,
  * every other mesh is lifted as a whole,
  * the lap centerline is stored in the extras of the "Circuit" empty.
"""
import json
import math
import sys

import bpy
import numpy as np

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SRC = argv[0] if argv else 'blender/monza.json'
OUT = argv[1] if len(argv) > 1 else 'public/models/circuits/monza.glb'
D = json.load(open(SRC))
rng = np.random.default_rng(7)

HALF_W = 7.0  # asphalt half width (matches the app)
SHOULDER = 2.6  # paved strip beyond the white line / kerb

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
root = bpy.data.objects.new('Circuit', None)
scene.collection.objects.link(root)


# ------------------------------------------------------------------ geometry utils
def closed_catmull(pts, step):
    """Centripetal Catmull-Rom through a closed polyline, resampled every `step` m."""
    p = np.asarray(pts, float)
    n = len(p)
    dense = []
    for i in range(n):
        p0, p1, p2, p3 = p[(i - 1) % n], p[i], p[(i + 1) % n], p[(i + 2) % n]
        t0 = 0.0
        t1 = t0 + max(np.linalg.norm(p1 - p0), 1e-3) ** 0.5
        t2 = t1 + max(np.linalg.norm(p2 - p1), 1e-3) ** 0.5
        t3 = t2 + max(np.linalg.norm(p3 - p2), 1e-3) ** 0.5
        k = max(2, int(np.linalg.norm(p2 - p1) / 1.0))
        for t in np.linspace(t1, t2, k, endpoint=False):
            a1 = (t1 - t) / (t1 - t0) * p0 + (t - t0) / (t1 - t0) * p1
            a2 = (t2 - t) / (t2 - t1) * p1 + (t - t1) / (t2 - t1) * p2
            a3 = (t3 - t) / (t3 - t2) * p2 + (t - t2) / (t3 - t2) * p3
            b1 = (t2 - t) / (t2 - t0) * a1 + (t - t0) / (t2 - t0) * a2
            b2 = (t3 - t) / (t3 - t1) * a2 + (t - t1) / (t3 - t1) * a3
            dense.append((t2 - t) / (t2 - t1) * b1 + (t - t1) / (t2 - t1) * b2)
    return resample(np.array(dense), step, closed=True)


def resample(p, step, closed):
    q = np.vstack([p, p[:1]]) if closed else p
    seg = np.linalg.norm(np.diff(q, axis=0), axis=1)
    cum = np.concatenate([[0], np.cumsum(seg)])
    L = cum[-1]
    m = max(2, int(round(L / step)))
    s = np.linspace(0, L, m, endpoint=not closed)
    return np.stack([np.interp(s, cum, q[:, 0]), np.interp(s, cum, q[:, 1])], 1)


def frames(p, closed=True, span=3):
    n = len(p)
    if closed:
        d = np.roll(p, -span, 0) - np.roll(p, span, 0)
    else:
        d = np.gradient(p, axis=0)
    t = d / np.maximum(np.linalg.norm(d, axis=1, keepdims=True), 1e-9)
    nrm = np.stack([-t[:, 1], t[:, 0]], 1)  # left normal
    return t, nrm


def curvature(p, span):
    a = np.roll(p, span, 0)
    c = np.roll(p, -span, 0)
    u = p - a
    v = c - p
    cross = u[:, 0] * v[:, 1] - u[:, 1] * v[:, 0]
    den = np.linalg.norm(u, axis=1) * np.linalg.norm(v, axis=1) * np.linalg.norm(c - a, axis=1)
    return 2 * cross / np.maximum(den, 1e-9)  # signed: + turns left


def smooth_closed(x, r):
    k = np.ones(2 * r + 1) / (2 * r + 1)
    return np.convolve(np.concatenate([x[-r:], x, x[:r]]), k, 'valid')


def in_poly(pts, poly):
    """Even-odd point in polygon, vectorised over pts."""
    x, y = pts[:, 0], pts[:, 1]
    px, py = poly[:, 0], poly[:, 1]
    inside = np.zeros(len(pts), bool)
    j = len(poly) - 1
    for i in range(len(poly)):
        cond = ((py[i] > y) != (py[j] > y)) & (x < (px[j] - px[i]) * (y - py[i]) / (py[j] - py[i] + 1e-12) + px[i])
        inside ^= cond
        j = i
    return inside


class Near:
    """Nearest-distance queries against a dense point set via a uniform grid."""

    def __init__(self, pts, cell=20.0):
        self.p = np.asarray(pts, float)
        self.cell = cell
        self.g = {}
        for i, (x, y) in enumerate(self.p):
            self.g.setdefault((int(x // cell), int(y // cell)), []).append(i)

    def dist(self, q, rmax=200.0):
        q = np.asarray(q, float)
        out = np.full(len(q), rmax)
        r = int(math.ceil(rmax / self.cell))
        for k, (x, y) in enumerate(q):
            cx, cy = int(x // self.cell), int(y // self.cell)
            best = rmax * rmax
            for ring in range(r + 1):
                found = False
                for gx in range(cx - ring, cx + ring + 1):
                    for gy in range(cy - ring, cy + ring + 1):
                        if max(abs(gx - cx), abs(gy - cy)) != ring:
                            continue
                        for i in self.g.get((gx, gy), ()):
                            d = (self.p[i, 0] - x) ** 2 + (self.p[i, 1] - y) ** 2
                            if d < best:
                                best = d
                                found = True
                if found and math.sqrt(best) < ring * self.cell:
                    break
            out[k] = math.sqrt(best)
        return out


# ------------------------------------------------------------------ textures & materials
def image(name, arr):
    """arr: HxWx4 float in 0..1 (row 0 = bottom)."""
    h, w = arr.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=True)
    img.pixels.foreach_set(np.ascontiguousarray(arr, np.float32).ravel())
    img.filepath_raw = f'//{name}.png'
    img.file_format = 'PNG'
    img.pack()
    return img


def noise(h, w, scales, seed):
    r = np.random.default_rng(seed)
    acc = np.zeros((h, w))
    for s, amp in scales:
        g = r.random((max(2, h // s), max(2, w // s)))
        # tileable bilinear upsample
        gy = np.linspace(0, g.shape[0], h, endpoint=False)
        gx = np.linspace(0, g.shape[1], w, endpoint=False)
        y0 = gy.astype(int) % g.shape[0]
        x0 = gx.astype(int) % g.shape[1]
        y1 = (y0 + 1) % g.shape[0]
        x1 = (x0 + 1) % g.shape[1]
        fy = (gy - gy.astype(int))[:, None]
        fx = (gx - gx.astype(int))[None, :]
        fy = fy * fy * (3 - 2 * fy)
        fx = fx * fx * (3 - 2 * fx)
        v = (g[y0][:, x0] * (1 - fx) + g[y0][:, x1] * fx) * (1 - fy) + (g[y1][:, x0] * (1 - fx) + g[y1][:, x1] * fx) * fy
        acc += v * amp
    return acc / sum(a for _, a in scales)


def rgba(base, n, var):
    c = np.asarray(base, float)[None, None, :] * (1 - var + 2 * var * n[..., None])
    return np.concatenate([np.clip(c, 0, 1), np.ones(n.shape + (1,))], 2)


def hexc(h):
    """sRGB 0..1 (image pixels are stored as display values)."""
    return [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]


def srgb(h):
    """Linear 0..1 (material factors, vertex colours)."""
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


def material(name, color=None, img=None, rough=0.8, metal=0.0, alpha_clip=False, double=False, vcol=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if color is not None:
        bsdf.inputs['Base Color'].default_value = (*color, 1)
    src = None
    if img is not None:
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = img
        src = tex.outputs['Color']
        if alpha_clip:
            rnd = nt.nodes.new('ShaderNodeMath')
            rnd.operation = 'ROUND'
            nt.links.new(tex.outputs['Alpha'], rnd.inputs[0])
            nt.links.new(rnd.outputs[0], bsdf.inputs['Alpha'])
    if vcol:
        attr = nt.nodes.new('ShaderNodeVertexColor')
        attr.layer_name = 'Color'
        if src is not None:
            mul = nt.nodes.new('ShaderNodeMix')
            mul.data_type = 'RGBA'
            mul.blend_type = 'MULTIPLY'
            mul.inputs['Factor'].default_value = 1.0
            nt.links.new(src, mul.inputs[6])
            nt.links.new(attr.outputs['Color'], mul.inputs[7])
            src = mul.outputs[2]
        else:
            src = attr.outputs['Color']
    if src is not None:
        nt.links.new(src, bsdf.inputs['Base Color'])
    m.use_backface_culling = not double
    return m


S = 512
n1 = noise(S, S, [(4, 1), (16, 0.6), (64, 0.4)], 1)
r2 = np.random.default_rng(2).random((S, S))
speck = (r2 > 0.97) * 0.3 - (r2 < 0.03) * 0.3
asph = rgba(hexc('#5f5f65'), np.clip(n1 + speck, 0, 1), 0.24)
# white lines baked at both edges (u = 0 is the left edge, 14 m wide → 36.6 px/m)
ppm = S / (2 * HALF_W)
for a, b in [(0.12, 0.62), (2 * HALF_W - 0.62, 2 * HALF_W - 0.12)]:
    asph[:, int(a * ppm):int(b * ppm), :3] = 0.86 * (0.94 + 0.06 * n1[:, int(a * ppm):int(b * ppm), None])
# darker racing line rubber in the middle third
u = np.linspace(0, 1, S)
rubber = np.exp(-((u - 0.5) / 0.16) ** 2) * 0.15
asph[:, :, :3] *= (1 - rubber)[None, :, None]
MAT_ASPH = material('Asphalt', img=image('asphalt', asph), rough=0.92)
MAT_PLAIN = material('Shoulder', img=image('shoulder', rgba(hexc('#6c6c72'), n1, 0.2)), rough=0.95)
MAT_PIT = material('PitLane', img=image('pitlane', rgba(hexc('#74747a'), n1, 0.16)), rough=0.9)
MAT_ROAD = material('Road', img=image('road', rgba(hexc('#57575c'), n1, 0.2)), rough=0.95)

kerb = np.ones((128, 32, 4))
kerb[64:, :, :3] = hexc('#d6170c')
kerb[:64, :, :3] = hexc('#efefef')
kerb[:, :, :3] *= (0.9 + 0.1 * noise(128, 32, [(4, 1)], 3))[..., None]
MAT_KERB = material('Kerb', img=image('kerb', kerb), rough=0.55)

gn = noise(S, S, [(2, 0.8), (8, 1), (32, 0.6), (128, 0.5)], 4)
# neutral detail texture; the hue comes from the vertex colours (land use)
MAT_GROUND = material('Grass', img=image('grass', rgba([1.0, 1.0, 1.0], gn, 0.22)), rough=1.0, vcol=True)
gv = noise(256, 256, [(1, 1), (3, 0.6), (16, 0.3)], 5)
MAT_GRAVEL = material('Gravel', img=image('gravel', rgba(hexc('#b89f74'), gv, 0.18)), rough=1.0)

rails = np.ones((64, 16, 4))
rails[:, :, :3] = 0.55
for r0 in (6, 26, 46):
    rails[r0:r0 + 12, :, :3] = 0.82
MAT_ARMCO = material('Armco', img=image('armco', rails), rough=0.35, metal=0.8, double=True)
fence = np.zeros((64, 64, 4))
fence[:, :, :3] = 0.6
yy, xx = np.mgrid[0:64, 0:64]
mesh = ((xx + yy) % 16 < 2) | ((xx - yy) % 16 < 2)
fence[..., 3] = mesh.astype(float)
fence[:, 30:34, 3] = 1  # posts
MAT_FENCE = material('Fence', img=image('fence', fence), rough=0.4, metal=0.7, alpha_clip=True, double=True)
MAT_WALL = material('Concrete', img=image('concrete', rgba(hexc('#b7b5ad'), n1, 0.12)), rough=0.85)

seats = np.ones((64, 64, 4))
seats[:, :, :3] = hexc('#1f4fa8')
for r0 in range(0, 64, 16):
    seats[r0:r0 + 4, :, :3] = hexc('#9a9aa0')  # concrete step between rows
MAT_SEATS = material('Seats', img=image('seats', seats), rough=0.6)
MAT_ROOF = material('Roof', color=srgb('#d9d9de'), rough=0.6, metal=0.2)

win = np.ones((64, 64, 4))
win[:, :, :3] = hexc('#d8d2c4')
win[18:50, 10:54, :3] = hexc('#3b4654')
MAT_FACADE = [
    material('Facade', img=image('facade', win), rough=0.7),
    material('FacadeBrick', img=image('facade_b', win * np.array([1.0, 0.82, 0.68, 1])), rough=0.8),
    material('FacadeGrey', img=image('facade_g', win * np.array([0.82, 0.84, 0.88, 1])), rough=0.7),
]
MAT_TRUNK = material('Trunk', color=srgb('#4a3424'), rough=1.0)
MAT_LEAVES = [material(f'Leaves{i}', color=srgb(c), rough=0.95) for i, c in enumerate(['#3e6b2a', '#2f5a24', '#557d33'])]


# ------------------------------------------------------------------ mesh helper
def build(name, verts, faces, uvs=None, mat=None, cols=None, parent=None):
    me = bpy.data.meshes.new(name)
    v = np.asarray(verts, float)
    if v.shape[1] == 2:
        v = np.concatenate([v, np.zeros((len(v), 1))], 1)
    me.from_pydata(v.tolist(), [], [list(f) for f in faces])
    if uvs is not None:
        uv = me.uv_layers.new(name='UVMap')
        loops = np.zeros(len(me.loops), int)
        me.loops.foreach_get('vertex_index', loops)
        uv.data.foreach_set('uv', np.asarray(uvs, np.float32)[loops].ravel())
    if cols is not None:
        ca = me.color_attributes.new('Color', 'FLOAT_COLOR', 'POINT')
        ca.data.foreach_set('color', np.asarray(cols, np.float32).ravel())
    if mat is not None:
        me.materials.append(mat)
    me.validate()
    me.update()
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    ob.parent = parent or root
    return ob


def strip(name, left, right, vl, vr, ul=0.0, ur=1.0, mat=None, closed=False, z=(0, 0)):
    """Quad strip between two polylines. vl/vr: v coordinate per row."""
    n = len(left)
    verts = np.zeros((2 * n, 3))
    verts[0::2, :2] = left
    verts[1::2, :2] = right
    verts[0::2, 2] = z[0]
    verts[1::2, 2] = z[1]
    uvs = np.zeros((2 * n, 2))
    uvs[0::2] = np.stack([np.full(n, ul), vl], 1)
    uvs[1::2] = np.stack([np.full(n, ur), vr], 1)
    faces = [(2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2) for i in range(n - 1)]
    if closed:
        faces.append((2 * n - 2, 2 * n - 1, 1, 0))
    return build(name, verts, faces, uvs, mat)


def wall(name, line, h0, h1, mat, vscale, closed=False):
    n = len(line)
    s = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(line, axis=0), axis=1))])
    verts = np.zeros((2 * n, 3))
    verts[0::2, :2] = line
    verts[1::2, :2] = line
    verts[0::2, 2] = h0
    verts[1::2, 2] = h1
    uvs = np.zeros((2 * n, 2))
    uvs[0::2, 0] = s / vscale
    uvs[1::2, 0] = s / vscale
    uvs[0::2, 1] = 0
    uvs[1::2, 1] = 1
    faces = [(2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1) for i in range(n - 1)]
    return build(name, verts, faces, uvs, mat)


def runs(mask):
    """Index runs [a, b) of True values in a boolean array (non-cyclic)."""
    out = []
    i = 0
    n = len(mask)
    while i < n:
        if mask[i]:
            j = i
            while j < n and mask[j]:
                j += 1
            out.append((i, j))
            i = j
        else:
            i += 1
    return out


# ------------------------------------------------------------------ the lap
lap = closed_catmull(D['lap'], 2.0)
N = len(lap)
tan, nor = frames(lap)
s_lap = np.arange(N) * 2.0
kap = smooth_closed(curvature(lap, 6), 4)
print(f'lap: {N} samples, {N * 2.0:.0f} m')
lap_near = Near(lap, 20)

# centerline for the app (every 8 m), racing direction, starting where the data starts
cl = lap[::4]
root['centerline'] = [round(float(v), 2) for v in cl.ravel()]
root['halfWidth'] = HALF_W

left = lap + nor * HALF_W
right = lap - nor * HALF_W
strip('D_Asphalt', left, right, s_lap / (2 * HALF_W), s_lap / (2 * HALF_W), 0, 1, MAT_ASPH, closed=True)

# kerbs: inside of every corner tighter than ~230 m, both sides of chicanes
R = 1 / np.maximum(np.abs(kap), 1e-6)
kerb_mask = {+1: np.zeros(N, bool), -1: np.zeros(N, bool)}
for side in (+1, -1):
    inner = (R < 230) & (np.sign(kap) == side)
    chic = R < 70
    m = inner | chic
    # grow by ~10 m each way
    grown = m.copy()
    for k in range(1, 6):
        grown |= np.roll(m, k) | np.roll(m, -k)
    kerb_mask[side] = grown
for side in (+1, -1):
    m = kerb_mask[side]
    # rotate so runs never wrap
    off = int(np.argmin(m)) if m.any() and not m.all() else 0
    mm = np.roll(m, -off)
    for a, b in runs(mm):
        idx = (np.arange(a, b + 1) + off) % N
        if len(idx) < 4:
            continue
        p0 = lap[idx] + nor[idx] * side * HALF_W
        p1 = lap[idx] + nor[idx] * side * (HALF_W + 1.6)
        v = s_lap[idx] / 3.0 if idx[-1] > idx[0] else (np.arange(len(idx)) * 2.0 + s_lap[idx[0]]) / 3.0
        ob = strip(f'D_Kerb_{side}_{a}', p0, p1, v, v, 0, 1, MAT_KERB, z=(0.0, 0.0))
        # small raise of the inner edge so it reads at grazing angles
        me = ob.data
        for i, vv in enumerate(me.vertices):
            vv.co.z = 0.05 if i % 2 == 1 else 0.02

# paved shoulder beyond the line (or the kerb)
for side in (+1, -1):
    w0 = HALF_W + np.where(kerb_mask[side], 1.6, 0.0)
    w0 = smooth_closed(w0, 2)
    p0 = lap + nor * side * w0[:, None]
    p1 = lap + nor * side * (w0 + SHOULDER)[:, None]
    strip(f'D_Shoulder_{side}', p0, p1, s_lap / 8, s_lap / 8, 0, 0.3, MAT_PLAIN, closed=True)

# grass verge beyond the shoulder: follows the track elevation exactly (fine sampling) and slopes
# down into the coarse ground grid, which the app sinks below it near the track
MAT_VERGE = material('Verge', img=image('verge', rgba(hexc('#5f8d3b'), gn, 0.2)), rough=1.0)
VERGE_OFF = [0.0, 7.0, 14.0, 22.0]
VERGE_Z = [0.0, 0.0, -0.35, -1.1]
for side in (+1, -1):
    w0 = smooth_closed(HALF_W + np.where(kerb_mask[side], 1.6, 0.0), 2) + SHOULDER - 0.05
    cols = len(VERGE_OFF)
    verts = np.zeros((N * cols, 3))
    uvs = np.zeros((N * cols, 2))
    for c, (o, z) in enumerate(zip(VERGE_OFF, VERGE_Z)):
        verts[c::cols, :2] = lap + nor * side * (w0 + o)[:, None]
        verts[c::cols, 2] = z
        uvs[c::cols] = verts[c::cols, :2] / 9.0
    faces = []
    for i in range(N):
        j = (i + 1) % N
        for c in range(cols - 1):
            a, b = i * cols + c, j * cols + c
            faces.append((a, b, b + 1, a + 1) if side > 0 else (a, a + 1, b + 1, b))  # CCW from above
    build(f'D_Verge_{side}', verts, faces, uvs, MAT_VERGE)

# ------------------------------------------------------------------ pit lane
pit_pts = None
if D.get('pit'):
    pit = resample(np.asarray(D['pit'][0], float), 2.0, closed=False)
    ptan, pnor = frames(pit, closed=False)
    # pit lane = fast lane + working lane, ~12 m
    sp = np.arange(len(pit)) * 2.0
    strip('D_PitLane', pit + pnor * 6, pit - pnor * 6, sp / 12, sp / 12, 0, 1, MAT_PIT)
    pit_pts = pit
    # pit wall along the stretch that runs parallel to the track
    d = lap_near.dist(pit, 60)
    par = d > HALF_W + SHOULDER + 7
    seg = runs(par)
    if seg:
        a, b = max(seg, key=lambda r: r[1] - r[0])
        a += 12
        b -= 12
        if b - a > 10:
            # wall sits between the lane and the track: offset the lane edge toward the track
            side_pts = []
            for i in range(a, b):
                q = pit[i]
                j = int(np.argmin(np.sum((lap - q) ** 2, 1)))
                toward = lap[j] - q
                toward /= np.linalg.norm(toward) + 1e-9
                side_pts.append(q + toward * 7.0)
            side_pts = np.array(side_pts)
            wall('PitWall', side_pts, 0, 1.25, MAT_WALL, 4)
            wall('PitWallFence', side_pts, 1.25, 3.6, MAT_FENCE, 3)

pit_near = Near(pit_pts, 20) if pit_pts is not None else None

# ------------------------------------------------------------------ gravel traps
sand_polys = [np.asarray(p, float) for p in D.get('sand', []) if len(p) >= 3]


def poly_mesh(name, poly, mat, z=0.0, uvscale=6.0):
    """Triangulated flat polygon (ear clipping via Blender's fill)."""
    import bmesh
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, z)) for x, y in poly]
    try:
        f = bm.faces.new(vs)
    except ValueError:
        bm.free()
        return None
    bmesh.ops.triangulate(bm, faces=[f], quad_method='BEAUTY', ngon_method='EAR_CLIP')
    # subdivide big triangles a bit so elevation draping has vertices to move
    for _ in range(4):
        edges = [e for e in bm.edges if e.calc_length() > 12]
        if not edges:
            break
        bmesh.ops.subdivide_edges(bm, edges=edges, cuts=1, use_grid_fill=False)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    uv = me.uv_layers.new(name='UVMap')
    for loop in me.loops:
        co = me.vertices[loop.vertex_index].co
        uv.data[loop.index].uv = (co.x / uvscale, co.y / uvscale)
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    ob.parent = root
    return ob


for i, p in enumerate(sand_polys):
    poly_mesh(f'D_Gravel_{i}', p, MAT_GRAVEL, 0.0, 5.0)

# ------------------------------------------------------------------ barriers + catch fence
for side in (+1, -1):
    base = HALF_W + SHOULDER + 9.0 + np.where(np.sign(kap) == -side, np.clip((1 / np.maximum(np.abs(kap), 1e-4)) ** -1 * 1800, 0, 20), 0)
    base = smooth_closed(base, 6)
    line = lap + nor * side * base[:, None]
    # push outward until outside gravel
    for poly in sand_polys:
        for _ in range(40):
            inside = in_poly(line, poly)
            if not inside.any():
                break
            base[inside] += 3
            line = lap + nor * side * base[:, None]
    base = smooth_closed(base, 3)
    line = lap + nor * side * base[:, None]
    # drop points that end up too close to some other part of the track (inner side of tight bends)
    ok = lap_near.dist(line, base.max() + 5) > base * 0.8
    ok &= lap_near.dist(line, 30) > HALF_W + SHOULDER + 3
    if pit_near is not None:
        ok &= pit_near.dist(line, 40) > 12
    off = int(np.argmin(ok)) if not ok.all() else 0
    okr = np.roll(ok, -off)
    for a, b in runs(okr):
        if b - a < 8:
            continue
        idx = (np.arange(a, b) + off) % N
        seg = line[idx]
        wall(f'Armco_{side}_{a}', seg, 0, 0.95, MAT_ARMCO, 4)
        # catch fence on the long straights and fast corners only
        fast = R[idx] > 150
        for fa, fb in runs(fast):
            if fb - fa > 20:
                wall(f'Fence_{side}_{a}_{fa}', seg[fa:fb], 0.95, 4.2, MAT_FENCE, 3)

# ------------------------------------------------------------------ grandstands
def extrude(name, poly, heights, top_mat, side_mat, top_uv=None):
    """Prism over `poly` with per-vertex top heights."""
    n = len(poly)
    verts = [(x, y, 0.0) for x, y in poly] + [(x, y, float(h)) for (x, y), h in zip(poly, heights)]
    faces = []
    sides = []
    for i in range(n):
        j = (i + 1) % n
        sides.append((i, j, n + j, n + i))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], sides + [tuple(range(2 * n - 1, n - 1, -1))[::-1]])
    me.materials.append(side_mat)
    me.materials.append(top_mat)
    me.polygons.foreach_set('material_index', [0] * len(sides) + [1])
    # uvs: walls by perimeter / height, top by plan
    uv = me.uv_layers.new(name='UVMap')
    per = np.concatenate([[0], np.cumsum([math.dist(poly[i], poly[(i + 1) % n]) for i in range(n)])])
    for pi, poly_ in enumerate(me.polygons):
        for li in poly_.loop_indices:
            vi = me.loops[li].vertex_index
            co = me.vertices[vi].co
            if pi < n:
                k = vi % n
                kk = k if not (vi % n == 0 and pi == n - 1) else n
                u = per[kk] / 4.0
                uv.data[li].uv = (u, co.z / 3.2)
            else:
                uv.data[li].uv = top_uv(co) if top_uv else (co.x / 8, co.y / 8)
    me.validate()
    me.update()
    # triangulate the (possibly concave) top
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4], quad_method='BEAUTY', ngon_method='EAR_CLIP')
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    ob.parent = root
    return ob


for gi, p in enumerate(D.get('grandstand', [])):
    poly = np.asarray(p, float)
    if len(poly) < 3:
        continue
    # make CCW
    area = 0.5 * np.sum(poly[:, 0] * np.roll(poly[:, 1], -1) - np.roll(poly[:, 0], -1) * poly[:, 1])
    if area < 0:
        poly = poly[::-1]
    c = poly.mean(0)
    j = int(np.argmin(np.sum((lap - c) ** 2, 1)))
    away = c - lap[j]
    away /= np.linalg.norm(away) + 1e-9
    depth_coord = (poly - lap[j]) @ away
    d0, d1 = depth_coord.min(), depth_coord.max()
    depth = max(d1 - d0, 1.0)
    rise = min(0.62 * depth, 22.0)
    hts = 2.2 + (depth_coord - d0) / depth * rise
    ob = extrude(f'Grandstand_{gi}', poly, hts, MAT_SEATS, MAT_WALL,
                 top_uv=lambda co, a=away, o=lap[j], d0=d0: ((co.x * -a[1] + co.y * a[0]) / 6.0, (((co.x - o[0]) * a[0] + (co.y - o[1]) * a[1]) - d0) / 3.2))
    # roof over the deep stands
    on_straight = s_lap[j] < 950 or s_lap[j] > s_lap[-1] - 60
    if depth > 12 and on_straight:
        roof = np.array([*poly])
        rh = hts.max() + 3.5
        verts = [(x, y, rh) for x, y in roof]
        me = bpy.data.meshes.new(f'Roof_{gi}')
        me.from_pydata(verts, [], [tuple(range(len(verts)))])
        me.materials.append(MAT_ROOF)
        import bmesh
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.triangulate(bm, faces=bm.faces[:], ngon_method='EAR_CLIP')
        bm.to_mesh(me)
        bm.free()
        ro = bpy.data.objects.new(f'Roof_{gi}', me)
        scene.collection.objects.link(ro)
        ro.parent = ob
        # columns along the front edge
        front = poly[depth_coord < d0 + 0.25 * depth]
        if len(front) >= 2:
            edge = resample(front[np.argsort(front @ np.array([-away[1], away[0]]))], 18.0, closed=False)
            for ci, (x, y) in enumerate(edge):
                bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.35, depth=rh, location=(x, y, rh / 2))
                col_ob = bpy.context.active_object
                col_ob.name = f'Column_{gi}_{ci}'
                col_ob.data.materials.append(MAT_ROOF)
                col_ob.parent = ob

# ------------------------------------------------------------------ buildings
DEFAULT_H = {'house': 7, 'residential': 9, 'apartments': 14, 'garage': 3, 'garages': 3, 'shed': 3, 'industrial': 9,
             'commercial': 10, 'service': 4, 'farm': 7, 'school': 10}
for bi, b in enumerate(D.get('building', [])):
    poly = np.asarray(b['pts'], float)
    if len(poly) < 3:
        continue
    if lap_near.dist(poly.mean(0)[None], 30)[0] < HALF_W + 4:
        continue
    h = b['h'] or DEFAULT_H.get(b['kind'], 8) * (0.85 + 0.3 * rng.random())
    extrude(f'Building_{bi}', poly, [h] * len(poly), MAT_ROOF, MAT_FACADE[bi % 3])

# ------------------------------------------------------------------ roads in the park
for ri, r in enumerate(D.get('road', [])):
    p = np.asarray(r, float)
    if len(p) < 2:
        continue
    p = resample(p, 4.0, closed=False)
    keep = lap_near.dist(p, 40) > HALF_W + SHOULDER + 6
    if pit_near is not None:
        keep &= pit_near.dist(p, 40) > 9
    for a, b2 in runs(keep):
        if b2 - a < 3:
            continue
        q = p[a:b2]
        _, qn = frames(q, closed=False)
        sq = np.arange(len(q)) * 4.0
        strip(f'D_Road_{ri}_{a}', q + qn * 2.6, q - qn * 2.6, sq / 6, sq / 6, 0, 0.5, MAT_ROAD)

# ------------------------------------------------------------------ ground (vertex coloured: darker under the woods)
forest = [np.asarray(p, float) for p in D.get('forest', []) if len(p) >= 3]
lo = lap.min(0) - 700
hi = lap.max(0) + 700
step = 25.0
gx = np.arange(lo[0], hi[0] + step, step)
gy = np.arange(lo[1], hi[1] + step, step)
GX, GY = np.meshgrid(gx, gy)
gpts = np.stack([GX.ravel(), GY.ravel()], 1)
lowf = noise(len(gy), len(gx), [(2, 0.6), (5, 1), (14, 0.8)], 9).ravel()
base = np.tile(srgb('#557f36'), (len(gpts), 1))  # park lawn
for key, hx in [('grass', '#6b9443'), ('farmland', '#8f9356'), ('urban', '#8b8a80'), ('forest', '#33522a')]:
    for poly in D.get(key, []):
        if len(poly) >= 3:
            base[in_poly(gpts, np.asarray(poly, float))] = srgb(hx)
tone = 0.8 + 0.4 * lowf
# mown verges close to the track are a brighter, even green
verge = lap_near.dist(gpts, 60) < 45
base[verge] = srgb('#5e8c3a')
tone[verge] = 1.0 + 0.06 * lowf[verge]
col = np.ones((len(gpts), 4))
col[:, :3] = base * tone[:, None]
nx_, ny_ = len(gx), len(gy)
faces = []
for yi in range(ny_ - 1):
    for xi in range(nx_ - 1):
        a = yi * nx_ + xi
        faces.append((a, a + 1, a + nx_ + 1, a + nx_))
gverts = np.concatenate([gpts, np.full((len(gpts), 1), 0.0)], 1)
build('D_Ground', gverts, faces, gpts / 9.0, MAT_GROUND, cols=col)

# ------------------------------------------------------------------ trees (GPU instanced)
def tree_mesh(kind):
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.35, radius2=0.25, depth=4.0,
                          matrix=__import__('mathutils').Matrix.Translation((0, 0, 2.0)))
    for f in bm.faces:
        f.material_index = 0
    r = np.random.default_rng(kind)
    if kind < 2:
        for k, (dx, dy, dz, rr) in enumerate([(0, 0, 7.2, 3.6), (1.3, 0.6, 6.0, 2.6), (-1.1, -0.8, 6.4, 2.8)][: 3 - kind]):
            res = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=rr,
                                             matrix=__import__('mathutils').Matrix.Translation((dx, dy, dz)))
            for v in res['verts']:
                v.co.z = dz + (v.co.z - dz) * 0.8
                v.co += __import__('mathutils').Vector(r.normal(0, 0.25, 3))
            for f in {f for v in res['verts'] for f in v.link_faces}:
                f.material_index = 1
    else:
        for k, (z, rr, hh) in enumerate([(3.0, 2.8, 4.5), (5.4, 2.1, 3.8), (7.6, 1.3, 3.2)]):
            res = bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=rr, radius2=0.05, depth=hh,
                                        matrix=__import__('mathutils').Matrix.Translation((0, 0, z + hh / 2)))
            for f in {f for v in res['verts'] for f in v.link_faces}:
                f.material_index = 1
    me = bpy.data.meshes.new(f'Tree{kind}')
    bm.to_mesh(me)
    bm.free()
    me.materials.append(MAT_TRUNK)
    me.materials.append(MAT_LEAVES[kind])
    for p in me.polygons:
        p.use_smooth = kind < 2
    return me


tree_meshes = [tree_mesh(k) for k in range(3)]
trees = bpy.data.objects.new('Trees', None)
scene.collection.objects.link(trees)
trees.parent = root
spacing = 10.0
cand = []
for poly in forest:
    lo2, hi2 = poly.min(0), poly.max(0)
    xs = np.arange(lo2[0], hi2[0], spacing)
    ys = np.arange(lo2[1], hi2[1], spacing)
    if not len(xs) or not len(ys):
        continue
    P = np.stack(np.meshgrid(xs, ys), -1).reshape(-1, 2)
    P = P + rng.uniform(-spacing * 0.45, spacing * 0.45, P.shape)
    cand.append(P[in_poly(P, poly)])
# a few loose trees on the lawns too
for poly in [np.asarray(p, float) for p in D.get('grass', []) if len(p) >= 3]:
    lo2, hi2 = poly.min(0), poly.max(0)
    P = rng.uniform(lo2, hi2, (max(1, int(np.prod(hi2 - lo2) / 2500)), 2))
    cand.append(P[in_poly(P, poly)])
P = np.concatenate(cand) if cand else np.zeros((0, 2))
# keep it near the circuit and clear of the track, pit lane, buildings and gravel
P = P[lap_near.dist(P, 420) < 400]
P = P[lap_near.dist(P, 40) > HALF_W + SHOULDER + 14]
if pit_near is not None:
    P = P[pit_near.dist(P, 30) > 14]
blocked = np.zeros(len(P), bool)
for b in D.get('building', []):
    pb = np.asarray(b['pts'], float)
    bl, bh = pb.min(0) - 3, pb.max(0) + 3
    m = (P[:, 0] > bl[0]) & (P[:, 0] < bh[0]) & (P[:, 1] > bl[1]) & (P[:, 1] < bh[1])
    if m.any():
        blocked[m] |= True
for poly in sand_polys + [np.asarray(p, float) for p in D.get('grandstand', [])]:
    blocked |= in_poly(P, poly)
P = P[~blocked]
print(f'trees: {len(P)}')
for i, (x, y) in enumerate(P):
    k = int(rng.integers(0, 3)) if rng.random() > 0.25 else 2
    k = 0 if k == 2 and rng.random() < 0.6 else k
    ob = bpy.data.objects.new(f'T{i}', tree_meshes[k])
    ob.location = (float(x), float(y), 0.0)
    ob.rotation_euler = (0, 0, float(rng.uniform(0, 2 * math.pi)))
    sc = float(rng.uniform(0.8, 1.35))
    ob.scale = (sc, sc, sc * float(rng.uniform(0.9, 1.15)))
    scene.collection.objects.link(ob)
    ob.parent = trees

# ------------------------------------------------------------------ export
for ob in scene.objects:
    if ob.type == 'MESH' and not ob.name.startswith('T'):
        for p in ob.data.polygons:
            p.use_smooth = False
import os
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format='GLB',
    export_yup=True,
    export_extras=True,
    export_gpu_instances=True,
    export_vertex_color='ACTIVE',
    export_image_format='WEBP',
    export_image_quality=82,
    export_cameras=False,
    export_lights=False,
    export_animations=False,
)
print('wrote', OUT, os.path.getsize(OUT) // 1024, 'KB')
