"""
Procedural 2026-style Formula 1 car for the Pitwall 3D view.

Regenerate the model:
    blender -b --factory-startup --python blender/car.py
Optional preview renders (Paint shown red, export stays grey):
    blender -b --factory-startup --python blender/car.py -- --preview /some/dir

Blender axes: nose +X, up +Z, sideways +-Y (+Y = car's left).
Exported glTF (Y-up): nose +X, up +Y, sideways +-Z (car's left = -Z).
Origin: ground level, midway between the axles. Units: metres.

Geometry is built with bmesh from lofted cross-sections (body, wings),
lathe profiles (wheels) and swept tubes (halo, suspension). No modifiers,
no textures: plain Principled BSDF materials only.
"""

import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector


# --------------------------------------------------------------------------
# paths / args
# --------------------------------------------------------------------------
def _script_path():
    try:
        return os.path.abspath(__file__)
    except NameError:
        if "--python" in sys.argv:
            return os.path.abspath(sys.argv[sys.argv.index("--python") + 1])
        return os.path.abspath("blender/car.py")


SCRIPT_DIR = os.path.dirname(_script_path())
PROJECT = os.path.dirname(SCRIPT_DIR)
OUT_GLB = os.path.join(PROJECT, "public", "models", "car.glb")

ARGV = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PREVIEW_DIR = ARGV[ARGV.index("--preview") + 1] if "--preview" in ARGV else None

# --------------------------------------------------------------------------
# key dimensions (metres)
# --------------------------------------------------------------------------
WHEELBASE = 3.40
AX_F = WHEELBASE / 2          # front axle x
AX_R = -WHEELBASE / 2         # rear axle x
TYRE_R = 0.362                # ~0.72 m diameter
RIM_R = 0.232                 # 18-inch rim
AXLE_Z = TYRE_R               # tyres touch z = 0
FRONT_HALF_W = 0.150          # front tyre ~0.30 m wide
REAR_HALF_W = 0.1875          # rear tyre ~0.375 m wide
FRONT_TRACK_Y = 0.950 - FRONT_HALF_W
REAR_TRACK_Y = 0.950 - REAR_HALF_W


# --------------------------------------------------------------------------
# scene reset
# --------------------------------------------------------------------------
def reset_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras,
                 bpy.data.lights, bpy.data.curves):
        for block in list(coll):
            coll.remove(block)


