"""
Stage 2 -- controls and materials for the Xbox-style controller.

Builds on stage 1's watertight shell, then adds:
  * dished wells cut into the shell (stick recesses, ABXY dish)
  * two analogue sticks (revolved: concave cap + knurled rim + shaft)
  * the D-pad cross
  * four domed ABXY buttons in the Xbox colour scheme
  * guide / view / menu / share buttons
  * bumpers swept along the shell's top edge, plus triggers behind them
  * PBR materials: speckled matte shell, rubber sticks, glossy button caps

Everything is millimetres.
"""

import math
import os
import sys
import time

import bpy
import bmesh
import numpy as np
from mathutils import Vector, Matrix

sys.path.insert(0, r"F:\repotest2\secretmodel1\build")
import stage1_body as S1

OUT_DIR = r"F:\repotest2\secretmodel1\renders"
BLEND_OUT = r"F:\repotest2\secretmodel1\build\stage2_controller.blend"

# ---------------------------------------------------------------------------
# Layout (mm). +Y is towards the bumper/top edge, +Z is up.
# ---------------------------------------------------------------------------
STICK_L = (-40.0, 15.0)
STICK_R = (18.0, -8.0)
STICK_WELL_R = 19.0
STICK_WELL_DEPTH = 2.6

ABXY_C = (42.0, 15.0)
ABXY_PITCH = 13.6
ABXY_R = 6.8

DPAD_C = (-40.0, -13.0)
DPAD_ARM = 13.0
DPAD_HALFW = 5.0

GUIDE_C = (0.0, 33.0)
GUIDE_R = 7.4

VIEW_C = (-14.5, 16.0)
MENU_C = (14.5, 16.0)
SHARE_C = (0.0, 8.0)

BUTTON_COLOURS = {
    'Y': (0.85, 0.72, 0.02),
    'X': (0.02, 0.28, 0.85),
    'B': (0.80, 0.05, 0.03),
    'A': (0.10, 0.72, 0.05),
}


