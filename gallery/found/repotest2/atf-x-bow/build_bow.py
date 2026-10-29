"""
ATF-X recurve bow  --  Blender 5.x build + render script.

World axes used here:
    +Z  up  (riser runs vertically)
    +Y  toward the target (the "back" of the bow)
    -Y  toward the archer (the "belly")
    +X  sideways (riser thickness / limb width)

Geometry is modelled from the WIAWIS ATF-X product photos:
  * 25" aluminium riser, skeletal "anti-torsional 45 degree cross" lattice
  * deep sight window on the upper half, black outer frame over a red core
  * ILF dovetail limb pockets with T-block hardware at both ends
"""

import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector

OUT = os.path.dirname(os.path.abspath(__file__))
RENDER_DIR = os.path.join(OUT, "renders")
os.makedirs(RENDER_DIR, exist_ok=True)

TAU = math.pi * 2.0
ZTOP = 0.3175          # riser top   (25" = 0.635 m)
ZBOT = -0.3175         # riser bottom
LIMB_LEN = 0.737       # -> ~68" bow
LIMB_ANGLE = math.radians(11.0)


# ----------------------------------------------------------------------------
# scene helpers
# ----------------------------------------------------------------------------
def wipe():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def link(ob):
    bpy.context.collection.objects.link(ob)
    return ob


def new_mesh_obj(name, verts, faces):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    me.validate(verbose=False)
    me.update()
    ob = bpy.data.objects.new(name, me)
    return link(ob)


def deselect():
    for o in bpy.context.scene.objects:
        o.select_set(False)


def set_active(ob):
    deselect()
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob


def apply_mods(ob):
    set_active(ob)
    for m in list(ob.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=m.name)
        except Exception as exc:                      # pragma: no cover
            print("  ! modifier %s failed on %s: %s" % (m.name, ob.name, exc))
            ob.modifiers.remove(m)
    return ob


def boolean(target, cutter, operation="DIFFERENCE"):
    m = target.modifiers.new(name="bool_" + cutter.name, type="BOOLEAN")
    m.operation = operation
    m.object = cutter
    m.solver = "EXACT"
    if hasattr(m, "use_self"):
        m.use_self = True
    apply_mods(target)
    bpy.data.objects.remove(cutter, do_unlink=True)
    return target


def overlap_join(objects):
    """Join meshes by hand (never touches ops selection state)."""
    bm = bmesh.new()
    for ob in objects:
        bm.from_mesh(ob.data)
    me = bpy.data.meshes.new("joined")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("joined", me)
    link(ob)
    for src in objects:
        bpy.data.objects.remove(src, do_unlink=True)
    return ob


def shade_smooth(ob, angle=38.0):
    set_active(ob)
    if hasattr(ob.data, "use_auto_smooth"):          # Blender <= 4.0
        bpy.ops.object.shade_smooth()
        ob.data.use_auto_smooth = True
        ob.data.auto_smooth_angle = math.radians(angle)
        return
    try:                                             # Blender >= 4.1
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle))
    except Exception as exc:
        print("  ! shade_smooth_by_angle failed: %s" % exc)
        bpy.ops.object.shade_smooth()


# ----------------------------------------------------------------------------
# materials
# ----------------------------------------------------------------------------
def mat(name, base, rough=0.4, metal=0.0, coat=0.0, emis=None):
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*base, 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    for key, val in (("Coat Weight", coat), ("Coat Roughness", 0.08)):
        if key in b.inputs:
            b.inputs[key].default_value = val
    if emis is not None and "Emission Color" in b.inputs:
        b.inputs["Emission Color"].default_value = (*emis, 1.0)
        b.inputs["Emission Strength"].default_value = 0.25
    return m


def build_materials():
    return {
        "frame":  mat("Frame_GraphiteBlack", (0.035, 0.036, 0.040), 0.42, 0.55, 0.25),
        "core":   mat("Core_AnodisedRed", (0.470, 0.030, 0.030), 0.30, 0.70),
        "limb":   mat("Limb_MatteBlack", (0.028, 0.028, 0.031), 0.52),
        "grip":   mat("Grip_Rubber", (0.022, 0.022, 0.024), 0.72),
        "metal":  mat("Hardware_Steel", (0.560, 0.575, 0.595), 0.22, 1.00),
        "string": mat("String_BCY", (0.055, 0.052, 0.046), 0.80),
        "serve":  mat("String_Serving", (0.600, 0.480, 0.140), 0.65),
        "logo":   mat("Logo_White", (0.880, 0.885, 0.890), 0.35),
    }


