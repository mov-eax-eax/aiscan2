"""
Stage 1 -- procedural body form for an Xbox-style wireless controller.

Approach
--------
A gamepad shell is an organic, moulded solid, so rather than sculpting we build
it parametrically in three steps:

  1. OUTLINE.  A closed top-down silhouette, traced from reference photography,
     built as a periodic Catmull-Rom spline and then non-uniformly scaled so it
     measures exactly 152.9 x 101.9 mm (the published controller dimensions).

  2. CROSS-SECTIONS.  For every row y we intersect the outline to get the inside
     interval(s).  Note this yields TWO intervals low down, where the notch
     between the two grips begins -- handled naturally.  Each interval becomes a
     rounded-rectangle cross-section in x-z, which is what a real moulded shell
     looks like (flat-ish top and bottom, generous corner radii) -- unlike an
     ellipse, which would pinch to a knife-edge at the silhouette boundary.

  3. FUSE.  Emit cells as a closed quad solid, then voxel-remesh to a single
     watertight surface.  The remesh is what makes it read as one moulded piece
     instead of stacked parts, and it also erases the stair-stepping inherent in
     sampling the outline on a grid.

Everything is in millimetres; scene unit scale is set so that is honest.
Uncomment DEBUG_MASK to print an ASCII silhouette for checking the outline.
"""

import math
import os
import sys
import time

import bpy
import bmesh
import numpy as np
from mathutils import Vector

# ----------------------------------------------------------------------------
# Parameters
# ----------------------------------------------------------------------------
TARGET_W = 152.9          # mm, overall width
TARGET_D = 101.9          # mm, overall front-to-back depth
GRID = 0.6                # mm, sampling pitch for the solid
VOXEL = 0.90              # mm, remesh voxel size
SMOOTH_ITERS = 3
SMOOTH_FACTOR = 0.5
DEBUG_MASK = True

OUT_DIR = r"F:\repotest2\secretmodel1\renders"
BLEND_OUT = r"F:\repotest2\secretmodel1\build\stage1_body.blend"

# Top-down outline: right-hand side, traced from top-centre down to bottom-centre.
# x > 0. Values are pre-normalisation; build_outline() rescales to TARGET_*.
CTRL_RIGHT = [
    (0.0,   51.0), (17.0,  50.5), (32.0,  49.2), (44.0,  46.8),
    (53.5,  43.2), (61.0,  38.4), (66.6,  32.6), (70.9,  26.0),
    (74.2,  18.8), (76.3,  11.2), (77.5,   3.0), (77.9,  -5.5),
    (77.3, -14.0), (75.9, -22.0), (73.8, -29.5), (70.9, -36.5),
    (67.1, -42.6), (62.3, -47.4), (56.4, -50.6), (49.8, -52.0),
    (43.2, -51.2), (37.8, -48.6), (33.8, -44.4), (31.2, -39.2),
    (29.7, -34.0), (28.9, -30.2), (27.6, -28.6), (23.5, -27.8),
    (17.5, -27.3), ( 9.5, -27.0), ( 0.0, -26.9),
]

# Longitudinal profiles, sampled at these y values (must be increasing).
Y_CTRL = [-52, -45, -38, -30, -22, -12,   0,  12,  24,  34,  42,  48,  51]
# Top surface height of the body at the row centre.
T_CTRL = [ 18,  22,  25,  27,  28, 29.5, 30,  31, 31.5, 31.5, 29,  26,  23]
# Bottom surface height at the row centre (0 == resting on the table).
B_CTRL = [  4,   1,   0,   0,   1,   2,   2,   2,   2,   3,   5,   8,  11]
# Corner radius fraction of the cross-section, as a fraction of min(half_w, half_h).
R_FRAC = 0.58
# Gentle parabolic crown across each section. A dead-flat top face makes the
# shell read as a slab; the real moulding is subtly domed across its width.
CROWN = 2.2


