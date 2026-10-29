import bpy, sys

print("=== GPU PROBE ===")
print("VERSION:", bpy.app.version_string)
bpy.context.scene.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences

for dt in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI', 'METAL', 'NONE'):
    try:
        prefs.compute_device_type = dt
        prefs.refresh_devices()
        devs = [(d.name, d.type, getattr(d, 'use', None)) for d in prefs.devices]
        print(f"{dt}: {devs}")
    except Exception as e:
        print(f"{dt}: FAIL {e!r}")

# Pick the best available GPU and report what we settled on
for dt in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI', 'METAL'):
    try:
        prefs.compute_device_type = dt
        prefs.refresh_devices()
        gpus = [d for d in prefs.devices if d.type != 'CPU']
        if gpus:
            for d in prefs.devices:
                d.use = (d.type != 'CPU')
            print("CHOSEN:", dt, [d.name for d in gpus])
            break
    except Exception:
        continue
else:
    print("CHOSEN: none (CPU only)")

sc = bpy.context.scene
sc.cycles.device = 'GPU'
try:
    sc.cycles.denoiser = 'OPENIMAGEDENOISE'
except Exception as e:
    print("denoiser:", e)
print("cycles.device =", sc.cycles.device)
print("=== END ===")