# ----------------------------------------------------------------------------
# riser profile
# ----------------------------------------------------------------------------
# (s, depth offset of the tube axis, half width, half depth)
PROFILE = [
    (0.000, 0.0460, 0.0154, 0.0242),
    (0.040, 0.0400, 0.0156, 0.0245),
    (0.085, 0.0240, 0.0153, 0.0238),
    (0.135, 0.0040, 0.0148, 0.0228),
    (0.200, -0.0110, 0.0142, 0.0216),
    (0.265, -0.0165, 0.0139, 0.0210),
    (0.325, -0.0110, 0.0141, 0.0214),
    (0.390, 0.0055, 0.0146, 0.0224),
    (0.450, 0.0175, 0.0132, 0.0222),
    (0.510, 0.0115, 0.0152, 0.0238),
    (0.575, -0.0050, 0.0148, 0.0228),
    (0.640, -0.0250, 0.0154, 0.0242),
    (0.700, -0.0410, 0.0156, 0.0247),
    (0.760, -0.0495, 0.0155, 0.0242),
    (0.820, -0.0480, 0.0153, 0.0233),
    (0.880, -0.0350, 0.0156, 0.0238),
    (0.940, -0.0195, 0.0154, 0.0244),
    (1.000, -0.0100, 0.0155, 0.0250),
]


def lerp(a, b, t):
    return a + (b - a) * t


def pchip(t, table):
    """Monotone-ish cubic (Catmull-Rom clamped) interpolation over a table."""
    xs = [r[0] for r in table]
    n = len(table)
    if t <= xs[0]:
        return table[0][1:]
    if t >= xs[-1]:
        return table[-1][1:]
    i = 0
    while i < n - 2 and t > xs[i + 1]:
        i += 1
    h = xs[i + 1] - xs[i]
    u = (t - xs[i]) / h
    p0 = table[max(i - 1, 0)][1:]
    p1 = table[i][1:]
    p2 = table[i + 1][1:]
    p3 = table[min(i + 2, n - 1)][1:]
    out = []
    for k in range(len(p1)):
        m1 = (p2[k] - p0[k]) * 0.5
        m2 = (p3[k] - p1[k]) * 0.5
        h00 = 2 * u ** 3 - 3 * u ** 2 + 1
        h10 = u ** 3 - 2 * u ** 2 + u
        h01 = -2 * u ** 3 + 3 * u ** 2
        h11 = u ** 3 - u ** 2
        out.append(h00 * p1[k] + h10 * m1 * h + h01 * p2[k] + h11 * m2 * h)
    return out


def riser_at(s):
    """s in [0,1] top->bottom -> (axis_y, half_x, half_y)."""
    s = min(max(s, 0.0), 1.0)
    dy, hx, hy = pchip(s, PROFILE)
    return dy, hx, hy


def riser_z(s):
    return lerp(ZTOP, ZBOT, s)


def corner_points(hx, hy, r):
    """Rounded-rectangle outline, CCW in (x, y), returns n points."""
    r = min(r, hx * 0.92, hy * 0.92)
    pts = []
    # corner arcs: 4 corners, 3 samples each + straight edges
    arcs = [
        (hx - r, hy - r, 0.0),
        (-hx + r, hy - r, math.pi * 0.5),
        (-hx + r, -hy + r, math.pi),
        (hx - r, -hy + r, math.pi * 1.5),
    ]
    for cx, cy, a0 in arcs:
        for k in range(4):
            a = a0 + (math.pi * 0.5) * (k / 3.0)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def riser_loft(samples=90, r_frac=0.30):
    """Return verts/faces of the lofted riser tube (no ends capped yet)."""
    rings = []
    for i in range(samples):
        s = i / (samples - 1.0)
        dy, hx, hy = riser_at(s)
        z = riser_z(s)
        pts = corner_points(hx, hy, min(hx, hy) * r_frac)
        rings.append([(px, dy + py, z) for px, py in pts])
    n = len(rings[0])
    verts = [v for ring in rings for v in ring]
    faces = []
    for i in range(len(rings) - 1):
        a = i * n
        b = (i + 1) * n
        for j in range(n):
            k = (j + 1) % n
            faces.append((a + j, a + k, b + k, b + j))
    return verts, faces, rings