# --------------------------------------------------------------------------
# materials
# --------------------------------------------------------------------------
def srgb(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_lin(h):
    return (srgb((h >> 16) & 255), srgb((h >> 8) & 255), srgb(h & 255))


MAT_SPECS = [
    # name, linear base colour, metallic, roughness, emission strength
    ("Paint",     (0.50, 0.50, 0.50), 0.30, 0.30, 0.0),
    ("Accent",    (0.90, 0.90, 0.90), 0.10, 0.35, 0.0),
    ("Carbon",    hex_lin(0x15151a),  0.00, 0.50, 0.0),
    ("Tyre",      (0.018, 0.018, 0.018), 0.00, 0.90, 0.0),
    ("Rim",       (0.06, 0.06, 0.065), 0.90, 0.35, 0.0),
    ("Helmet",    (0.92, 0.92, 0.92), 0.00, 0.30, 0.0),
    ("Halo",      (0.035, 0.035, 0.04), 0.60, 0.40, 0.0),
    ("RainLight", (0.60, 0.01, 0.01), 0.00, 0.40, 3.0),
]
MAT_NAMES = [m[0] for m in MAT_SPECS]
MI = {n: i for i, n in enumerate(MAT_NAMES)}
MATS = {}


def principled(mat):
    if mat.node_tree is None:
        mat.use_nodes = True
    for n in mat.node_tree.nodes:
        if n.type == "BSDF_PRINCIPLED":
            return n
    nt = mat.node_tree
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    out = next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"), None)
    if out is None:
        out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return bsdf


def set_mat_color(mat, rgb):
    principled(mat).inputs["Base Color"].default_value = (*rgb, 1.0)
    mat.diffuse_color = (*rgb, 1.0)


def make_materials():
    for name, col, metal, rough, emit in MAT_SPECS:
        m = bpy.data.materials.new(name)
        b = principled(m)
        b.inputs["Base Color"].default_value = (*col, 1.0)
        b.inputs["Metallic"].default_value = metal
        b.inputs["Roughness"].default_value = rough
        if emit > 0:
            b.inputs["Emission Color"].default_value = (1.0, 0.02, 0.02, 1.0)
            b.inputs["Emission Strength"].default_value = emit
        m.diffuse_color = (*col, 1.0)
        m.metallic = metal
        m.roughness = rough
        MATS[name] = m


# --------------------------------------------------------------------------
# geometry helpers
# --------------------------------------------------------------------------
class Part:
    """One output object; verts are stored relative to `origin`."""

    def __init__(self, name, origin=(0, 0, 0), sharp_deg=40.0):
        self.name = name
        self.bm = bmesh.new()
        self.origin = Vector(origin)
        self.sharp = math.radians(sharp_deg)

    def v(self, p):
        return self.bm.verts.new(Vector(p) - self.origin)

    def f(self, verts, mat):
        face = self.bm.faces.new(verts)
        face.material_index = MI[mat]
        return face


def loft(part, rings, mat, cap0=True, cap1=True, matfn=None,
         capmat0=None, capmat1=None):
    """Skin a list of equal-length closed point rings."""
    vr = [[part.v(p) for p in r] for r in rings]
    n = len(rings[0])
    for i in range(len(vr) - 1):
        a, b = vr[i], vr[i + 1]
        for j in range(n):
            k = (j + 1) % n
            m = matfn(i, j) if matfn else mat
            part.f((a[j], a[k], b[k], b[j]), m)
    if cap0:
        part.f(vr[0], capmat0 or mat)
    if cap1:
        part.f(vr[-1][::-1], capmat1 or mat)
    return vr


def lathe(part, profile, segs, mat, center=(0, 0, 0)):
    """Revolve a closed (r, y) profile around the Y axis."""
    c = Vector(center)
    rings = []
    for s in range(segs):
        a = 2 * math.pi * s / segs
        ca, sa = math.cos(a), math.sin(a)
        rings.append([part.v(c + Vector((r * ca, y, r * sa))) for r, y in profile])
    n = len(profile)
    for s in range(segs):
        A, B = rings[s], rings[(s + 1) % segs]
        for j in range(n):
            k = (j + 1) % n
            part.f((A[j], A[k], B[k], B[j]), mat)


def box(part, center, size, mat):
    cx, cy, cz = center
    sx, sy, sz = (s / 2 for s in size)
    P = [part.v((cx + dx * sx, cy + dy * sy, cz + dz * sz))
         for dx in (-1, 1) for dy in (-1, 1) for dz in (-1, 1)]
    for q in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1),
              (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
        part.f([P[i] for i in q], mat)


def prism(part, poly, axis, off, thick, mat):
    """Extrude a 2D polygon. axis='y': poly is (x,z); 'z': (x,y); 'x': (y,z)."""
    def p3(a, b, d):
        if axis == "y":
            return (a, off + d, b)
        if axis == "z":
            return (a, b, off + d)
        return (off + d, a, b)
    A = [part.v(p3(a, b, -thick / 2)) for a, b in poly]
    B = [part.v(p3(a, b, thick / 2)) for a, b in poly]
    n = len(poly)
    part.f(A, mat)
    part.f(B[::-1], mat)
    for i in range(n):
        j = (i + 1) % n
        part.f((A[i], A[j], B[j], B[i]), mat)


def catmull(pts, sub=4):
    P = [Vector(p) for p in pts]
    out = []
    for i in range(len(P) - 1):
        p0, p1, p2 = P[max(i - 1, 0)], P[i], P[i + 1]
        p3 = P[min(i + 2, len(P) - 1)]
        for s in range(sub):
            t = s / sub
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t
                              + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-1])
    return out


def tube(part, path, r, mat, n=10, r2=None, chord_axis=None):
    """Sweep an ellipse (r along N, r2 along B) along a polyline, capped."""
    r2 = r if r2 is None else r2
    P = [Vector(p) for p in path]
    T = []
    for i in range(len(P)):
        a = P[max(i - 1, 0)]
        b = P[min(i + 1, len(P) - 1)]
        T.append((b - a).normalized())
    ref = Vector(chord_axis) if chord_axis else Vector((0, 0, 1))
    N = ref - T[0] * ref.dot(T[0])
    if N.length < 1e-4:
        ref = Vector((1, 0, 0)) if abs(T[0].x) < 0.9 else Vector((0, 1, 0))
        N = ref - T[0] * ref.dot(T[0])
    N.normalize()
    rings = []
    for i, p in enumerate(P):
        N = (N - T[i] * N.dot(T[i])).normalized()
        B = T[i].cross(N)
        rings.append([p + N * (r * math.cos(2 * math.pi * k / n))
                      + B * (r2 * math.sin(2 * math.pi * k / n)) for k in range(n)])
    loft(part, rings, mat)


