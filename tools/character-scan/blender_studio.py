"""Blender-side immutable snapshots and verified, separately linked fitted candidates."""
import importlib.util
import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


def identity_helpers():
    spec=importlib.util.spec_from_file_location('polpal_mesh_snapshot',Path(__file__).with_name('mesh_snapshot.py'))
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module


def snapshot_object(obj,frame_id='blender-world-mm',semantic_role=None):
    if bpy.context.mode!='OBJECT' or obj is None or obj.type!='MESH':raise ValueError('Select a mesh in Object Mode')
    if obj.data.shape_keys or obj.find_armature() or obj.constraints or obj.animation_data:raise ValueError('Snapshot requires a static unrigged source')
    if any(m.show_viewport or m.show_render for m in obj.modifiers):raise ValueError('Snapshot requires explicit base geometry with no enabled modifiers')
    factor=bpy.context.scene.unit_settings.scale_length*1000
    if factor<=0:raise ValueError('Invalid scene scale')
    obj.data.calc_loop_triangles()
    vertices=[list((obj.matrix_world@v.co)*factor) for v in obj.data.vertices]
    triangles=[list(t.vertices) for t in obj.data.loop_triangles]
    mesh={'vertices':vertices,'triangles':triangles,'sha256':identity_helpers().mesh_digest(vertices,triangles),
            'source_object':obj.name,'source_data':obj.data.name,'matrix_world':[list(row) for row in obj.matrix_world],
             'world_unit':'mm','frame_id':frame_id,'units_to_mm':factor,'space':'Blender world, Z up; camera matrix handles image axes'}
    if semantic_role is not None:
        if semantic_role!='isolated_face':raise ValueError('Unsupported semantic role')
        mesh['semantic_role']=semantic_role
    return mesh


def export_snapshot(obj,path,step_mm=1):
    path=Path(path)
    if path.exists():raise FileExistsError(path)
    mesh=snapshot_object(obj);groups={g.index:g.name for g in obj.vertex_groups};controls=[];pins=[]
    if not math.isfinite(step_mm) or step_mm<=0:raise ValueError('Invalid control step')
    for vertex in obj.data.vertices:
        if any(groups[g.group]=='SCAN_PROTECT' and g.weight>0 for g in vertex.groups):pins.append(vertex.index)
    for axis in range(3):
        group_name='SCAN_FIT_'+'XYZ'[axis]
        if group_name not in groups.values():continue
        offsets=[]
        for vertex in obj.data.vertices:
            weight=next((g.weight for g in vertex.groups if groups[g.group]==group_name),0)
            direction=[0.,0.,0.];direction[axis]=step_mm*weight;offsets.append(direction)
        controls.append({'name':group_name,'min':-1,'max':1,'offsets':offsets})
    job={'schema':'polpal.mesh-job/1','mesh':mesh,'controls':controls,'protected_vertices':pins,'max_displacement':step_mm,
         'iterations':12,'views':[],'notes':'Assign SCAN_FIT_X/Y/Z groups and SCAN_PROTECT on an explicit study copy; directions are world millimetres. Add calibrated same-frame camera/target views in Studio.'}
    path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(job,indent=2,allow_nan=False)+'\n');return job


def import_result(job,result,collection,name=None):
    helpers=identity_helpers();helpers.verify_result(job,result)
    source=bpy.data.objects.get(job['mesh'].get('source_object',''))
    current=snapshot_object(source,job['mesh'].get('frame_id','blender-world-mm'),job['mesh'].get('semantic_role'))
    if current!=job['mesh']:raise ValueError('Blender source changed after snapshot')
    if any(c.get('frame_id')!=current['frame_id'] or c.get('world_unit')!='mm' for c in (v['camera'] for v in job['views'])):raise ValueError('Camera and mesh frames differ')
    label=name or source.name+' / Studio candidate'
    if bpy.data.objects.get(label):raise ValueError('Candidate already exists; choose a new name')
    inverse=source.matrix_world.inverted();factor=current['units_to_mm']
    coords=[inverse@(Vector(point)/factor) for point in result['vertices']]
    candidate=source.copy();candidate.data=source.data.copy();candidate.name=label
    # Original topology, materials, UVs and groups survive data.copy(); only positions change.
    for vertex,point in zip(candidate.data.vertices,coords):vertex.co=point
    candidate.data.update();candidate['scan_studio_source_sha256']=current['sha256'];candidate['scan_studio_job_sha256']=result['job_sha256']
    candidate['scan_studio_scope']='Bounded silhouette candidate; requires visual review'
    collection.objects.link(candidate);candidate.hide_render=True;candidate.hide_set(True)
    return candidate