# ----------------------------------------------------------------------------
# Outline construction
# ----------------------------------------------------------------------------
def catmull_rom_closed(points, per_seg=14):
    """Periodic Catmull-Rom through `points` (N,2) -> dense closed loop."""
    p = np.asarray(points, dtype=float)
    n = len(p)
    out = []
    for i in range(n):
        p0 = p[(i - 1) % n]
        p1 = p[i]
        p2 = p[(i + 1) % n]
        p3 = p[(i + 2) % n]
        for s in range(per_seg):
            t = s / per_seg
            t2, t3 = t * t, t * t * t
            pt = 0.5 * ((2 * p1) + (-p0 + p2) * t
                        + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                        + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
            out.append(pt)
    return np.array(out)


def build_outline():
    """Closed outline scaled to exactly TARGET_W x TARGET_D, centred on origin."""
    right = np.array(CTRL_RIGHT, dtype=float)
    left = right[::-1].copy()
    left[:, 0] *= -1.0
    loop_ctrl = np.vstack([right, left[1:-1]])          # drop duplicated poles

    loop = catmull_rom_closed(loop_ctrl)

    xmin, ymin = loop.min(axis=0)
    xmax, ymax = loop.max(axis=0)
    sx = TARGET_W / (xmax - xmin)
    sy = TARGET_D / (ymax - ymin)
    loop[:, 0] = (loop[:, 0] - (xmin + xmax) / 2.0) * sx
    loop[:, 1] = (loop[:, 1] - (ymin + ymax) / 2.0) * sy
    return loop


def row_intervals(loop, y):
    """x-intervals of the outline interior on the horizontal line y."""
    xs = []
    n = len(loop)
    for i in range(n):
        x1, y1 = loop[i]
        x2, y2 = loop[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            t = (y - y1) / (y2 - y1)
            xs.append(x1 + t * (x2 - x1))
    xs.sort()
    return [(xs[i], xs[i + 1]) for i in range(0, len(xs) - 1, 2)]


def section_z(x, xa, xb, zt_c, zb_c, r_frac=R_FRAC):
    """Rounded-rectangle cross-section with a gentle crown. Returns (z_top, z_bottom)."""
    xc = 0.5 * (xa + xb)
    hw = 0.5 * (xb - xa)
    m = 0.5 * (zt_c + zb_c)
    hh = max(0.05, 0.5 * (zt_c - zb_c))
    r = min(r_frac * min(hw, hh), hw, hh)
    xr = abs(x - xc)
    t = min(1.0, xr / max(hw, 1e-6))
    crown = CROWN * (1.0 - t * t)
    if xr <= hw - r:
        return m + hh + crown, m - hh
    dx = xr - (hw - r)
    dz = math.sqrt(max(0.0, r * r - dx * dx))
    frac = dz / max(r, 1e-6)
    return m + (hh - r) + dz + crown * frac, m - (hh - r) - dz


def well_compose(inside, iters=12):
    """Force the binary region to be 'well composed'.

    Rasterising a smooth outline produces 2x2 checkerboard patterns and
    one-node-wide tendrils. Those make the resulting voxel surface non-manifold
    (edges shared by 4 faces), which in turn makes recalc_face_normals produce
    an inconsistent winding, and OpenVDB then reconstructs a near-zero-thickness
    volume -- i.e. garbage. A region with no checkerboards and no node having
    fewer than two 4-neighbours has a guaranteed 2-manifold boundary.

    Mutates `inside` in place and returns it.
    """
    nx, ny = inside.shape
    for _ in range(iters):
        changed = False

        # 1. drop spikes / one-wide tendrils
        nb = np.zeros_like(inside, dtype=np.int16)
        nb[1:, :] += inside[:-1, :]
        nb[:-1, :] += inside[1:, :]
        nb[:, 1:] += inside[:, :-1]
        nb[:, :-1] += inside[:, 1:]
        bad = inside & (nb < 2)
        if bad.any():
            inside[bad] = False
            changed = True

        # 2. resolve checkerboards (erase the diagonal pair)
        a = inside[:-1, :-1].copy()
        b = inside[1:, :-1].copy()
        c = inside[:-1, 1:].copy()
        d = inside[1:, 1:].copy()
        cb1 = a & d & ~b & ~c
        cb2 = b & c & ~a & ~d
        ii, jj = np.nonzero(cb1)
        for i, j in zip(ii, jj):
            inside[i, j] = False
            inside[i + 1, j + 1] = False
        ii, jj = np.nonzero(cb2)
        for i, j in zip(ii, jj):
            inside[i + 1, j] = False
            inside[i, j + 1] = False
        if len(ii) or cb1.any():
            changed = True

        if not changed:
            break
    return inside


# ----------------------------------------------------------------------------
# Solid construction
# ----------------------------------------------------------------------------
def build_body_mesh(loop):
    xmin, xmax = -TARGET_W / 2 - 2, TARGET_W / 2 + 2
    ymin, ymax = -TARGET_D / 2 - 2, TARGET_D / 2 + 2
    nx = int((xmax - xmin) / GRID) + 1
    ny = int((ymax - ymin) / GRID) + 1
    xs = np.linspace(xmin, xmax, nx)
    ys = np.linspace(ymin, ymax, ny)

    inside = np.zeros((nx, ny), dtype=bool)
    ztop = np.zeros((nx, ny))
    zbot = np.zeros((nx, ny))

    n_intervals = 0
    for j in range(ny):
        y = ys[j]
        if y < Y_CTRL[0] or y > Y_CTRL[-1]:
            continue
        ivs = row_intervals(loop, y)
        if not ivs:
            continue
        zt_c = float(np.interp(y, Y_CTRL, T_CTRL))
        zb_c = float(np.interp(y, Y_CTRL, B_CTRL))
        n_intervals = max(n_intervals, len(ivs))
        for (xa, xb) in ivs:
            i0 = int(np.searchsorted(xs, xa))
            i1 = int(np.searchsorted(xs, xb))
            for i in range(max(0, i0), min(nx, i1 + 1)):
                x = xs[i]
                if x < xa or x > xb:
                    continue
                zt, zb = section_z(x, xa, xb, zt_c, zb_c)
                inside[i, j] = True
                ztop[i, j] = zt
                zbot[i, j] = zb

    n_before = int(inside.sum())
    well_compose(inside)
    print(f"[topology] well-composed: {n_before} -> {int(inside.sum())} nodes")

    if DEBUG_MASK:
        print(f"[outline] max simultaneous intervals per row: {n_intervals}")
        step = max(1, nx // 96)
        print("--- silhouette preview (inside = #) ---")
        for j in range(0, ny, step * 2):
            print(f"{ys[j]:7.1f} " + "".join(
                "#" if inside[i, j] else "." for i in range(0, nx, step)))

    # ---- emit quads -------------------------------------------------------
    vidx = {}

    def vid(i, j, layer):
        key = (i, j, layer)
        k = vidx.get(key)
        if k is None:
            k = len(vidx)
            vidx[key] = k
        return k

    # Cell-level occupancy. A quad exists only where ALL FOUR corner nodes are
    # inside, so walls must be decided against `cell`, not `inside`. Testing the
    # per-node array instead is always true for a cell's own corners, which makes
    # the code skip walls that were never emitted -> an open, leaky surface.
    cell = (inside[:-1, :-1] & inside[1:, :-1]
            & inside[1:, 1:] & inside[:-1, 1:])
    print(f"[mesh] nodes={int(inside.sum())} cells={int(cell.sum())}")

    faces = []
    for j in range(ny - 1):
        for i in range(nx - 1):
            if not cell[i, j]:
                continue
            a = vid(i, j, 1); b = vid(i + 1, j, 1)
            c = vid(i + 1, j + 1, 1); d = vid(i, j + 1, 1)
            faces.append((a, b, c, d))                     # top
            a = vid(i, j, 0); b = vid(i + 1, j, 0)
            c = vid(i + 1, j + 1, 0); d = vid(i, j + 1, 0)
            faces.append((d, c, b, a))                     # bottom

            # Walls, checked in all four directions against neighbouring CELLS.
            for di, dj, e0, e1 in (
                (1, 0, (i + 1, j), (i + 1, j + 1)),   # +x
                (-1, 0, (i, j), (i, j + 1)),          # -x
                (0, 1, (i, j + 1), (i + 1, j + 1)),   # +y
                (0, -1, (i, j), (i + 1, j)),          # -y
            ):
                ni, nj = i + di, j + dj
                if 0 <= ni < nx - 1 and 0 <= nj < ny - 1 and cell[ni, nj]:
                    continue
                faces.append((vid(e0[0], e0[1], 1), vid(e1[0], e1[1], 1),
                              vid(e1[0], e1[1], 0), vid(e0[0], e0[1], 0)))

    verts = [None] * len(vidx)
    for (i, j, layer), k in vidx.items():
        z = ztop[i, j] if layer == 1 else zbot[i, j]
        verts[k] = (float(xs[i]), float(ys[j]), float(z))

    print(f"[mesh] verts={len(verts)} faces={len(faces)}")
    return verts, faces


def make_object(name, verts, faces):
    me = bpy.data.meshes.new(name)
    n_emit = len(faces)
    me.from_pydata(verts, [], faces)
    n_pre = len(me.polygons)
    me.validate(verbose=False)
    n_post = len(me.polygons)
    print(f"[mesh:validate] emitted={n_emit} from_pydata={n_pre} "
          f"after_validate={n_post}  LOST={n_emit - n_post}")
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)

    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    me.update()
    return ob


def apply_all_modifiers(ob):
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=m.name)
        except Exception as e:
            print(f"[warn] could not apply {m.name}: {e}")


def refine(ob):
    rm = ob.modifiers.new("remesh", 'REMESH')
    rm.mode = 'VOXEL'
    rm.voxel_size = VOXEL
    apply_all_modifiers(ob)
    report_dims(ob, f"after remesh(voxel={VOXEL})")

    sm = ob.modifiers.new("smooth", 'SMOOTH')
    sm.factor = SMOOTH_FACTOR
    sm.iterations = SMOOTH_ITERS
    apply_all_modifiers(ob)
    report_dims(ob, f"after smooth(it={SMOOTH_ITERS})")

    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.shade_smooth()
    return ob


# ----------------------------------------------------------------------------
# Scene / render
# ----------------------------------------------------------------------------
def look_at(cam, target):
    d = Vector(target) - cam.location
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def use_gpu():
    """Send Cycles to the discrete GPU, falling back to CPU quietly.

    Blender will happily render on the CPU forever unless told otherwise, which
    is ruinous for iteration. On this machine the Radeon is exposed as a HIP
    device.
    """
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        for dt in ('HIP', 'OPTIX', 'CUDA', 'ONEAPI'):
            try:
                prefs.compute_device_type = dt
                prefs.refresh_devices()
                gpus = [d for d in prefs.devices if d.type != 'CPU']
                if not gpus:
                    continue
                for d in prefs.devices:
                    d.use = (d.type != 'CPU')
                bpy.context.scene.cycles.device = 'GPU'
                print(f"[gpu] {dt}: {[d.name for d in gpus]}")
                return True
            except Exception:
                continue
    except Exception as e:
        print("[gpu] setup error:", e)
    bpy.context.scene.cycles.device = 'CPU'
    print("[gpu] CPU fallback")
    return False


def setup_scene():
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 40
    sc.cycles.use_denoising = True
    use_gpu()
    sc.render.resolution_x = 820
    sc.render.resolution_y = 640
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = 'PNG'
    sc.unit_settings.system = 'METRIC'
    sc.unit_settings.scale_length = 0.001

    world = bpy.data.worlds.new("W")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.155, 0.170, 0.190, 1.0)
    bg.inputs[1].default_value = 1.0
    sc.world = world

    def add_light(name, loc, energy, size):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.size = size
        o = bpy.data.objects.new(name, ld)
        o.location = loc
        sc.collection.objects.link(o)
        look_at(o, (0, 0, 15))
        return o

    # Big soft key plus two rims: on a near-black gloss shell the rim lights are
    # what actually describe the silhouette, so they carry real energy here.
    add_light("key",  (150, -190, 250), 1100000, 300)
    add_light("fill", (-260, -110, 120), 240000, 320)
    add_light("rimL", (-170, 220, 190), 620000, 240)
    add_light("rimR", (200, 200, 170), 520000, 240)
    add_light("top",  (0, 40, 330), 380000, 320)

    mat = bpy.data.materials.new("body_preview")
    mat.use_nodes = True
    b = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (0.035, 0.036, 0.040, 1.0)
    b.inputs['Roughness'].default_value = 0.52
    return mat