def bar(part, p1, p2, mat, chord=0.045, thick=0.016):
    """Streamlined suspension member: chord aligned to the airflow (X)."""
    tube(part, [p1, p2], chord / 2, mat, n=8, r2=thick / 2, chord_axis=(1, 0, 0))


def sring(x, P, n):
    """Superellipse cross-section ring at station x.

    P: yc, zc, w, ht, hb, p, taper (upper half narrower), dip (cockpit
    depression depth), dipw, uc (undercut on the outer-lower quadrant),
    side (+1/-1, which y side counts as outer for the undercut).
    Returns (points, tags) where tag=True marks cockpit-well points.
    """
    yc, zc = P.get("yc", 0.0), P["zc"]
    w, ht, hb = max(P["w"], 0.005), max(P["ht"], 0.005), max(P["hb"], 0.005)
    p = P.get("p", 2.6)
    taper = P.get("taper", 0.0)
    dip = max(P.get("dip", 0.0), 0.0)
    dipw = P.get("dipw", 0.2)
    uc = max(P.get("uc", 0.0), 0.0)
    side = P.get("side", 0)
    pts, tags = [], []
    for i in range(n):
        t = 2 * math.pi * i / n
        c, s = math.cos(t), math.sin(t)
        cy = math.copysign(abs(c) ** (2 / p), c)
        sz = math.copysign(abs(s) ** (2 / p), s)
        z = zc + (ht if sz > 0 else hb) * sz
        ww = w
        if taper and sz > 0:
            ww *= 1 - taper * sz
        if uc and sz < 0 and cy * side > 0:
            ww *= 1 - uc * (-sz) ** 1.5
        y = yc + ww * cy
        tag = False
        if dip > 0.002 and sz > 0:
            d = abs(y - yc) / dipw
            if d < 1:
                f = min(1.0, (1 - d) / 0.3)
                f = f * f * (3 - 2 * f)
                z -= dip * f
                tag = f > 0.5
        pts.append(Vector((x, y, z)))
        tags.append(tag)
    return pts, tags


def interp_keys(keys, sub=3):
    """Catmull-Rom resample of parameter keyframes (dicts with 'x')."""
    out = []
    K = len(keys)
    for i in range(K - 1):
        p0, p1, p2 = keys[max(i - 1, 0)], keys[i], keys[i + 1]
        p3 = keys[min(i + 2, K - 1)]
        for s in range(sub):
            t = s / sub
            d = {}
            for k in p1:
                a, b, c, e = p0.get(k, p1[k]), p1[k], p2.get(k, p1[k]), p3.get(k, p2.get(k, p1[k]))
                if not isinstance(b, (int, float)):
                    d[k] = b
                    continue
                d[k] = 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - e) * t * t
                              + (-a + 3 * b - 3 * c + e) * t ** 3)
            out.append(d)
    out.append(dict(keys[-1]))
    return out


def K(x, zc, w, ht, hb, **kw):
    d = dict(x=x, zc=zc, w=w, ht=ht, hb=hb)
    d.update(kw)
    return d


# airfoil loop: TE -> top -> LE -> bottom -> (TE)
def airfoil(n=8, t=0.12):
    us = [(1 - math.cos(math.pi * i / n)) / 2 for i in range(n + 1)]

    def th(u):
        return 5 * t * (0.2969 * math.sqrt(u) - 0.126 * u - 0.3516 * u * u
                        + 0.2843 * u ** 3 - 0.1036 * u ** 4)
    top = [(u, th(u)) for u in reversed(us)]
    bot = [(u, -th(u)) for u in us[1:-1]]
    return top + bot


def wing(part, mat, ys, x_le, z_le, chord, aoa, t=0.12, camber=0.04):
    """Wing element spanning along Y; chord runs toward -X, TE raised by aoa."""
    AF = airfoil(8, t)
    rings = []
    for y in ys:
        c, a = chord(y), math.radians(aoa(y))
        xl, zl = x_le(y), z_le(y)
        ca, sa = math.cos(a), math.sin(a)
        ring = []
        for u, v in AF:
            lx = -u * c
            lz = v * c - camber * c * 4 * u * (1 - u)   # camber toward the ground
            ring.append(Vector((xl + lx * ca + lz * sa, y, zl - lx * sa + lz * ca)))
        rings.append(ring)
    loft(part, rings, mat)


def span(half, n):
    return [-half + 2 * half * i / (n - 1) for i in range(n)]


