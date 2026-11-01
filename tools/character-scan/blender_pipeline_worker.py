"""Fixed Blender worker for Studio; inputs are JSON, never executable user code."""
import argparse
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_studio import snapshot_object, import_result, identity_helpers


def write(path, value):
    Path(path).write_text(json.dumps(value, indent=2, allow_nan=False)+'\n')


def attributes(obj):
    """Identity of non-position data that must survive the copy/import."""
    return identity_helpers().job_digest({
        'uv': {layer.name: [list(p.uv) for p in layer.data] for layer in obj.data.uv_layers},
        'materials': [m.name if m else None for m in obj.data.materials],
        'faces': [[list(p.vertices), p.material_index, p.use_smooth] for p in obj.data.polygons],
        'groups': [g.name for g in obj.vertex_groups],
        'weights': [[[g.group, g.weight] for g in v.groups] for v in obj.data.vertices]})


def camera_for(scene, projection, size, vertices, factor, collection):
    """Convert pixel-centre coordinates to an orthographic Blender camera."""
    p = projection['P']; denom = p[2][3]
    if any(abs(v)>1e-10 for v in p[2][:3]) or abs(denom)<1e-12:
        raise ValueError('Orthographic camera required')
    right = Vector(p[0][:3])/denom; down = Vector(p[1][:3])/denom
    scale = right.length
    if scale<=0 or abs(down.length/scale-1)>1e-6 or abs(right.dot(down)/scale**2)>1e-6:
        raise ValueError('Camera must have equal orthogonal pixel axes')
    right.normalize();down.normalize();back = right.cross(-down)
    w,h = size;tx,ty = p[0][3]/denom,p[1][3]/denom
    # Pixels use integer centres; Blender's image rectangle starts at -0.5.
    center = (right*((w-1)/2-tx)/scale + down*((h-1)/2-ty)/scale)/factor
    depth = [back.dot(Vector(v)/factor) for v in vertices]
    distance = max(1., (max(depth)-min(depth))*2)
    data = bpy.data.cameras.new('Studio matched camera');data.type='ORTHO'
    data.sensor_fit='HORIZONTAL';data.ortho_scale=w/scale/factor
    data.clip_start=.0001;data.clip_end=max(100.,distance*4)
    obj=bpy.data.objects.new(data.name,data);collection.objects.link(obj)
    obj.matrix_world=Matrix((right,-down,back)).transposed().to_4x4()
    obj.matrix_world.translation=center+back*(max(depth)+distance)
    scene.camera=obj
    # Validate against Blender's own projection, independently of our rasterizer.
    from bpy_extras.object_utils import world_to_camera_view
    errors=[]
    for v in vertices[::max(1,len(vertices)//100)]:
        q=world_to_camera_view(scene,obj,Vector(v)/factor)
        expected=[sum(p[i][j]*v[j] for j in range(3))/denom+p[i][3]/denom for i in (0,1)]
        errors.append(math.hypot(q.x*w-.5-expected[0],(1-q.y)*h-.5-expected[1]))
    if max(errors)>.02:raise ValueError('Blender camera projection mismatch: '+str(max(errors)))
    return max(errors)


def render_pair(source, candidate, job, out):
    original=bpy.context.scene;view=job['views'][0];w,h=view['size']
    scene=bpy.data.scenes.new('Studio render validation')
    collection=bpy.data.collections.new('AI_Work / render validation');scene.collection.children.link(collection)
    scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=False
    scene.render.resolution_x=w;scene.render.resolution_y=h;scene.render.resolution_percentage=100
    scene.render.pixel_aspect_x=scene.render.pixel_aspect_y=1
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
    scene.render.film_transparent=True;scene.render.use_compositing=False;scene.render.use_sequencer=False
    scene.view_settings.view_transform='Standard'
    projection_error=camera_for(scene,view['camera'],[w,h],job['mesh']['vertices'],job['mesh']['units_to_mm'],collection)
    neutral=bpy.data.materials.new('Studio opaque silhouette');neutral.use_nodes=True
    nodes=neutral.node_tree.nodes;nodes.clear();output=nodes.new('ShaderNodeOutputMaterial');emission=nodes.new('ShaderNodeEmission')
    emission.inputs['Color'].default_value=(.45,.65,.55,1);neutral.node_tree.links.new(emission.outputs[0],output.inputs['Surface'])
    clones=[]
    try:
        # Independent copies avoid changing source visibility/materials, including hidden collections.
        for label,obj in [('before',source),('after',candidate)]:
            clone=obj.copy();clone.data=obj.data.copy();clone.parent=None;clone.matrix_world=obj.matrix_world.copy()
            collection.objects.link(clone);clone.hide_render=False;clones.append(clone)
            clone.data.materials.clear();clone.data.materials.append(neutral)
            for polygon in clone.data.polygons:polygon.material_index=0
            scene.render.filepath=str(out/f'{label}-silhouette.png')
            bpy.ops.render.render(write_still=True,scene=scene.name)
            clone.hide_render=True
        # Full scene, original materials and lighting, same matched camera for both renders.
        context_scene=original.copy();context_scene.name='Studio context validation'
        context_scene.collection.objects.link(scene.camera);context_scene.camera=scene.camera
        context_scene.render.engine='CYCLES';context_scene.cycles.samples=8
        context_scene.render.resolution_x=w;context_scene.render.resolution_y=h;context_scene.render.resolution_percentage=100
        context_scene.render.pixel_aspect_x=context_scene.render.pixel_aspect_y=1
        context_scene.render.use_border=False;context_scene.render.use_compositing=False;context_scene.render.use_sequencer=False
        context_scene.render.image_settings.file_format='PNG';context_scene.render.image_settings.color_mode='RGBA'
        context_scene.render.film_transparent=True
        visibility=(source.hide_render,candidate.hide_render)
        try:
            for label in ('before','after'):
                source.hide_render=label!='before';candidate.hide_render=label!='after'
                context_scene.render.filepath=str(out/f'{label}-context.png')
                bpy.ops.render.render(write_still=True,scene=context_scene.name)
        finally:
            source.hide_render,candidate.hide_render=visibility
            bpy.data.scenes.remove(context_scene)
    finally:
        for obj in clones:
            data=obj.data;bpy.data.objects.remove(obj,do_unlink=True);bpy.data.meshes.remove(data)
        camera=scene.camera;data=camera.data;bpy.data.objects.remove(camera,do_unlink=True);bpy.data.cameras.remove(data)
        bpy.data.scenes.remove(scene);bpy.data.collections.remove(collection);bpy.data.materials.remove(neutral)
    return projection_error


def main():
    parser=argparse.ArgumentParser();parser.add_argument('stage',choices=['snapshot','render','verify'])
    parser.add_argument('request',type=Path);args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    request=json.loads(args.request.read_text());out=args.request.parent;binding=request['binding']
    scene=bpy.context.scene
    write(out/(args.stage+'-scene.json'),{'version':bpy.app.version_string,'file':bpy.data.filepath,
        'scene':scene.name,'mode':bpy.context.mode,'active':getattr(bpy.context.active_object,'name',None),
        'selected':[o.name for o in bpy.context.selected_objects],'scale':scene.unit_settings.scale_length,
        'collections':[c.name for c in bpy.data.collections],'engine':scene.render.engine})
    source=scene.objects.get(binding['object'])
    mesh=snapshot_object(source,binding['frame_id'],'isolated_face')
    if args.stage=='snapshot':
        if (out/'input.blend').exists():raise FileExistsError(out/'input.blend')
        group=source.vertex_groups.get('SCAN_PROTECT')
        pins=[v.index for v in source.data.vertices if group and any(g.group==group.index and g.weight>0 for g in v.groups)]
        pins=sorted(set(pins)|set(identity_helpers().protection_vertices(binding,mesh)))
        write(out/'snapshot.json',{'mesh':mesh,'protected_vertices':pins,'attributes_sha256':attributes(source)})
        from blender_landmarks import collect
        landmarks=collect(source,binding['frame_id']);landmarks['source_mesh_sha256']=mesh['sha256']
        landmarks['source_blend_sha256']=binding['sha256'];write(out/'model-landmarks.json',landmarks)
        bpy.ops.file.pack_all()
        bpy.ops.wm.save_as_mainfile(filepath=str(out/'input.blend'),check_existing=False)
    else:
        snapshot=json.loads((out/'snapshot.json').read_text())
        if mesh!=snapshot['mesh'] or attributes(source)!=snapshot['attributes_sha256']:raise ValueError('Checkpoint source changed')
        job=json.loads((out/'autopilot/fit-job.json').read_text());result=json.loads((out/'autopilot/fit/fit-result.json').read_text())
        if args.stage=='verify':
            previous=json.loads((out/'blender-report.json').read_text())
            candidate=scene.objects[previous['candidate']]
            actual=snapshot_object(candidate,binding['frame_id'],'isolated_face')
            error=max((Vector(a)-Vector(b)).length for a,b in zip(actual['vertices'],result['vertices']))
            # Loop triangles are derived from polygon positions: a deformed quad
            # may legitimately switch its diagonal. Compare with the rendered
            # candidate tessellation; attributes() separately locks polygon topology.
            triangles_sha256=identity_helpers().job_digest(actual['triangles'])
            if triangles_sha256!=previous['candidate_triangles_sha256'] or error>max(1e-4,job['max_displacement']*1e-5):
                raise ValueError('Saved candidate differs from fitted result')
            if attributes(candidate)!=snapshot['attributes_sha256']:raise ValueError('Saved candidate attributes differ')
            if candidate.hide_render or not source.hide_render:raise ValueError('Saved candidate visibility mismatch')
            write(out/'reopen-report.json',{'status':'verified','roundtrip_max_error_mm':error,
                'candidate_triangles_sha256':triangles_sha256,'rendered_tessellation_preserved':True,
                'protected_vertices':len(job['protected_vertices']),
                'protected_max_error_mm':max(((Vector(actual['vertices'][i])-Vector(mesh['vertices'][i])).length for i in job['protected_vertices']),default=0.),
                'source_preserved':True,'attributes_preserved':True,'candidate':candidate.name})
            return
        if (out/'candidate.blend').exists():raise FileExistsError(out/'candidate.blend')
        collection=bpy.data.collections.get('AI_Work')
        if collection is None:
            collection=bpy.data.collections.new('AI_Work');scene.collection.children.link(collection)
        elif collection.name not in scene.collection.children:
            scene.collection.children.link(collection)
        candidate=import_result(job,result,collection,'Studio candidate / '+out.name)
        actual=snapshot_object(candidate,binding['frame_id'],'isolated_face')
        error=max((Vector(a)-Vector(b)).length for a,b in zip(actual['vertices'],result['vertices']))
        if error>max(1e-4,job['max_displacement']*1e-5):raise ValueError('Imported coordinates differ from result')
        if attributes(candidate)!=snapshot['attributes_sha256']:raise ValueError('UV/material/group preservation failed')
        projection_error=render_pair(source,candidate,job,out)
        rendered=snapshot_object(candidate,binding['frame_id'],'isolated_face')
        if rendered!=actual:raise ValueError('Candidate geometry changed during rendering')
        if snapshot_object(source,binding['frame_id'],'isolated_face')!=mesh:raise ValueError('Source geometry changed')
        source.hide_render=True;source.hide_set(True);candidate.hide_render=False;candidate.hide_set(False)
        for obj in bpy.context.selected_objects:obj.select_set(False)
        candidate.select_set(True);bpy.context.view_layer.objects.active=candidate
        bpy.ops.wm.save_as_mainfile(filepath=str(out/'candidate.blend'),check_existing=False)
        write(out/'blender-report.json',{'status':'rendered','roundtrip_max_error_mm':error,
            'candidate_triangles_sha256':identity_helpers().job_digest(actual['triangles']),
            'source_tessellation_changed_entries':sum(a!=b for a,b in zip(actual['triangles'],result['triangles'])),
            'projection_max_error_px':projection_error,'attributes_preserved':True,'source_preserved':True,
            'candidate':candidate.name,'blender_version':bpy.app.version_string,'likeness_approved':False})


if __name__=='__main__':main()
