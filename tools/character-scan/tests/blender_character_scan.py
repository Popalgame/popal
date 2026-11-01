"""End-to-end full-bundle import on a separate opened study, with guide render."""
import argparse
from array import array
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

p=argparse.ArgumentParser();p.add_argument('--report',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);a.out.mkdir(parents=True,exist_ok=False)
source=Path(bpy.data.filepath);source_hash=hashlib.sha256(source.read_bytes()).hexdigest()
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('character_test_addon',root/'blender_face_scan.py')
addon=importlib.util.module_from_spec(spec);sys.modules[spec.name]=addon;spec.loader.exec_module(addon);addon.register()
s=bpy.context.scene.face_scan;s.scanner=str(root/'face_scan.py')
r=addon.adopt_character_report(s,a.report.resolve())
assert r['face']['status']!='unknown' and Path(s.report).is_file()

def mesh_hash(mesh):
    coords=array('f',[0])*len(mesh.vertices)*3;mesh.vertices.foreach_get('co',coords)
    return hashlib.sha256(coords.tobytes()).hexdigest()

original={o.name:(o.data.name,mesh_hash(o.data)) for o in bpy.data.objects if o.type=='MESH'}
old_names=set(bpy.data.objects.keys())
assert bpy.ops.face_scan.character_guides()=={'FINISHED'}
created=[o for o in bpy.data.objects if o.name not in old_names]
images=[o for o in created if o.type=='EMPTY'];curves=[o for o in created if o.type=='CURVE']
assert len(images)==2+sum(p['area_px']>0 for p in r['parts'].values())
assert len(curves)==len(addon.character_helpers(s).body_lines(r))
assert all(any(c.name.startswith('Character Scan') for c in o.users_collection) for o in created)
assert all(c in bpy.data.collections['AI_Work'].children.values() for o in created for c in o.users_collection)
w,h=r['image']['width'],r['image']['height']
for ob in images:
    assert ob.data.packed_file is not None
    # Blender image empties normalize their largest dimension to Display Size.
    assert abs(ob.empty_display_size*w/max(w,h)-w*s.units)<1e-6
    assert abs(ob.empty_display_size*h/max(w,h)-h*s.units)<1e-6
assert original=={n:(bpy.data.objects[n].data.name,mesh_hash(bpy.data.objects[n].data)) for n in original}
assert hashlib.sha256(source.read_bytes()).hexdigest()==source_hash
target=a.out/'character-scan-integration.blend'
assert bpy.ops.wm.save_as_mainfile(filepath=str(target))=={'FINISHED'}

# Diagnostic render of the image empty's exact display rectangle and real curve
# objects. Empties themselves are viewport-only; this plane is not saved in the study.
scene=bpy.context.scene
for ob in scene.objects:ob.hide_render=ob not in curves
reference=next(o for o in images if o.name.startswith('Reference'))
cx,cy,cz=reference.location
ww=reference.empty_display_size*w/max(w,h);hh=reference.empty_display_size*h/max(w,h)
mesh=bpy.data.meshes.new('Diagnostic image rectangle')
mesh.from_pydata([(cx-ww/2,cy,cz-hh/2),(cx+ww/2,cy,cz-hh/2),(cx+ww/2,cy,cz+hh/2),(cx-ww/2,cy,cz+hh/2)],[],[(0,1,2,3)])
ob=bpy.data.objects.new('Diagnostic reference plane',mesh);scene.collection.objects.link(ob)
uv=mesh.uv_layers.new()
for loop,coord in zip(uv.data,[(0,0),(1,0),(1,1),(0,1)]):loop.uv=coord
mat=bpy.data.materials.new('Diagnostic image emission');mat.use_nodes=True
nodes=mat.node_tree.nodes;nodes.clear();links=mat.node_tree.links
tex=nodes.new('ShaderNodeTexImage');tex.image=reference.data
emission=nodes.new('ShaderNodeEmission');transparent=nodes.new('ShaderNodeBsdfTransparent')
mix=nodes.new('ShaderNodeMixShader');out=nodes.new('ShaderNodeOutputMaterial')
links.new(tex.outputs['Color'],emission.inputs['Color']);links.new(tex.outputs['Alpha'],mix.inputs[0])
links.new(transparent.outputs[0],mix.inputs[1]);links.new(emission.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],out.inputs['Surface'])
mesh.materials.append(mat)
camdata=bpy.data.cameras.new('Guide inspection camera');cam=bpy.data.objects.new('Guide inspection camera',camdata);scene.collection.objects.link(cam)
cam.location=(cx,-6,cz);cam.rotation_euler=(Vector((cx,cy,cz))-cam.location).to_track_quat('-Z','Y').to_euler()
camdata.type='ORTHO';camdata.ortho_scale=hh*1.04;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=8
scene.render.resolution_x=560;scene.render.resolution_y=1120;scene.render.resolution_percentage=100
scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=0
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(a.out/'registered-guides.png')
bpy.ops.render.render(write_still=True)
report={'source':str(source),'source_sha256':source_hash,'candidate_sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
        'blender':bpy.app.version_string,'image_layers':len(images),'cross_section_curves':len(curves),
        'original_mesh_count':len(original),'original_meshes_preserved':True,'packed_images':True,
        'registration_checks':'largest-dimension image scale and shared image/world mapping',
        'visual_evidence':'registered-guides.png','scope':'full scan import and guide registration; not a generated 3D character'}
(a.out/'integration-report.json').write_text(json.dumps(report,indent=2)+'\n')
addon.unregister();print(json.dumps(report),flush=True)