# --------------------------------------------------------------------------
# car parts
# --------------------------------------------------------------------------
def build_body():
    part = Part("Body")
    N = 40

    # --- survival cell + nose (cockpit well carved with `dip`)
    tub_keys = [
        K(2.75, 0.135, 0.040, 0.030, 0.040),
        K(2.54, 0.180, 0.075, 0.050, 0.055),
        K(2.30, 0.240, 0.110, 0.080, 0.075),
        K(2.00, 0.300, 0.145, 0.120, 0.110),
        K(1.70, 0.360, 0.180, 0.170, 0.170),
        K(1.40, 0.390, 0.220, 0.220, 0.240),
        K(1.10, 0.390, 0.260, 0.255, 0.330),
        K(0.95, 0.385, 0.285, 0.272, 0.335),
        K(0.80, 0.380, 0.305, 0.288, 0.335, dip=0.17),
        K(0.50, 0.370, 0.320, 0.292, 0.325, dip=0.215),
        K(0.15, 0.370, 0.325, 0.285, 0.325, dip=0.215),
        K(0.04, 0.370, 0.320, 0.275, 0.325, dip=0.0),
        K(-0.30, 0.360, 0.280, 0.220, 0.315),
    ]
    for k in tub_keys:
        k.setdefault("dip", 0.0)
        k.update(p=2.5, taper=0.32, dipw=0.20)
    stations = interp_keys(tub_keys, sub=2)
    rings, tags = [], []
    for st in stations:
        r, tg = sring(st["x"], st, N)
        rings.append(r)
        tags.append(tg)
    xs = [st["x"] for st in stations]

    def tub_mat(i, j):
        k = (j + 1) % N
        if tags[i][j] and tags[i][k] and tags[i + 1][j] and tags[i + 1][k]:
            return "Carbon"
        if xs[i + 1] > 2.42:
            return "Accent"
        return "Paint"
    loft(part, rings, "Paint", matfn=tub_mat, capmat0="Accent")

    # --- engine cover with airbox intake (recess ring -> lip -> body)
    ec_keys = [
        K(0.10, 0.862, 0.085, 0.095, 0.085, p=2.3, taper=0.45),
        K(-0.05, 0.760, 0.150, 0.210, 0.260, p=2.4, taper=0.45),
        K(-0.35, 0.580, 0.210, 0.270, 0.540, p=2.5, taper=0.42),
        K(-0.80, 0.470, 0.220, 0.230, 0.430, p=2.5, taper=0.40),
        K(-1.30, 0.400, 0.160, 0.170, 0.360, p=2.5, taper=0.38),
        K(-1.75, 0.370, 0.110, 0.120, 0.330, p=2.5, taper=0.35),
        K(-2.05, 0.360, 0.075, 0.090, 0.180, p=2.5, taper=0.30),
        K(-2.18, 0.360, 0.050, 0.060, 0.110, p=2.5, taper=0.30),
    ]
    st = interp_keys(ec_keys, sub=3)
    lip = st[0]
    rec = dict(lip, x=0.02, w=lip["w"] * 0.7, ht=lip["ht"] * 0.7, hb=lip["hb"] * 0.7)
    rings = [sring(rec["x"], rec, N)[0]] + [sring(s["x"], s, N)[0] for s in st]
    loft(part, rings, "Paint", matfn=lambda i, j: "Carbon" if i == 0 else "Paint",
         capmat0="Carbon")

    # --- sidepods (inlet recess -> lip -> body, undercut on the outer-lower side)
    for s in (1, -1):
        sp_keys = [
            K(0.36, 0.530, 0.120, 0.060, 0.060, yc=0.50, p=4.0, taper=0.08, uc=0.0),
            K(0.22, 0.500, 0.190, 0.100, 0.130, yc=0.50, p=4.0, taper=0.12, uc=0.50),
            K(-0.15, 0.450, 0.230, 0.140, 0.220, yc=0.48, p=4.0, taper=0.15, uc=0.75),
            K(-0.60, 0.370, 0.220, 0.140, 0.240, yc=0.40, p=3.6, taper=0.18, uc=0.65),
            K(-1.05, 0.300, 0.170, 0.100, 0.220, yc=0.30, p=3.2, taper=0.18, uc=0.40),
            K(-1.45, 0.260, 0.110, 0.080, 0.200, yc=0.21, p=3.0, taper=0.15, uc=0.20),
            K(-1.75, 0.250, 0.070, 0.060, 0.210, yc=0.15, p=3.0, taper=0.15, uc=0.10),
        ]
        for k in sp_keys:
            k["yc"] *= s
            k["side"] = s
        st = interp_keys(sp_keys, sub=3)
        lip = st[0]
        rec = dict(lip, x=0.27, w=lip["w"] * 0.72, ht=lip["ht"] * 0.6, hb=lip["hb"] * 0.6)
        rings = [sring(rec["x"], rec, 32)[0]] + [sring(q["x"], q, 32)[0] for q in st]
        loft(part, rings, "Paint", matfn=lambda i, j: "Carbon" if i == 0 else "Paint",
             capmat0="Carbon")

    # --- floor (plan-shape loft of thin slabs)
    fl = [(1.15, 0.18), (0.95, 0.34), (0.70, 0.58), (0.40, 0.745), (-1.00, 0.745),
          (-1.20, 0.62), (-1.33, 0.52), (-1.42, 0.52)]
    z0, z1 = 0.030, 0.055
    rings = [[Vector((x, w, z1)), Vector((x, -w, z1)), Vector((x, -w, z0)), Vector((x, w, z0))]
             for x, w in fl]
    loft(part, rings, "Carbon")
    for s in (1, -1):
        # floor edge lip / edge wing
        box(part, (-0.30, s * 0.735, 0.085), (1.40, 0.015, 0.06), "Carbon")
        # leading-edge floor fences
        for yy in (0.24, 0.34, 0.44):
            prism(part, [(1.02, 0.05), (0.98, 0.20), (0.62, 0.24), (0.55, 0.05)],
                  "y", s * yy, 0.010, "Carbon")
        # wheel wake control board ahead of the rear tyre
        prism(part, [(-1.05, 0.05), (-1.07, 0.20), (-1.25, 0.20), (-1.25, 0.05)],
              "y", s * 0.66, 0.012, "Carbon")

    # --- diffuser ramp + strakes
    rings = [[Vector((x, w, z + 0.025)), Vector((x, -w, z + 0.025)),
              Vector((x, -w, z)), Vector((x, w, z))]
             for x, w, z in ((-1.42, 0.52, 0.030), (-1.80, 0.52, 0.12), (-2.08, 0.50, 0.255))]
    loft(part, rings, "Carbon")
    for yy in (0.0, 0.51, -0.51):
        prism(part, [(-1.45, 0.05), (-2.08, 0.28), (-2.08, 0.09), (-1.70, 0.04)],
              "y", yy, 0.012, "Carbon")

    # --- shark fin
    prism(part, [(-0.30, 0.93), (-1.40, 0.63), (-1.48, 0.50), (-1.10, 0.52),
                 (-0.70, 0.64), (-0.30, 0.82)], "y", 0.0, 0.010, "Paint")

    # --- T-camera on the airbox, roll-hoop camera pod
    box(part, (-0.10, 0.0, 0.985), (0.10, 0.10, 0.018), "Carbon")
    box(part, (-0.10, 0.0, 0.968), (0.03, 0.015, 0.03), "Carbon")

    # --- cockpit: headrest pads + steering wheel
    box(part, (0.52, 0.0, 0.58), (0.03, 0.22, 0.09), "Carbon")

    # --- mirrors on sidepod-mounted stalks
    for s in (1, -1):
        tube(part, [(0.40, s * 0.42, 0.58), (0.45, s * 0.45, 0.66), (0.47, s * 0.46, 0.72)],
             0.010, "Carbon", n=6)
        box(part, (0.48, s * 0.47, 0.745), (0.06, 0.15, 0.055), "Paint")
        box(part, (0.448, s * 0.47, 0.745), (0.006, 0.13, 0.042), "Carbon")

    # --- exhaust and rain light at the tail
    tube(part, [(-1.95, 0.0, 0.50), (-2.20, 0.0, 0.50)], 0.042, "Rim", n=12)
    tube(part, [(-2.19, 0.0, 0.50), (-2.205, 0.0, 0.50)], 0.034, "Carbon", n=12)
    box(part, (-2.20, 0.0, 0.375), (0.04, 0.11, 0.045), "RainLight")
    return part