# ----------------------------------------------------------------------------
# lattice
# ----------------------------------------------------------------------------
def surface_point(s, face, u, v):
    """
    Map a lattice coordinate onto the riser skin.

    face: 'front' | 'back' | 'side'
    u    : 0..1 along the length (s)
    v    : -1..1 across the face (x for front/back, y for side)
    Returns (x, y, z) placed slightly outside the skin.
    """
    dy, hx, hy = riser_at(u)
    z = riser_z(u)
    if face == "front":
        return (v * hx, dy + hy, z)
    if face == "back":
        return (-v * hx, dy - hy, z)
    # side (+X when v==1)
    return (v * hx, dy + v * 0.0 + (0.0), z) if False else (v * hx, dy, z)


def face_normal(face, v=0.0):
    if face == "front":
        return Vector((0.0, 1.0, 0.0))
    if face == "back":
        return Vector((0.0, -1.0, 0.0))
    return Vector((1.0 if v >= 0 else -1.0, 0.0, 0.0))


def face_point(s, face, v):
    dy, hx, hy = riser_at(s)
    z = riser_z(s)
    if face == "front":
        return Vector((v * hx, dy + hy, z))
    if face == "back":
        return Vector((-v * hx, dy - hy, z))
    if face == "right":
        return Vector((hx, dy + v * hy, z))
    return Vector((-hx, dy + v * hy, z))


def box_from_segment(p0, p1, normal, half_w, out, deep):
    """Build a box strut from p0->p1, widened along `normal`, sunk `deep` inside."""
    d = (p1 - p0)
    if d.length < 1e-6:
        return None, None
    d.normalize()
    side = normal.normalized()
    n = side.cross(d).normalized()
    if n.length < 1e-6:
        return None, None
    verts = []
    for p in (p0, p1):
        base = p - side * deep
        verts.append(base + n * half_w)
        verts.append(base - n * half_w)
        verts.append(base + n * half_w + side * (out + deep))
        verts.append(base - n * half_w + side * (out + deep))
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 2, 6, 4),
             (1, 5, 7, 3), (0, 4, 5, 1), (2, 3, 7, 6)]
    return verts, faces


def build_ribs(levels, diag_u=0.88, rib_w=5.2e-3, rib_out=1.4e-3, rib_deep=4.0e-3):
    """
    Rails around all four corners + diagonal X struts on the front and back
    faces, and vertical struts on the sides.  Everything sinks `rib_deep`
    into the body so the final INTERSECT welds it into one solid.
    """
    parts = []
    half = rib_w * 0.5
    # --- rails: continuous along the full length at the four corner edges ---
    # corner "v" coordinates on the rounded rect
    corners = {
        ("front", 1.0): ("back", 1.0),
    }
    rail_defs = [
        # (face, v) pairs that meet at a corner -> build one rail per corner
        (("front", 1.0), ("back", 1.0)),
        (("front", -1.0), ("back", -1.0)),
    ]
    # front/back corner rails (run along the length at x = +-hx)
    for v in (1.0, -1.0):
        pts = [face_point(i / 40.0, "front", v * 0.86) for i in range(41)]
        for i in range(len(pts) - 1):
            n = Vector((0.9 * v, 0.45, 0.0)).normalized()
            vv, ff = box_from_segment(pts[i], pts[i + 1], n, half * 0.9, rib_out, rib_deep)
            if vv:
                parts.append((vv, ff))
    # side rails at y = +-hy
    for v in (1.0, -1.0):
        for face in ("right", "left"):
            pts = [face_point(i / 40.0, face, v * 0.80) for i in range(41)]
            for i in range(len(pts) - 1):
                n = Vector((0.0, v, 0.0))
                vv, ff = box_from_segment(pts[i], pts[i + 1], n, half * 0.9, rib_out, rib_deep)
                if vv:
                    parts.append((vv, ff))

    # --- diagonal struts: front and back faces, alternating X pattern ---
    for face in ("front", "back"):
        for lv in range(levels):
            u0 = lv / levels
            u1 = (lv + 1) / levels
            um = 0.5 * (u0 + u1)
            up = (u1 - u0) * diag_u
            if lv % 2 == 0:
                segs = [(u0, 1.0, u1, -1.0), (u0, -1.0, u1, 1.0)]
            else:
                segs = [(u0, 1.0, um, -1.0), (um, -1.0, u1, 1.0),
                        (u0, -1.0, um, 1.0), (um, 1.0, u1, -1.0)]
            for a_u, a_v, b_u, b_v in segs:
                a = face_point(a_u, face, a_v * 0.94)
                b = face_point(b_u, face, b_v * 0.94)
                nrm = face_normal(face)
                vv, ff = box_from_segment(a, b, nrm, half, rib_out, rib_deep)
                if vv:
                    parts.append((vv, ff))
        # horizontal band between levels keeps the lattice readable
        for lv in range(1, levels):
            u = lv / levels
            a = face_point(u - 0.012, face, -0.94)
            b = face_point(u + 0.012, face, 0.94)
            vv, ff = box_from_segment(a, b, face_normal(face), half * 1.1, rib_out, rib_deep)
            if vv:
                parts.append((vv, ff))

    # --- side struts: verticals down each side ---
    for face in ("right", "left"):
        for lv in range(levels + 1):
            u = lv / levels
            u = min(max(u, 0.012), 0.988)
            a = face_point(u - 0.010, face, -0.86)
            b = face_point(u + 0.010, face, 0.86)
            vv, ff = box_from_segment(a, b, face_normal(face), half * 0.95, rib_out, rib_deep)
            if vv:
                parts.append((vv, ff))
    return parts


