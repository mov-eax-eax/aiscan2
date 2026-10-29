import bpy

print("=== PROBE START ===")
print("VERSION_STRING:", bpy.app.version_string)
print("VERSION_TUPLE:", tuple(bpy.app.version))

engines = [i.identifier for i in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
print("ENGINES:", engines)

mat = bpy.data.materials.new("probe_mat")
mat.use_nodes = True
bsdf = None
for n in mat.node_tree.nodes:
    if n.type == 'BSDF_PRINCIPLED':
        bsdf = n
        break
if bsdf:
    print("BSDF_NODE_NAME:", bsdf.name)
    print("BSDF_INPUTS:", [s.name for s in bsdf.inputs])
else:
    print("BSDF_INPUTS: NONE FOUND")

print("HAS_shade_auto_smooth:", hasattr(bpy.ops.object, 'shade_auto_smooth'))
print("HAS_shade_smooth_by_angle:", hasattr(bpy.ops.object, 'shade_smooth_by_angle'))
print("MESH_has_use_auto_smooth:", hasattr(bpy.types.Mesh, 'use_auto_smooth'))

mesh = bpy.data.meshes.new("probe_mesh")
obj = bpy.data.objects.new("probe_obj", mesh)
bpy.context.scene.collection.objects.link(obj)

rm = obj.modifiers.new("rm", 'REMESH')
print("REMESH_MODES:", [e.identifier for e in rm.bl_rna.properties['mode'].enum_items])
print("REMESH_has_voxel_size:", hasattr(rm, 'voxel_size'))

sm = obj.modifiers.new("sm", 'SMOOTH')
print("SMOOTH_has_iterations:", hasattr(sm, 'iterations'))

print("HAS_gltf_export:", hasattr(bpy.ops.export_scene, 'gltf'))
print("HAS_stl_export:", hasattr(bpy.ops.export_mesh, 'stl'))

mb = bpy.data.metaballs.new("probe_mb")
print("METABALL_TYPES:", [e.identifier for e in mb.elements.bl_rna.properties['type'].enum_items] if hasattr(mb.elements, 'bl_rna') else "n/a")
el = mb.elements.new()
print("META_ELEM_ATTRS:", [p.identifier for p in el.bl_rna.properties])

print("HAS_cycles_addon:", 'cycles' in bpy.context.preferences.addons.keys())
print("ADDONS:", sorted(bpy.context.preferences.addons.keys()))
print("=== PROBE END ===")