def build_front_wing():
    part = Part("FrontWing")
    H = 0.865
    ys = span(H, 19)

    def q(y):
        return abs(y) / H
    # main plane (nose sits on it), two flaps rising outboard
    wing(part, "Carbon", ys, lambda y: 2.80 - 0.04 * q(y) ** 2, lambda y: 0.075 + 0.025 * q(y) ** 2,
         lambda y: 0.25, lambda y: 3 + 5 * q(y), t=0.10)
    wing(part, "Carbon", ys, lambda y: 2.615 - 0.02 * q(y) ** 2, lambda y: 0.120 + 0.055 * q(y) ** 2,
         lambda y: 0.17, lambda y: 13 + 9 * q(y), t=0.10)
    wing(part, "Paint", ys, lambda y: 2.49 - 0.02 * q(y) ** 2, lambda y: 0.165 + 0.055 * q(y) ** 2,
         lambda y: 0.14, lambda y: 22 + 8 * q(y), t=0.10)
    for s in (1, -1):
        prism(part, [(2.82, 0.035), (2.82, 0.15), (2.67, 0.23), (2.45, 0.30),
                     (2.33, 0.30), (2.33, 0.05)], "y", s * (H + 0.006), 0.012, "Accent")
    return part


def build_rear_wing():
    part = Part("RearWing")
    H = 0.475
    ys = span(H, 13)

    def q(y):
        return abs(y) / H
    wing(part, "Carbon", ys, lambda y: -2.25, lambda y: 0.775 - 0.02 * q(y) ** 4,
         lambda y: 0.23, lambda y: 8, t=0.12, camber=-0.04)
    wing(part, "Carbon", ys, lambda y: -2.455, lambda y: 0.838 - 0.02 * q(y) ** 4,
         lambda y: 0.16, lambda y: 22, t=0.11, camber=-0.04)
    wing(part, "Paint", ys, lambda y: -2.585, lambda y: 0.895 - 0.02 * q(y) ** 4,
         lambda y: 0.12, lambda y: 36, t=0.10, camber=-0.04)
    for s in (1, -1):
        prism(part, [(-2.21, 0.56), (-2.21, 0.88), (-2.31, 0.985), (-2.74, 0.985),
                     (-2.74, 0.72), (-2.52, 0.52)], "y", s * (H + 0.007), 0.012, "Accent")
        # small endplate rain-light strip
        box(part, (-2.752, s * (H + 0.007), 0.90), (0.006, 0.016, 0.12), "RainLight")
    # central swan-neck pillar from the crash structure to the main plane
    prism(part, [(-1.98, 0.42), (-2.14, 0.38), (-2.40, 0.80), (-2.26, 0.83)],
          "y", 0.0, 0.025, "Carbon")
    return part


