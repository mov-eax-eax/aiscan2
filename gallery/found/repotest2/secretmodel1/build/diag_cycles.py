import bpy, addon_utils, sys, traceback

print("=== CYCLES DIAG ===")
print("VERSION:", bpy.app.version_string)

# Which RenderEngine subclasses exist?
subs = []
for name in dir(bpy.types):
    try:
        t = getattr(bpy.types, name)
        if isinstance(t, type) and issubclass(t, bpy.types.RenderEngine):
            subs.append((name, getattr(t, "bl_idname", None)))
    except Exception:
        pass
print("RENDER_ENGINE_SUBCLASSES:", subs)

# Try enabling and capture the real reason
import importlib
mod = importlib.import_module("cycles")
print("cycles module file:", getattr(mod, "__file__", None))
print("cycles bl_info:", getattr(mod, "bl_info", None))

try:
    r = addon_utils.enable("cycles", default_set=True, persistent=True)
    print("enable() returned:", r)
except Exception:
    traceback.print_exc()

print("ENGINES_NOW:", [i.identifier for i in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items])

# Force-set and capture
try:
    bpy.context.scene.render.engine = 'CYCLES'
    print("FORCE_SET_CYCLES: OK ->", bpy.context.scene.render.engine)
except Exception as e:
    print("FORCE_SET_CYCLES: FAIL ->", repr(e))

# Maybe it lives as an extension in 5.x
try:
    import bl_ext.blender_org.cycles as extc
    print("EXTENSION cycles import OK", extc)
except Exception as e:
    print("EXTENSION cycles import FAIL:", repr(e))

try:
    print("bl_pkg addon:", bpy.context.preferences.addons.get('bl_pkg'))
except Exception as e:
    print("bl_pkg check fail", repr(e))

print("=== CYCLES DIAG END ===")