# ----------------------------------------------------------------------------
# riser sub-parts
# ----------------------------------------------------------------------------
def cap_loft(verts, faces, rings):
    """Cap the first and last ring with a fan to a centre vertex."""
    n = len(rings[0])
    top_c = Vector((0, 0, 0))
    for v in rings[0]:
        top_c += Vector(v)
    top_c /= n
    bot_c = Vector((0, 0, 0))
    for v in rings[-1]:
        bot_c += Vector(v)
    bot_c /= n
    i_top = len(verts)
    verts.append(tuple(top_c))
    i_bot = len(verts)
    verts.append(tuple(bot_c))
    last = (len(rings) - 1) * n
    for j in range(n):
        k = (j + 1) % n
        faces.append((i_top, k, j))
        faces.append((i_bot, last + j, last + k))
    return verts, faces


def build_riser(mat_frame, mat_core):
    verts, faces, rings = riser_loft(samples=110)
    cap_loft(verts, faces, rings)
    body = new_mesh_obj("RiserBody", verts, faces)

    # lattice ribs
    parts = build_ribs(levels=9)
    lattice = overlap_join([new_mesh_obj("rib_%d" % i, v, f) for i, (v, f) in enumerate(parts)])
    body = boolean(body, lattice, "INTERSECT")

    # sight window: a deep scoop on the archer side of the upper riser
    cut_v, cut_f = box_prim((0.0, -0.040, 0.235), (0.0095, 0.052, 0.115))
    body = boolean(body, new_mesh_obj("SightWindow", cut_v, cut_f), "DIFFERENCE")

    # shelf / arrow pass
    cut_v, cut_f = box_prim((0.0, 0.004, 0.176), (0.011, 0.030, 0.016))
    body = boolean(body, new_mesh_obj("Shelf", cut_v, cut_f), "DIFFERENCE")

    shade_smooth(body)
    body.data.materials.append(mat_frame)

    # red inner core, a slightly smaller loft that shows through the windows
    cverts, cfaces, crings = riser_loft(samples=90)
    core = new_mesh_obj("RiserCore", cverts, cfaces)
    core.scale = (0.60, 0.86, 0.995)
    set_active(core)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    # push the core back to where the riser axis is
    for v in core.data.vertices:
        s = (ZTOP - v.co.z) / (ZTOP - ZBOT)
        v.co.y += riser_at(s)[0] * 0.14
    shade_smooth(core)
    core.data.materials.append(mat_core)
    return body, core