def build_halo():
    part = Part("Halo")
    half = [(-0.02, 0.255, 0.58), (0.03, 0.265, 0.71), (0.18, 0.27, 0.795),
            (0.42, 0.25, 0.83), (0.62, 0.19, 0.84), (0.76, 0.09, 0.845)]
    ctrl = half + [(0.80, 0.0, 0.845)] + [(x, -y, z) for x, y, z in reversed(half)]
    tube(part, catmull(ctrl, sub=3), 0.026, "Halo", n=10, r2=0.020)
    tube(part, catmull([(0.80, 0.0, 0.845), (0.86, 0.0, 0.77), (0.95, 0.0, 0.65)], sub=3),
         0.024, "Halo", n=10, r2=0.016, chord_axis=(0, 1, 0))
    return part


def build_driver():
    part = Part("Driver")
    bm = part.bm
    ret = bmesh.ops.create_uvsphere(bm, u_segments=18, v_segments=12, radius=0.125)
    c = Vector((0.28, 0.0, 0.70))
    for v in ret["verts"]:
        v.co = Vector((v.co.x * 1.12, v.co.y * 0.95, v.co.z)) + c
    bm.normal_update()
    for f in bm.faces:
        fc = f.calc_center_median() - c
        n = fc.normalized()
        visor = n.x > 0.55 and -0.02 < fc.z < 0.055
        f.material_index = MI["Carbon" if visor else "Helmet"]
    # neck / shoulders block hidden in the cockpit
    box(part, (0.30, 0.0, 0.53), (0.22, 0.34, 0.12), "Carbon")
    return part


