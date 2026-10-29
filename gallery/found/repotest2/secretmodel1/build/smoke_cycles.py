import bpy, time, os

out = r"F:\repotest2\secretmodel1\renders\_cycles_smoke.png"
os.makedirs(os.path.dirname(out), exist_ok=True)

print("ENGINE_BEFORE:", bpy.context.scene.render.engine)
try:
    bpy.context.scene.render.engine = 'CYCLES'
    print("ENGINE_SET:", bpy.context.scene.render.engine)
except Exception as e:
    print("ENGINE_SET_FAIL:", repr(e))

sc = bpy.context.scene
try:
    sc.cycles.samples = 16
    sc.cycles.use_denoising = True
    print("CYCLES_SAMPLES_OK:", sc.cycles.samples, "denoise:", sc.cycles.use_denoising)
    print("CYCLES_DEVICE:", sc.cycles.device)
except Exception as e:
    print("CYCLES_PROPS_FAIL:", repr(e))

sc.render.resolution_x = 200
sc.render.resolution_y = 150
sc.render.filepath = out
sc.render.image_settings.file_format = 'PNG'

t0 = time.time()
try:
    bpy.ops.render.render(write_still=True)
    print("RENDER_OK in %.1fs" % (time.time() - t0))
    print("FILE_EXISTS:", os.path.exists(out),
          os.path.getsize(out) if os.path.exists(out) else 0)
except Exception as e:
    print("RENDER_FAIL:", repr(e))

# Also confirm the dynamic engine enum after a real set
print("ENGINE_FINAL:", bpy.context.scene.render.engine)