def box_prim(center, half):
    cx, cy, cz = center
    hx, hy, hz = half
    v = [(cx - hx, cy - hy, cz - hz), (cx + hx, cy - hy, cz - hz),
         (cx + hx, cy + hy, cz - hz), (cx - hx, cy + hy, cz - hz),
         (cx - hx, cy - hy, cz + hz), (cx + hx, cy - hy, cz + hz),
         (cx + hx, cy + hy, cz + hz), (cx - hx, cy + hy, cz + hz)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
         (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return v, f


def cyl_prim(center, axis, radius, height, segs=20):
    cx, cy, cz = center
    ax = Vector(axis).normalized()
    up = Vector((0, 0, 1)) if abs(ax.z) < 0.9 else Vector((1, 0, 0))
    e1 = ax.cross(up).normalized()
    e2 = ax.cross(e1).normalized()
    c = Vector(center)
    verts = []
    for k in (-0.5, 0.5):
        for i in range(segs):
            a = TAU * i / segs
            verts.append(tuple(c + ax * (k * height) + e1 * (radius * math.cos(a)) + e2 * (radius * math.sin(a))))
    faces = []
    for i in range(segs):
        j = (i + 1) % segs
        faces.append((i, j, segs + j, segs + i))
    faces.append(tuple(range(segs - 1, -1, -1)))
    faces.append(tuple(range(segs, segs * 2)))
    return verts, faces


def build_hardware(mat_metal):
    """ILF pocket hardware: limb bolts, T-block screws, rest + plunger."""
    obs = []
    dy_top, _, _ = riser_at(0.0)
    dy_bot, _, _ = riser_at(1.0)
    items = [
        # top limb bolt (axis along X, sticking out of the side of the pocket)
        ((0.0, dy_top - 0.004, ZTOP - 0.030), (0.0, -1.0, 0.10), 0.0080, 0.0110),
        # bottom limb bolt
        ((0.0, dy_bot + 0.004, ZBOT + 0.030), (0.0, 1.0, -0.10), 0.0080, 0.0110),
        # T-block screws on the sides of each pocket
        ((0.0165, dy_top + 0.004, ZTOP - 0.052), (1, 0, 0), 0.0055, 0.0040),
        ((-0.0165, dy_top + 0.004, ZTOP - 0.052), (-1, 0, 0), 0.0055, 0.0040),
        ((0.0165, dy_bot - 0.004, ZBOT + 0.052), (1, 0, 0), 0.0055, 0.0040),
        ((-0.0165, dy_bot - 0.004, ZBOT + 0.052), (-1, 0, 0), 0.0055, 0.0040),
    ]
    for i, (c, ax, r, h) in enumerate(items):
        v, f = cyl_prim(c, ax, r, h, 18)
        obs.append(new_mesh_obj("hw_%d" % i, v, f))

    # arrow rest arm (right hand, +X shelf)
    v, f = box_prim((0.0125, 0.006, 0.178), (0.0035, 0.016, 0.0022))
    obs.append(new_mesh_obj("rest_arm", v, f))
    v, f = cyl_prim((0.0215, -0.006, 0.184), (0, 0, 1), 0.0032, 0.011, 14)
    obs.append(new_mesh_obj("rest_pin", v, f))
    # plunger button
    v, f = cyl_prim((0.0150, 0.000, 0.172), (1, 0, 0), 0.0052, 0.016, 16)
    obs.append(new_mesh_obj("plunger", v, f))
    # sight block bolts
    v, f = cyl_prim((0.0155, -0.036, 0.245), (1, 0, 0), 0.0034, 0.006, 12)
    obs.append(new_mesh_obj("sight_bolt_a", v, f))
    v, f = cyl_prim((0.0155, -0.036, 0.205), (1, 0, 0), 0.0034, 0.006, 12)
    obs.append(new_mesh_obj("sight_bolt_b", v, f))

    ob = overlap_join(obs)
    ob.data.materials.append(mat_metal)
    return ob


def build_grip(mat_grip):
    """Simple locator grip mass -- explicitly not a hero part."""
    verts, faces, rings = riser_loft(samples=40)
    g = new_mesh_obj("Grip", verts, faces)
    # keep only the grip band region by scaling + clipping
    bm = bmesh.new()
    bm.from_mesh(g.data)
    for v in bm.verts:
        if v.co.z > 0.005 or v.co.z < -0.135:
            v.co = (0, 0, 0)
    bm.to_mesh(g.data)
    bm.free()
    bpy.data.objects.remove(g, do_unlink=True)

    # build the grip as its own loft slice
    sub = []
    for i in range(41):
        s = lerp(0.575, 0.700, i / 40.0)
        dy, hx, hy = riser_at(s)
        z = riser_z(s)
        pts = corner_points(hx * 1.06 + 0.0045, hy * 1.02 + 0.004, 0.007)
        sub.append([(px, dy + py - 0.004, z) for px, py in pts])
    n = len(sub[0])
    vv = [v for r in sub for v in r]
    ff = []
    for i in range(len(sub) - 1):
        a, b = i * n, (i + 1) * n
        for j in range(n):
            k = (j + 1) % n
            ff.append((a + j, a + k, b + k, b + j))
    ff.append(tuple(range(n - 1, -1, -1)))
    last = (len(sub) - 1) * n
    ff.append(tuple(range(last, last + n)))
    ob = new_mesh_obj("Grip", vv, ff)
    shade_smooth(ob, 45)
    ob.data.materials.append(mat_grip)
    return ob


# ----------------------------------------------------------------------------
# limbs
# ----------------------------------------------------------------------------
LIMB_CTRL = [
    # (t, forward offset, half width, half thickness)
    (0.00, 0.0000, 0.0190, 0.00380),
    (0.10, 0.0032, 0.0192, 0.00370),
    (0.22, 0.0080, 0.0186, 0.00340),
    (0.36, 0.0130, 0.0172, 0.00295),
    (0.50, 0.0158, 0.0156, 0.00255),
    (0.63, 0.0150, 0.0138, 0.00220),
    (0.75, 0.0112, 0.0118, 0.00190),
    (0.85, 0.0055, 0.0098, 0.00165),
    (0.92, 0.0005, 0.0082, 0.00150),
    (0.965, -0.0060, 0.0070, 0.00145),
    (0.99, -0.0128, 0.0060, 0.00145),
    (1.00, -0.0170, 0.0054, 0.00145),
]


def limb_at(t):
    return pchip(t, LIMB_CTRL)


def build_limb(name, root, sign, mat_limb):
    """sign = +1 for the top limb, -1 for the bottom."""
    zdir = float(sign)
    ca, sa = math.cos(LIMB_ANGLE), math.sin(LIMB_ANGLE)
    rings = []
    SEG = 44
    for i in range(SEG + 1):
        t = i / float(SEG)
        fy, hx, ht = limb_at(t)
        # local frame: up is +z*dir, back is -y
        ly = fy
        lz = t * LIMB_LEN
        # rotate about x so the limb tips lean toward the archer (-y)
        ry = ly * ca - lz * sa
        rz = ly * sa + lz * ca
        y = root[1] + ry * 1.0
        z = root[2] + rz * zdir
        pts = corner_points(hx, ht, min(hx, ht) * 0.42)
        rings.append([(px, y + py, z) for px, py in pts])
    n = len(rings[0])
    verts = [v for r in rings for v in r]
    faces = []
    for i in range(len(rings) - 1):
        a, b = i * n, (i + 1) * n
        for j in range(n):
            k = (j + 1) % n
            faces.append((a + j, a + k, b + k, b + j))
    cap_loft(verts, faces, rings)
    ob = new_mesh_obj(name, verts, faces)
    shade_smooth(ob, 40)
    ob.data.materials.append(mat_limb)

    # limb tip nock: a small slot block
    tip_y, tip_z = tip_position(sign)
    v, f = box_prim((0.0, tip_y + 0.006, tip_z), (0.0075, 0.010, 0.0125))
    tip = new_mesh_obj(name + "_tip", v, f)
    v2, f2 = cyl_prim((0.0, tip_y - 0.002, tip_z + 0.020 * 1.0), (0, 1, 0), 0.0030, 0.016, 12)
    tip2 = new_mesh_obj(name + "_tip2", v2, f2)
    ob = overlap_join([ob, tip, tip2])
    shade_smooth(ob, 40)
    return ob


def tip_position(sign):
    """Nock point of a limb, in world space."""
    ca, sa = math.cos(LIMB_ANGLE), math.sin(LIMB_ANGLE)
    fy, _, _ = limb_at(1.0)
    lz = LIMB_LEN
    ry = fy * ca - lz * sa
    rz = fy * sa + lz * ca
    root = limb_root(sign)
    return root[1] + ry, root[2] + rz * float(sign)


def limb_root(sign):
    if sign > 0:
        dy, _, _ = riser_at(0.0)
        return (0.0, dy - 0.006, ZTOP - 0.062)
    dy, _, _ = riser_at(1.0)
    return (0.0, dy + 0.006, ZBOT + 0.062)


# ----------------------------------------------------------------------------
# string
# ----------------------------------------------------------------------------
def build_string(mat_string, mat_serve):
    (ty, tz), (by, bz) = tip_position(1), tip_position(-1)
    a = Vector((0.0, ty - 0.0020, tz + 0.004))
    b = Vector((0.0, by - 0.0020, bz - 0.004))

    def strand(off_x, off_y, r):
        v = []
        n = 2
        for i in range(2):
            p = a.lerp(b, float(i))
            v.append((p.x + off_x, p.y + off_y, p.z))
        f = [(0, 1)]
        return v, f

    strands = []
    N = 14
    ring = 0.0026
    for i in range(N):
        ang = TAU * i / N
        ox = ring * math.cos(ang) * 0.9
        oy = ring * math.sin(ang) * 0.55
        v, f = strand(ox, oy, 0.0011)
        strands.append((v, f))
    # build as a bundle of thin cylinders instead of edges
    obs = []
    for i, (v, f) in enumerate(strands):
        p0 = Vector(v[0])
        p1 = Vector(v[1])
        c = p0.lerp(p1, 0.5)
        d = p1 - p0
        cv, cf = cyl_prim(tuple(c), tuple(d.normalized()), 0.00095, d.length, 6)
        obs.append(new_mesh_obj("str_%d" % i, cv, cf))
    bundle = overlap_join(obs)
    bundle.data.materials.append(mat_string)

    # centre serving
    cs = a.lerp(b, 0.5)
    v, f = cyl_prim(tuple(cs), tuple((b - a).normalized()), 0.0044, 0.150, 18)
    serve = new_mesh_obj("Serving", v, f)
    shade_smooth(serve)
    serve.data.materials.append(mat_serve)

    return overlap_join([bundle, serve])


# ----------------------------------------------------------------------------
# logo (simple extruded text, best effort)
# ----------------------------------------------------------------------------
def build_text(body, txt, size, thickness, extrude, mat, rot=(0, 0, 0)):
    try:
        cu = bpy.data.curves.new(type="FONT", name="txt_" + txt)
        cu.body = txt
        cu.size = size
        cu.extrude = extrude
        cu.align_x = "CENTER"
        cu.align_y = "CENTER"
        ob = bpy.data.objects.new("txt_" + txt, cu)
        link(ob)
        ob.rotation_euler = rot
        set_active(ob)
        bpy.ops.object.convert(target="MESH")
        ob = bpy.context.view_layer.objects.active
        ob.data.materials.append(mat)
        return ob
    except Exception as exc:
        print("  ! text '%s' skipped: %s" % (txt, exc))
        return None


# ----------------------------------------------------------------------------
# lighting / camera / render
# ----------------------------------------------------------------------------
def setup_world(strength=1.0):
    world = bpy.data.worlds.new("W")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.055, 0.058, 0.065, 1.0)
    bg.inputs[1].default_value = strength


def add_area(name, loc, rot, size, energy, color=(1, 1, 1)):
    d = bpy.data.lights.new(name, type="AREA")
    d.energy = energy
    d.size = size
    d.color = color
    ob = bpy.data.objects.new(name, d)
    link(ob)
    ob.location = loc
    ob.rotation_euler = rot
    return ob


def setup_lights():
    add_area("Key", (1.5, 2.0, 1.3), (math.radians(58), 0, math.radians(150)), 2.4, 900,
             (1.0, 0.97, 0.92))
    add_area("Fill", (-2.0, 1.2, -0.2), (math.radians(88), 0, math.radians(-125)), 3.0, 320,
             (0.80, 0.86, 1.0))
    add_area("Rim", (-1.2, -2.2, 1.6), (math.radians(64), 0, math.radians(-28)), 2.0, 700,
             (0.90, 0.94, 1.0))
    add_area("Front", (0.4, -2.4, -0.6), (math.radians(95), 0, math.radians(8)), 2.6, 260)


def add_backdrop():
    v, f = box_prim((0.0, -0.30, -0.05), (3.0, 0.02, 1.6))
    ob = new_mesh_obj("Backdrop", v, f)
    m = mat("Backdrop", (0.10, 0.105, 0.115), 0.85)
    ob.data.materials.append(m)
    v2, f2 = box_prim((0.0, 0.0, -1.35), (3.0, 3.0, 0.02))
    fl = new_mesh_obj("Floor", v2, f2)
    fl.data.materials.append(mat("Floor", (0.055, 0.058, 0.065), 0.55))
    return ob


def setup_camera(shot):
    cam_d = bpy.data.cameras.new("Cam")
    cam = bpy.data.objects.new("Cam", cam_d)
    link(cam)
    bpy.context.scene.camera = cam
    if shot == "side":
        cam_d.type = "ORTHO"
        cam_d.ortho_scale = 2.15
        cam.location = (-3.0, -0.05, 0.0)
        cam.rotation_euler = (math.radians(90), 0, math.radians(-90))
    elif shot == "hero":
        cam_d.type = "PERSP"
        cam_d.lens = 62
        cam.location = (-1.30, -0.95, 0.22)
        cam.rotation_euler = (math.radians(86), 0, math.radians(-56))
    elif shot == "detail":
        cam_d.type = "PERSP"
        cam_d.lens = 85
        cam.location = (-0.42, -0.30, 0.40)
        cam.rotation_euler = (math.radians(80), 0, math.radians(-52))
    return cam


def use_gpu():
    """Render on the Radeon via Cycles-HIP."""
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "HIP"
        prefs.refresh_devices()
        gpu = None
        for d in prefs.devices:
            if d.type == "HIP":
                d.use = True
                gpu = d
            elif d.type == "CPU":
                d.use = False
        sc = bpy.context.scene
        sc.cycles.device = "GPU"
        print("GPU:", gpu.name if gpu else "none")
        return True
    except Exception as exc:
        print("! GPU unavailable (%s); falling back to CPU" % exc)
        bpy.context.scene.cycles.device = "CPU"
        return False


def render(shot, res=(1100, 1700), samples=48):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    use_gpu()
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = "OPENIMAGEDENOISE"
    except Exception:
        pass
    sc.cycles.max_bounces = 6
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    names = [t.name for t in sc.view_settings.bl_rna.properties["view_transform"].enum_items]
    sc.view_settings.view_transform = "Filmic" if "Filmic" in names else "Standard"
    sc.view_settings.look = "None"
    path = os.path.join(RENDER_DIR, shot + ".png")
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("RENDERED", path)
    return path


# ----------------------------------------------------------------------------
# main
# ----------------------------------------------------------------------------
def main():
    wipe()
    mats = build_materials()
    setup_world()
    setup_lights()
    add_backdrop()

    body, core = build_riser(mats["frame"], mats["core"])
    grip = build_grip(mats["grip"])
    hw = build_hardware(mats["metal"])

    top = build_limb("LimbTop", limb_root(1), 1, mats["limb"])
    bot = build_limb("LimbBot", limb_root(-1), -1, mats["limb"])
    string = build_string(mats["string"], mats["serve"])

    # logos
    txts = []
    t = build_text(body, "WIAWIS", 0.022, 0.004, 0.0016, mats["logo"],
                   rot=(math.radians(90), 0, math.radians(90)))
    if t:
        t.location = (-0.0165, riser_at(0.10)[0] - 0.002, 0.185)
        txts.append(t)
    t = build_text(body, "ATF-X", 0.020, 0.004, 0.0016, mats["core"],
                   rot=(math.radians(90), 0, math.radians(90)))
    if t:
        t.location = (0.0162, riser_at(0.80)[0] + 0.002, -0.205)
        txts.append(t)

    print("PARTS: riser=%d verts" % len(body.data.vertices))

    for shot in ("side", "hero", "detail"):
        setup_camera(shot)
        render(shot, res=(1100, 1700) if shot == "side" else (1400, 1100),
               samples=40 if shot == "side" else 56)

    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "atf_x_bow.blend"))
    print("SAVED blend")


if __name__ == "__main__":
    main()