def build_suspension():
    part = Part("Suspension")
    for s in (1, -1):
        # front: double wishbone + pushrod + track rod
        yu = s * (FRONT_TRACK_Y - 0.10)
        up_u = (AX_F, yu, AXLE_Z + 0.16)
        up_l = (AX_F, yu, AXLE_Z - 0.15)
        bar(part, (1.97, s * 0.10, 0.42), up_u, "Carbon")
        bar(part, (1.45, s * 0.16, 0.56), up_u, "Carbon")
        bar(part, (2.02, s * 0.10, 0.22), up_l, "Carbon")
        bar(part, (1.42, s * 0.16, 0.19), up_l, "Carbon")
        bar(part, (AX_F - 0.03, s * (FRONT_TRACK_Y - 0.12), AXLE_Z - 0.12),
            (1.55, s * 0.13, 0.54), "Carbon", chord=0.035, thick=0.022)
        bar(part, (AX_F - 0.09, s * (FRONT_TRACK_Y - 0.11), AXLE_Z - 0.05),
            (1.60, s * 0.14, 0.31), "Carbon", chord=0.03, thick=0.014)
        box(part, (AX_F, s * (FRONT_TRACK_Y - 0.075), AXLE_Z), (0.10, 0.07, 0.34), "Carbon")
        # front brake duct drum
        tube(part, [(AX_F, s * (FRONT_TRACK_Y - 0.10), AXLE_Z),
                    (AX_F, s * (FRONT_TRACK_Y + 0.05), AXLE_Z)], 0.13, "Carbon", n=14)

        # rear: double wishbone + pullrod + toe link + driveshaft
        yr = s * (REAR_TRACK_Y - 0.13)
        ru = (AX_R, yr, AXLE_Z + 0.18)
        rl = (AX_R, yr, AXLE_Z - 0.16)
        bar(part, (-1.45, s * 0.20, 0.50), ru, "Carbon")
        bar(part, (-1.97, s * 0.11, 0.50), ru, "Carbon")
        bar(part, (-1.35, s * 0.22, 0.17), rl, "Carbon")
        bar(part, (-1.97, s * 0.11, 0.16), rl, "Carbon")
        bar(part, (AX_R + 0.05, s * (REAR_TRACK_Y - 0.14), AXLE_Z + 0.12),
            (-1.62, s * 0.15, 0.24), "Carbon", chord=0.035, thick=0.022)
        bar(part, (AX_R - 0.10, s * (REAR_TRACK_Y - 0.14), AXLE_Z + 0.02),
            (-1.95, s * 0.12, 0.34), "Carbon", chord=0.03, thick=0.014)
        tube(part, [(AX_R, s * 0.14, AXLE_Z), (AX_R, s * (REAR_TRACK_Y - 0.12), AXLE_Z)],
             0.032, "Carbon", n=8)
        box(part, (AX_R, s * (REAR_TRACK_Y - 0.11), AXLE_Z), (0.12, 0.08, 0.38), "Carbon")
        tube(part, [(AX_R, s * (REAR_TRACK_Y - 0.13), AXLE_Z),
                    (AX_R, s * (REAR_TRACK_Y + 0.05), AXLE_Z)], 0.13, "Carbon", n=14)
    return part


def build_wheel(name, center, half_w, side):
    part = Part(name, origin=center, sharp_deg=45.0)
    c = Vector(center)
    W = half_w
    tyre = [(0.228, 0.86 * W), (0.270, 0.97 * W), (0.315, 1.0 * W), (0.345, 0.95 * W),
            (0.357, 0.83 * W), (TYRE_R, 0.50 * W), (TYRE_R, -0.50 * W), (0.357, -0.83 * W),
            (0.345, -0.95 * W), (0.315, -1.0 * W), (0.270, -0.97 * W), (0.228, -0.86 * W)]
    lathe(part, [(r, y * side) for r, y in tyre], 28, "Tyre", center=c)
    Wb = 0.86 * W
    rim = [(RIM_R, Wb + 0.004), (0.205, Wb - 0.004), (0.150, Wb - 0.018), (0.085, Wb - 0.028),
           (0.085, -Wb + 0.03), (0.205, -Wb + 0.004), (RIM_R, -Wb - 0.004)]
    lathe(part, [(r, y * side) for r, y in rim], 28, "Rim", center=c)
    # hub + wheel nut
    tube(part, [c + Vector((0, side * (-Wb + 0.02), 0)), c + Vector((0, side * (Wb - 0.02), 0))],
         0.09, "Rim", n=16)
    tube(part, [c + Vector((0, side * (Wb - 0.03), 0)), c + Vector((0, side * (Wb + 0.012), 0))],
         0.038, "Carbon", n=12)
    return part


# --------------------------------------------------------------------------
# finalize / export
# --------------------------------------------------------------------------
def finalize(part):
    bm = part.bm
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        if len(e.link_faces) != 2:
            e.smooth = False
            continue
        a, b = e.link_faces
        if a.material_index != b.material_index:
            e.smooth = False
            continue
        e.smooth = e.calc_face_angle(0.0) < part.sharp
    me = bpy.data.meshes.new(part.name)
    bm.to_mesh(me)
    bm.free()
    for n in MAT_NAMES:
        me.materials.append(MATS[n])
    ob = bpy.data.objects.new(part.name, me)
    ob.location = part.origin
    bpy.context.scene.collection.objects.link(ob)
    return ob