# ---------------------------------------------------------------------------
# Mesh helpers
# ---------------------------------------------------------------------------
def link(me_name, verts, faces, weld=0.01):
    me = bpy.data.meshes.new(me_name)
    me.from_pydata(verts, [], faces)
    me.validate(verbose=False)
    bm = bmesh.new()
    bm.from_mesh(me)
    if weld:
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=weld)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    me.update()
    ob = bpy.data.objects.new(me_name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def solid_of_revolution(profile, segments=80, name="rev"):
    """Revolve a closed (r, z) profile around the Z axis."""
    n = len(profile)
    verts, faces = [], []
    for s in range(segments):
        a = 2.0 * math.pi * s / segments
        ca, sa = math.cos(a), math.sin(a)
        for (r, z) in profile:
            verts.append((r * ca, r * sa, z))
    for s in range(segments):
        s2 = (s + 1) % segments
        for k in range(n):
            k2 = (k + 1) % n
            faces.append((s * n + k, s * n + k2, s2 * n + k2, s2 * n + k))
    return link(name, verts, faces)


def uv_sphere(name, radius, segs=48, rings=24):
    verts, faces = [], []
    for i in range(1, rings):
        phi = math.pi * i / rings
        for j in range(segs):
            th = 2 * math.pi * j / segs
            verts.append((radius * math.sin(phi) * math.cos(th),
                          radius * math.sin(phi) * math.sin(th),
                          radius * math.cos(phi)))
    top = len(verts); verts.append((0, 0, radius))
    bot = len(verts); verts.append((0, 0, -radius))
    for i in range(rings - 2):
        for j in range(segs):
            j2 = (j + 1) % segs
            a = i * segs + j; b = i * segs + j2
            c = (i + 1) * segs + j2; d = (i + 1) * segs + j
            faces.append((a, b, c, d))
    for j in range(segs):
        j2 = (j + 1) % segs
        faces.append((top, j2, j))
        faces.append((bot, (rings - 2) * segs + j, (rings - 2) * segs + j2))
    return link(name, verts, faces, weld=0.0)


def rounded_rect_poly(w, h, r, seg=6):
    """Rounded rectangle outline in 2D, CCW."""
    pts = []
    cx, cy = w / 2 - r, h / 2 - r
    for (sx, sy, a0) in ((cx, cy, 0.0), (-cx, cy, math.pi / 2),
                         (-cx, -cy, math.pi), (cx, -cy, 3 * math.pi / 2)):
        for k in range(seg + 1):
            a = a0 + (math.pi / 2) * k / seg
            pts.append((sx + r * math.cos(a), sy + r * math.sin(a)))
    return pts


def prism_from_poly(poly, thickness, dome=0.0, name="prism"):
    """Extrude a 2D polygon in Z with an optional domed top (fan to centre)."""
    n = len(poly)
    verts = [(x, y, 0.0) for (x, y) in poly]
    verts += [(x, y, -thickness) for (x, y) in poly]
    faces = []
    if dome > 0.0:
        cxi = len(verts)
        cx = sum(p[0] for p in poly) / n
        cy = sum(p[1] for p in poly) / n
        verts.append((cx, cy, dome))
        for k in range(n):
            faces.append((cxi, (k + 1) % n, k))
    else:
        faces.append(tuple(range(n))[::-1])
    for k in range(n):
        k2 = (k + 1) % n
        faces.append((k, k2, n + k2, n + k))
    faces.append(tuple(range(n, 2 * n)))
    return link(name, verts, faces, weld=0.0)


def sweep_tube(path, radius=1.0, name="tube", segs=20, caps=True,
               radius_v=None, closed=False, profile=None):
    """Sweep a section along a 3D polyline.

    `profile` is a list of (u, v) offsets in the local frame and overrides the
    elliptical section. A real bumper is a flat-topped paddle, not a rod, so the
    bumpers pass a rounded-rectangle profile. `closed=True` stitches the last
    ring back to the first, which is what a groove running right around the
    shell needs.
    """
    rv = radius if radius_v is None else radius_v
    p = [Vector(q) for q in path]
    n = len(p)
    if profile is None:
        profile = [(radius * math.cos(2 * math.pi * k / segs),
                    rv * math.sin(2 * math.pi * k / segs)) for k in range(segs)]
    nseg = len(profile)

    rings = []
    up = Vector((0, 0, 1))
    for i in range(n):
        if closed:
            t = (p[(i + 1) % n] - p[(i - 1) % n])
        elif i == 0:
            t = (p[1] - p[0])
        elif i == n - 1:
            t = (p[-1] - p[-2])
        else:
            t = (p[i + 1] - p[i - 1])
        t.normalize()
        ref = up if abs(t.dot(up)) < 0.95 else Vector((1, 0, 0))
        u = t.cross(ref).normalized()
        v = t.cross(u).normalized()
        rings.append([p[i] + u * a + v * b for (a, b) in profile])

    verts = [tuple(q) for ring in rings for q in ring]
    faces = []
    last = n if closed else n - 1
    for i in range(last):
        i2 = (i + 1) % n
        for k in range(nseg):
            k2 = (k + 1) % nseg
            faces.append((i * nseg + k, i * nseg + k2,
                          i2 * nseg + k2, i2 * nseg + k))
    if caps and not closed:
        faces.append(tuple(range(nseg))[::-1])
        faces.append(tuple(range((n - 1) * nseg, n * nseg)))
    return link(name, verts, faces, weld=0.0)


def box(name, sx, sy, sz, bevel=1.2, bseg=3):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector((sx, sy, sz)), verts=bm.verts)
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges) + list(bm.verts),
                        offset=bevel, segments=bseg, profile=0.5,
                        affect='EDGES')
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def apply_mods(ob):
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=m.name)
        except Exception as e:
            print(f"[warn] {ob.name}/{m.name}: {e}")


# ---------------------------------------------------------------------------
# Materials
# ---------------------------------------------------------------------------
def make_mat(name, color, rough, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*color, 1.0)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    return m