def render_views(ob):
    sc = bpy.context.scene
    cam_d = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cam_d)
    sc.collection.objects.link(cam)
    sc.camera = cam
    os.makedirs(OUT_DIR, exist_ok=True)

    views = [
        ("top",   'ORTHO', (0, 0, 320),      (0, 0, 15), 178),
        ("side",  'ORTHO', (320, 0, 16),     (0, 0, 16), 120),
        ("front", 'ORTHO', (0, 320, 16),     (0, 0, 16), 178),
        ("hero",  'PERSP', (215, -215, 170), (0, 0, 14), 0),
    ]
    for name, ctype, loc, tgt, oscale in views:
        cam_d.type = ctype
        cam.location = Vector(loc)
        if ctype == 'ORTHO':
            cam_d.ortho_scale = oscale
        else:
            cam_d.lens = 62
        look_at(cam, tgt)
        sc.render.filepath = os.path.join(OUT_DIR, f"stage1_{name}.png")
        t0 = time.time()
        bpy.ops.render.render(write_still=True)
        print(f"[render] {name}: {time.time()-t0:.1f}s -> {sc.render.filepath}")


def check_watertight(ob):
    """Break down edge valence. 0 bad == closed manifold."""
    counts = {}
    me = ob.data
    for p in me.polygons:
        vs = list(p.vertices)
        n = len(vs)
        for k in range(n):
            a, b = vs[k], vs[(k + 1) % n]
            e = (a, b) if a < b else (b, a)
            counts[e] = counts.get(e, 0) + 1
    hist = {}
    for c in counts.values():
        hist[c] = hist.get(c, 0) + 1
    bad = sum(v for k, v in hist.items() if k != 2)
    print(f"[check] edges={len(counts)}  valence_histogram={dict(sorted(hist.items()))}")
    print(f"[check] nonmanifold_or_boundary={bad}")

    # Where are the open edges? Report their extent so we can localise the bug.
    if bad:
        co = [v.co[:] for v in me.vertices]
        pts = []
        for e, c in counts.items():
            if c != 2:
                pts.append(co[e[0]])
        pts = np.array(pts)
        print(f"[check] open-edge bbox X[{pts[:,0].min():.1f},{pts[:,0].max():.1f}] "
              f"Y[{pts[:,1].min():.1f},{pts[:,1].max():.1f}] "
              f"Z[{pts[:,2].min():.1f},{pts[:,2].max():.1f}]")
    return bad