def build_car():
    parts = [build_body(), build_front_wing(), build_rear_wing(), build_halo(),
             build_driver(), build_suspension()]
    for tag, x, y, w in (("FL", AX_F, FRONT_TRACK_Y, FRONT_HALF_W),
                         ("FR", AX_F, -FRONT_TRACK_Y, FRONT_HALF_W),
                         ("RL", AX_R, REAR_TRACK_Y, REAR_HALF_W),
                         ("RR", AX_R, -REAR_TRACK_Y, REAR_HALF_W)):
        parts.append(build_wheel("Wheel_" + tag, (x, y, AXLE_Z), w, 1 if y > 0 else -1))
    return [finalize(p) for p in parts]


def export_glb(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    kw = dict(filepath=path, export_format="GLB", use_selection=False, export_yup=True,
              export_apply=True, export_animations=False, export_cameras=False,
              export_lights=False, export_draco_mesh_compression_enable=False,
              export_materials="EXPORT", export_extras=False)
    try:
        bpy.ops.export_scene.gltf(**kw)
    except TypeError:
        for k in ("export_extras", "export_animations"):
            kw.pop(k, None)
        bpy.ops.export_scene.gltf(**kw)


def tri_count(objs):
    n = 0
    for ob in objs:
        for p in ob.data.polygons:
            n += len(p.vertices) - 2
    return n


# --------------------------------------------------------------------------
# preview renders (not exported)
# --------------------------------------------------------------------------
def look_at(ob, target):
    d = Vector(target) - ob.location
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def render_previews(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    scn = bpy.context.scene
    set_mat_color(MATS["Paint"], (0.75, 0.02, 0.02))
    set_mat_color(MATS["Accent"], (0.9, 0.9, 0.9))

    ground = bpy.data.materials.new("PreviewGround")
    set_mat_color(ground, (0.18, 0.18, 0.19))
    principled(ground).inputs["Roughness"].default_value = 0.8
    me = bpy.data.meshes.new("Ground")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=40)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(ground)
    g = bpy.data.objects.new("Ground", me)
    g.location.z = -0.001
    scn.collection.objects.link(g)

    sun_d = bpy.data.lights.new("Sun", "SUN")
    sun_d.energy = 4.0
    sun_d.angle = math.radians(8)
    sun = bpy.data.objects.new("Sun", sun_d)
    sun.rotation_euler = (math.radians(40), math.radians(15), math.radians(-35))
    scn.collection.objects.link(sun)

    world = bpy.data.worlds.new("PreviewWorld")
    scn.world = world
    try:
        world.use_nodes = True
    except Exception:
        pass
    bg = world.node_tree.nodes.get("Background") if world.node_tree else None
    if bg:
        bg.inputs[0].default_value = (0.55, 0.6, 0.68, 1.0)
        bg.inputs[1].default_value = 0.9
    world.color = (0.55, 0.6, 0.68)

    for eng in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT", "BLENDER_WORKBENCH"):
        try:
            scn.render.engine = eng
            break
        except TypeError:
            continue
    scn.render.resolution_x, scn.render.resolution_y = 1280, 720
    scn.render.resolution_percentage = 100
    scn.render.image_settings.file_format = "PNG"
    if scn.render.engine == "BLENDER_WORKBENCH":
        scn.display.shading.light = "STUDIO"
        scn.display.shading.color_type = "MATERIAL"
        scn.display.shading.show_shadows = True

    cam_d = bpy.data.cameras.new("Cam")
    cam = bpy.data.objects.new("Cam", cam_d)
    scn.collection.objects.link(cam)
    scn.camera = cam
    views = {
        "threequarter": ((5.2, -4.2, 1.9), (0.1, 0.0, 0.35), 40),
        "side": ((0.0, -10.5, 0.75), (0.0, 0.0, 0.45), 45),
        "chase": ((-9.0, 1.2, 2.6), (0.0, 0.0, 0.4), 40),
        "top": ((0.0, 0.0, 14.0), (0.0, 0.0, 0.0), 75),
        "front": ((7.0, 0.0, 0.7), (0.0, 0.0, 0.45), 38),
    }
    for name, (loc, tgt, lens) in views.items():
        cam.location = Vector(loc)
        cam_d.lens = lens
        if name == "top":
            cam.rotation_euler = (0.0, 0.0, 0.0)
        else:
            look_at(cam, tgt)
        scn.render.filepath = os.path.join(out_dir, "car_preview_%s.png" % name)
        bpy.ops.render.render(write_still=True)
        print("preview:", scn.render.filepath)


# --------------------------------------------------------------------------
def main():
    reset_scene()
    make_materials()
    objs = build_car()
    print("objects:", len(objs), "triangles:", tri_count(objs))
    export_glb(OUT_GLB)
    print("exported:", OUT_GLB, os.path.getsize(OUT_GLB), "bytes")
    if PREVIEW_DIR:
        render_previews(PREVIEW_DIR)


main()
