import bpy, addon_utils, traceback

print("=== PROBE2 START ===")
print("VERSION:", bpy.app.version_string)

# Is Cycles present at all, and can it be enabled?
mods = [m.__name__ for m in addon_utils.modules()]
print("CYCLES_MODULE_PRESENT:", any('cycles' in m for m in mods))
print("ADDONS_ENABLED:", sorted(bpy.context.preferences.addons.keys()))

import importlib
try:
    importlib.import_module("cycles")
    print("IMPORT_cycles: OK")
except Exception as e:
    print("IMPORT_cycles: FAIL ->", repr(e))

try:
    addon_utils.enable("cycles", default_set=True, persistent=True)
    print("ENABLE_cycles: OK")
except Exception as e:
    print("ENABLE_cycles: FAIL ->", repr(e))

engines = [i.identifier for i in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
print("ENGINES_AFTER:", engines)

if 'CYCLES' in engines:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.refresh_devices()
        print("CYCLES_DEVICES:", [(d.name, d.type) for d in prefs.devices])
    except Exception as e:
        print("CYCLES_DEVICES: FAIL ->", repr(e))

# EEVEE capabilities
prop = bpy.types.Scene.bl_rna.properties.get('eevee')
print("HAS_eevee_scene_props:", prop is not None)
if prop:
    print("EEVEE_PROPS:", sorted([p.identifier for p in prop.fixed_type.properties])[:60])

scene = bpy.context.scene
for cand in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
    try:
        scene.render.engine = cand
        print("SET_ENGINE_OK:", cand)
        break
    except Exception as e:
        print("SET_ENGINE_FAIL:", cand, repr(e))

# Raytracing available in EEVEE (5.x)?
ee = getattr(scene, 'eevee', None)
if ee:
    print("EEVEE_use_raytracing:", getattr(ee, 'use_raytracing', 'MISSING'))
    print("EEVEE_taa_render_samples:", getattr(ee, 'taa_render_samples', 'MISSING'))

# Metaballs
try:
    mb = bpy.data.metaballs.new("p2mb")
    el = mb.elements.new()
    print("META_TYPES:", [e.identifier for e in el.bl_rna.properties['type'].enum_items])
    print("META_ATTRS:", sorted([p.identifier for p in el.bl_rna.properties if not p.is_readonly]))
except Exception:
    traceback.print_exc()

# GPU / headless render device
print("HAS_gpu_module:", end=" ")
try:
    import gpu
    print("yes", gpu.platform.renderer_get())
except Exception as e:
    print("no", repr(e))

print("=== PROBE2 END ===")