def report_dims(ob, label=""):
    vs = np.array([v.co[:] for v in ob.data.vertices])
    mn, mx = vs.min(axis=0), vs.max(axis=0)
    d = mx - mn
    print(f"[dims:{label}] X(width)={d[0]:.1f}  Y(depth)={d[1]:.1f}  "
          f"Z(height)={d[2]:.1f} mm  (target {TARGET_W} x {TARGET_D})")
    print(f"[dims:{label}] faces={len(ob.data.polygons)} "
          f"verts={len(ob.data.vertices)}")


def remesh_sweep():
    """Diagnostic: how does REMESH voxel_size actually map to resolution?"""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    loop = build_outline()
    verts, faces = build_body_mesh(loop)
    for vsz in (6.0, 4.0, 2.0, 1.5, 1.0, 0.7, 0.5):
        ob = make_object(f"b{int(vsz*10)}", verts, faces)
        rm = ob.modifiers.new("remesh", 'REMESH')
        rm.mode = 'VOXEL'
        rm.voxel_size = vsz
        extra = {p: getattr(rm, p) for p in
                 ('adaptivity', 'use_smooth_shade', 'use_remove_disconnected')
                 if hasattr(rm, p)}
        print(f"--- request voxel_size={vsz}  set->{rm.voxel_size}  {extra}")
        apply_all_modifiers(ob)
        report_dims(ob, f"v{vsz}")
        bpy.data.objects.remove(ob, do_unlink=True)
    print("[sweep] done")


def diag_only():
    """Build the raw solid and audit it, with no rendering."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    loop = build_outline()
    verts, faces = build_body_mesh(loop)
    ob = make_object("body", verts, faces)
    check_watertight(ob)
    report_dims(ob, "raw")


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mat = setup_scene()

    loop = build_outline()
    verts, faces = build_body_mesh(loop)
    ob = make_object("body", verts, faces)
    check_watertight(ob)
    report_dims(ob, "raw")
    refine(ob)
    ob.data.materials.append(mat)
    report_dims(ob, "final")
    render_views(ob)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)
    print("[done] saved", BLEND_OUT)


if __name__ == "__main__":
    _argv = sys.argv
    _rest = _argv[_argv.index("--"):] if "--" in _argv else []
    if "sweep" in _rest:
        remesh_sweep()
    elif "diag" in _rest:
        diag_only()
    else:
        main()