def make_shell_mat():
    """Matte black with the fine speckle/grain of the real moulded shell."""
    m = bpy.data.materials.new("shell")
    m.use_nodes = True
    nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (0.020, 0.021, 0.023, 1.0)
    b.inputs['Roughness'].default_value = 0.47

    tc = nt.nodes.new('ShaderNodeTexCoord')
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 320.0
    noise.inputs['Detail'].default_value = 6.0
    noise.inputs['Roughness'].default_value = 0.7

    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.42
    ramp.color_ramp.elements[0].color = (0.013, 0.014, 0.016, 1)
    ramp.color_ramp.elements[1].position = 0.62
    ramp.color_ramp.elements[1].color = (0.052, 0.054, 0.058, 1)

    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.18
    bump.inputs['Distance'].default_value = 0.06

    nt.links.new(tc.outputs['Object'], noise.inputs['Vector'])
    nt.links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    nt.links.new(noise.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    return m


def make_rubber_mat():
    """Stick rubber: dark, rough, with a knurled cross-hatch."""
    m = bpy.data.materials.new("rubber")
    m.use_nodes = True
    nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (0.016, 0.016, 0.017, 1.0)
    b.inputs['Roughness'].default_value = 0.78

    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1.0, 1.0, 6.0)
    wave = nt.nodes.new('ShaderNodeTexWave')
    wave.inputs['Scale'].default_value = 26.0
    wave.inputs['Distortion'].default_value = 1.5
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.55
    bump.inputs['Distance'].default_value = 0.35

    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], wave.inputs['Vector'])
    nt.links.new(wave.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    return m


TEX_DIR = r"F:\repotest2\secretmodel1\build\tex"


def add_planar_uv(ob, radius):
    """Project UVs straight down onto the button cap.

    The buttons are solids of revolution centred on their local origin, so a
    top-down planar projection needs no unwrapping at all: the cap picks up the
    glyph squarely, and the skirt (which is buried in the well) just samples the
    flat colour around the texture border.
    """
    me = ob.data
    if not me.uv_layers:
        me.uv_layers.new(name="UVMap")
    uv = me.uv_layers.active.data
    inv = 1.0 / (2.0 * radius)
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv[li].uv = (co.x * inv + 0.5, co.y * inv + 0.5)


def make_glyph_mat(name, img_path, rough, fallback_color):
    """Glyph material; degrades to a flat colour if the texture is missing."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Roughness'].default_value = rough
    if os.path.exists(img_path):
        tex = nt.nodes.new('ShaderNodeTexImage')
        img = bpy.data.images.load(img_path, check_existing=True)
        try:
            img.pack()          # keep the texture inside the .blend
        except Exception:
            pass
        tex.image = img
        tex.interpolation = 'Cubic'
        nt.links.new(tex.outputs['Color'], b.inputs['Base Color'])
    else:
        print(f"[glyph] MISSING {img_path} -- flat colour fallback")
        b.inputs['Base Color'].default_value = (*fallback_color, 1.0)
    return m


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
def add_well(body, x, y, z_surface, radius, depth, name):
    """Cut a BOUNDED shallow dish into the shell.

    A plain sphere is the wrong cutter. To get a shallow dish of radius r and
    depth d the sphere must be huge (R = (r^2 + d^2) / 2d -- about 71 mm for a
    19 mm wide, 2.6 mm deep recess). That sphere has radius r only exactly at
    z_surface; wherever the shell sits lower it is much wider, so it scoops a
    crater out of the grip. Instead the cutter is explicitly bounded: a cylinder
    of exactly `radius`, closed underneath by the spherical cap that forms the
    dish, and extended upwards so it always clears the shell.
    """
    R = (radius * radius + depth * depth) / (2.0 * depth)
    prof = []
    N = 28
    for k in range(N + 1):
        r = radius * k / N
        dz = R - math.sqrt(max(0.0, R * R - r * r))
        prof.append((r, z_surface - depth + dz))

    # Rounded lip. The dish meets its rim at only ~14 degrees, so without this
    # the cutter's vertical wall crosses the near-horizontal shell top as a
    # knife edge and the recess reads as a hard moulding crease rather than a
    # radiused lip. Fillet from the dish tangent round to vertical.
    rf = 1.5
    nx, nz = radius / R, (depth - R) / R          # dish outward normal at rim
    cx, cz = radius - rf * nx, z_surface - rf * nz
    th0 = math.atan2(nz, nx)
    M = 8
    for k in range(1, M + 1):
        th = th0 * (1.0 - k / M)
        prof.append((cx + rf * math.cos(th), cz + rf * math.sin(th)))

    top = z_surface + 80.0
    prof.append((radius - rf * nx + rf, top))
    prof.append((0.0, top))

    cut = solid_of_revolution(prof, segments=80, name=name)
    cut.location = (x, y, 0.0)
    bpy.context.view_layer.update()
    md = body.modifiers.new(f"cut_{name}", 'BOOLEAN')
    md.operation = 'DIFFERENCE'
    md.object = cut
    try:
        md.solver = 'EXACT'
    except Exception:
        pass
    apply_mods(body)
    bpy.data.objects.remove(cut, do_unlink=True)


def add_parting_seam(body, loop, radius=0.62, name="seam"):
    """Cut the mould parting line that runs right around the shell.

    The two halves of a real shell meet at the widest point of the section --
    the 'equator' at z = (top + bottom) / 2 -- so the groove is swept along the
    outline at exactly that height. Inset a hair so the cutter is centred on the
    surface rather than hovering just outside it, and closed so it joins up.
    """
    pts = []
    for k in range(0, len(loop), 5):
        x, y = loop[k]
        yc = float(np.clip(y, S1.Y_CTRL[0], S1.Y_CTRL[-1]))
        m = 0.5 * (float(np.interp(yc, S1.Y_CTRL, S1.T_CTRL)) +
                   float(np.interp(yc, S1.Y_CTRL, S1.B_CTRL)))
        pts.append((float(x) * 0.9965, float(y) * 0.9965, m))

    tube = sweep_tube(pts, radius, name=name, segs=12, closed=True)
    md = body.modifiers.new("cut_seam", 'BOOLEAN')
    md.operation = 'DIFFERENCE'
    md.object = tube
    try:
        md.solver = 'EXACT'
    except Exception:
        pass
    apply_mods(body)
    bpy.data.objects.remove(tube, do_unlink=True)
    print(f"[seam] {len(pts)} pts, radius {radius}")


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)

    loop = S1.build_outline()
    verts, faces = S1.build_body_mesh(loop)
    body = S1.make_object("shell", verts, faces)
    S1.check_watertight(body)
    S1.refine(body)
    S1.report_dims(body, "shell")

    def top_z(x, y):
        ivs = S1.row_intervals(loop, y)
        zt_c = float(np.interp(y, S1.Y_CTRL, S1.T_CTRL))
        zb_c = float(np.interp(y, S1.Y_CTRL, S1.B_CTRL))
        best = None
        for (xa, xb) in ivs:
            if xa <= x <= xb:
                zt, _ = S1.section_z(x, xa, xb, zt_c, zb_c)
                best = zt if best is None else max(best, zt)
        return best

    # ---- wells ------------------------------------------------------------
    for i, (sx, sy) in enumerate((STICK_L, STICK_R)):
        z = top_z(sx, sy)
        add_well(body, sx, sy, z, STICK_WELL_R, STICK_WELL_DEPTH, f"well_stick{i}")
    ax, ay = ABXY_C
    add_well(body, ax, ay, top_z(ax, ay), 18.0, 2.2, "well_abxy")
    add_parting_seam(body, loop)

    objs = {}

    # ---- sticks -----------------------------------------------------------
    # Real stick: narrower cap, a deep concave dish with a raised rim, and only
    # ~4 mm of shaft showing above the well. The previous profile gave a wide
    # flat puck with 7.5 mm of bare shaft under it.
    prof = [
        (0.0, 0.0), (6.5, 0.0), (6.5, 4.6),
        (11.0, 4.6), (12.4, 5.4), (12.4, 10.0), (11.9, 11.6),
        (10.3, 12.6), (4.0, 11.2), (0.0, 8.0),
    ]
    for i, (sx, sy) in enumerate((STICK_L, STICK_R)):
        z0 = top_z(sx, sy) - STICK_WELL_DEPTH - 0.5
        st = solid_of_revolution(prof, segments=96, name=f"stick{i}")
        st.location = (sx, sy, z0)
        objs[f"stick{i}"] = st

    # ---- D-pad ------------------------------------------------------------
    A, W = DPAD_ARM, DPAD_HALFW
    poly = [(W, A), (-W, A), (-W, W), (-A, W), (-A, -W), (-W, -W),
            (-W, -A), (W, -A), (W, -W), (A, -W), (A, W), (W, W)]
    # The cross is CONCAVE. It must NOT be fanned from its centroid -- the fan
    # triangles spill outside the outline and the D-pad turns into an arrow
    # blob. Keep the top as an n-gon and round the edges with a bevel.
    dp = prism_from_poly(poly, 5.4, dome=0.0, name="dpad")
    bv = dp.modifiers.new("bev", 'BEVEL')
    bv.width = 1.2
    bv.segments = 3
    bv.limit_method = 'ANGLE'
    apply_mods(dp)
    # prism_from_poly spans z in [-thickness, +dome]; +1.0 puts the top face
    # just proud of the shell instead of buried 1.2 mm inside it.
    dp.location = (DPAD_C[0], DPAD_C[1], top_z(*DPAD_C) + 1.0)
    objs['dpad'] = dp

    # ---- ABXY -------------------------------------------------------------
    btn_prof = [(0.0, 0.0), (ABXY_R, 0.0), (ABXY_R, 1.4), (6.1, 3.4),
                (3.4, 4.4), (0.0, 4.8)]
    for lab, (dx, dy) in (('Y', (0, ABXY_PITCH)), ('X', (-ABXY_PITCH, 0)),
                          ('B', (ABXY_PITCH, 0)), ('A', (0, -ABXY_PITCH))):
        x, y = ABXY_C[0] + dx, ABXY_C[1] + dy
        b = solid_of_revolution(btn_prof, segments=64, name=f"btn_{lab}")
        b.location = (x, y, top_z(x, y) - 2.4)
        objs[f'btn_{lab}'] = b

    # ---- guide / view / menu / share --------------------------------------
    g_prof = [(0.0, 0.0), (GUIDE_R, 0.0), (GUIDE_R, 2.2), (5.6, 4.0), (0.0, 4.4)]
    g = solid_of_revolution(g_prof, segments=64, name="guide")
    g.location = (GUIDE_C[0], GUIDE_C[1], top_z(*GUIDE_C) - 0.4)
    objs['guide'] = g

    for nm, (px, py), (w, h) in (('view', VIEW_C, (7.2, 4.6)),
                                 ('menu', MENU_C, (7.2, 4.6)),
                                 ('share', SHARE_C, (8.0, 4.2))):
        pl = prism_from_poly(rounded_rect_poly(w, h, 1.7, seg=5), 2.6,
                             dome=0.9, name=nm)
        pl.location = (px, py, top_z(px, py) + 0.3)
        objs[nm] = pl

    # ---- bumpers: sweep along the shell's top edge ------------------------
    def top_edge_y(x, sgn):
        """Topmost y at which |x| lies inside the outline.

        NOTE: must scan downwards from the top edge. Scanning upwards returns
        the *bottom* of the body's y-extent at that x, which is the grip, not
        the bumper.
        """
        for yy in np.linspace(52.0, -12.0, 220):
            for (xa, xb) in S1.row_intervals(loop, float(yy)):
                if xa <= sgn * x <= xb:
                    return float(yy)
        return None

    for side, sgn in (('R', 1.0), ('L', -1.0)):
        path = []
        for x in np.linspace(16.0, 60.0, 28):
            ey = top_edge_y(x, sgn)
            if ey is None:
                continue
            z = top_z(sgn * x, ey - 5.0)
            if z is None:
                continue
            # Seat the section so ~2.6 mm stands proud of the shoulder. The
            # rounded-rect profile (rather than an ellipse) is what stops the
            # bumper reading as a loose rod lying on the shell.
            path.append((sgn * x, ey - 4.6, z - 1.5))
        if len(path) > 3:
            print(f"[bumper_{side}] {len(path)} pts, y "
                  f"{path[0][1]:.1f}..{path[-1][1]:.1f}, "
                  f"x {path[0][0]:.1f}..{path[-1][0]:.1f}")
            objs[f'bumper_{side}'] = sweep_tube(
                path, name=f'bumper_{side}',
                profile=rounded_rect_poly(5.2, 8.0, 2.0, seg=4))

    # ---- triggers ---------------------------------------------------------
    for side, sgn in (('R', 1.0), ('L', -1.0)):
        tr = box(f"trigger_{side}", 18.0, 11.0, 11.0, bevel=3.4, bseg=4)
        tr.rotation_euler = (math.radians(-30), 0, math.radians(-8 * sgn))
        tr.location = (sgn * 36.0, 44.0, 18.0)
        objs[f'trigger_{side}'] = tr

    # ---- materials --------------------------------------------------------
    shell_m = make_shell_mat()
    rubber_m = make_rubber_mat()
    gloss_m = make_mat("gloss_dark", (0.014, 0.014, 0.016), 0.12)
    guide_m = make_mat("guide", (0.80, 0.81, 0.82), 0.28)

    # The Boolean cuts above use operand objects that own no material slots.
    # Blender then inserts an empty slot and re-points the existing faces at it,
    # so the whole shell falls back to default grey. Clear and reassign AFTER
    # all booleans, and force every face back to slot 0.
    body.data.materials.clear()
    body.data.materials.append(shell_m)
    for p in body.data.polygons:
        p.material_index = 0
    for i in range(2):
        objs[f'stick{i}'].data.materials.append(rubber_m)
    objs['dpad'].data.materials.append(gloss_m)
    for lab in 'YXBA':
        b = objs[f'btn_{lab}']
        add_planar_uv(b, ABXY_R)
        b.data.materials.append(make_glyph_mat(
            f"btn_{lab}", os.path.join(TEX_DIR, f"btn_{lab}.png"),
            0.10, BUTTON_COLOURS[lab]))
    g = objs['guide']
    add_planar_uv(g, GUIDE_R)
    g.data.materials.append(make_glyph_mat(
        "guide", os.path.join(TEX_DIR, "guide.png"), 0.28,
        (0.80, 0.81, 0.82)))
    for nm in ('view', 'menu', 'share'):
        objs[nm].data.materials.append(gloss_m)
    for k in ('bumper_R', 'bumper_L', 'trigger_R', 'trigger_L'):
        if k in objs:
            objs[k].data.materials.append(gloss_m)

    for o in [body] + list(objs.values()):
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.shade_smooth()
        o.select_set(False)

    return body, objs, loop, top_z


def main():
    t0 = time.time()
    body, objs, loop, top_z = build()
    print(f"[build] {len(objs)} control objects in {time.time()-t0:.1f}s")

    sc = bpy.context.scene
    S1.setup_scene()
    sc.cycles.samples = 220
    sc.render.resolution_x = 1400
    sc.render.resolution_y = 1050

    cam_d = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cam_d)
    sc.collection.objects.link(cam)
    sc.camera = cam
    os.makedirs(OUT_DIR, exist_ok=True)

    views = [
        ("hero",   'PERSP', (200, -195, 165), (0, 0, 16), 0, 58),
        ("hero2",  'PERSP', (-175, -150, 205), (0, 0, 16), 0, 58),
        ("top",    'ORTHO', (0, 0, 320), (0, 0, 15), 178, 0),
        ("detail", 'PERSP', (75, -95, 95), (10, 5, 28), 0, 85),
    ]
    for name, ctype, loc, tgt, oscale, lens in views:
        cam_d.type = ctype
        cam.location = Vector(loc)
        if ctype == 'ORTHO':
            cam_d.ortho_scale = oscale
        else:
            cam_d.lens = lens
        S1.look_at(cam, tgt)
        sc.render.filepath = os.path.join(OUT_DIR, f"stage2_{name}.png")
        t = time.time()
        bpy.ops.render.render(write_still=True)
        print(f"[render] {name}: {time.time()-t:.1f}s")

    bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)
    print("[done] saved", BLEND_OUT, f"total {time.time()-t0:.1f}s")


if __name__ == "__main__":
    main()
