"""Create a transformed static source for real worker integration (separate process)."""
import json
import math
from pathlib import Path
import sys
import bpy
from mathutils import Matrix, Vector

root=Path(sys.argv[sys.argv.index('--')+1]).resolve()
snapshot=json.loads((root/'fixture-snapshot.json').read_text())
scene=bpy.context.scene
assert bpy.context.mode=='OBJECT'
for obj in list(scene.objects):bpy.data.objects.remove(obj,do_unlink=True)
scene.unit_settings.scale_length=.001
mesh=bpy.data.meshes.new('Pipeline face data')
mesh.from_pydata(snapshot['mesh']['vertices'],[],snapshot['mesh']['triangles']);mesh.update()
obj=bpy.data.objects.new('Pipeline fixture face',mesh)
collection=bpy.data.collections.new('AI_Work');scene.collection.children.link(collection);collection.objects.link(obj)
transform=Matrix.Translation(Vector((3,-2,5)))@Matrix.Rotation(.23,4,'Z')@Matrix.Diagonal((1.2,.9,1.1,1))
for vertex in mesh.vertices:vertex.co=transform.inverted()@vertex.co
obj.matrix_world=transform
uv=mesh.uv_layers.new(name='Fixture UV')
for i,loop in enumerate(uv.data):loop.uv=((i%13)/13,(i%17)/17)
obj.vertex_groups.new(name='SCAN_PROTECT').add([0],1,'REPLACE')
material=bpy.data.materials.new('Fixture material');material.diffuse_color=(.3,.6,.4,1);mesh.materials.append(material)
camera_data=bpy.data.cameras.new('Fixture front camera');camera_data.type='ORTHO'
camera=bpy.data.objects.new(camera_data.name,camera_data);collection.objects.link(camera)
camera.matrix_world=Matrix.Diagonal((1,-1,-1,1));camera.location=(64,64,-200);scene.camera=camera
for name,point in [('iris_center_left',(45,48,0)),('iris_center_right',(83,48,0)),('chin_bottom',(64,108,0))]:
    marker=bpy.data.objects.new(name,None);marker['scan_studio_landmark']=name;marker.location=point;collection.objects.link(marker)
bpy.context.view_layer.objects.active=obj;obj.select_set(True);bpy.context.view_layer.update()
destination=root/'source.blend'
if destination.exists():raise FileExistsError(destination)
bpy.ops.wm.save_as_mainfile(filepath=str(destination))
print('PIPELINE_FIXTURE_SAVED',destination)
