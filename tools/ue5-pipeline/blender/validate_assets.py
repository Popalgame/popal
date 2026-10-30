"""Validate generated prototype assets in Blender 5.2, including FBX reimport."""
import bpy
import hashlib
import json
import math
import time
import struct
import zlib
from pathlib import Path

REPO=Path(__file__).resolve().parents[3]
MANIFEST=REPO/'tools/ue5-pipeline/manifests/pipeline.json'
REPORT=REPO/'output/ue5-pipeline/validation.json'
EXPECTED={'Idle','Walk_Fwd','Run_Fwd','Jump_Start','Fall_Loop','Land',
 'Work_Hammering','Work_Mining','Work_Watering','Work_Carrying_Idle',
 'Work_Carrying_Walk','Attack_Melee','Attack_Cast_Skill','Hit_React',
 'Stunned_Loop','Captured_Struggle','Sleep'}

def require(ok, message):
    if not ok: raise AssertionError(message)

def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def verify_file(rel, checksum):
    path=REPO/rel
    require(path.is_file(),f'Missing {rel}')
    require(digest(path)==checksum,f'Stale hash {rel}')

def verify_blend(entry):
    bpy.ops.wm.open_mainfile(filepath=str(REPO/entry['blend']))
    scene=bpy.context.scene
    require(scene.unit_settings.system=='METRIC' and scene.unit_settings.scale_length==1.0,'Blender units')
    arm=bpy.data.objects.get(entry['rig'])
    require(arm is not None and arm.type=='ARMATURE','Armature missing')
    require(tuple(arm.location)==(0,0,0) and tuple(arm.rotation_euler)==(0,0,0) and tuple(arm.scale)==(1,1,1),'Armature transform')
    bones=arm.data.bones
    require(set(entry['bones'])==set(bones.keys()),'Bone list differs')
    require(bones['root'].parent is None,'Root has parent')
    require(tuple(bones['root'].head_local)==(0,0,0),'Root is not at world origin')
    require((bones['root'].tail_local-bones['root'].head_local).normalized().y>.999999,'Root is not +Y aligned')
    require(max(abs(bones['root'].matrix_local[i][j]-(1.0 if i==j else 0.0)) for i in range(4) for j in range(4))<1e-6,'Root rest matrix is not identity')
    require({b.name:(b.parent.name if b.parent else None) for b in bones}==entry['bone_parents'],'Source bone parents')
    for child,parent in [('pelvis','root'),('spine_01','pelvis'),('head','spine_01')]:
        require(bones[child].parent==bones[parent],f'Invalid chain: {child}')
    for n in ['hand_l','hand_r','weapon_l','weapon_r','mount_socket']:
        require(n in bones,f'Missing bone {n}')
    for key,(start,end) in entry['retarget_chains'].items():
        require(start in bones and end in bones,f'Invalid chain {key}')
        current=bones[end]
        while current and current.name!=start: current=current.parent
        require(current is not None,f'Noncontiguous chain {key}')
    if entry['id'].startswith('biped'):
        for side in ('l','r'):
            for parent,child in [('upperarm','lowerarm'),('lowerarm','hand'),('thigh','calf'),('calf','foot')]:
                require(bones[f'{child}_{side}'].parent==bones[f'{parent}_{side}'],f'Two Bone IK chain {parent}/{child}')
    if entry['id']=='quadruped':
        for side in ('l','r'):
            for parent,child in [('foreleg_upper','foreleg_lower'),('foreleg_lower','hand'),
                                 ('hindleg_upper','hindleg_lower'),('hindleg_lower','foot')]:
                require(bones[f'{child}_{side}'].parent==bones[f'{parent}_{side}'],f'Quadruped IK chain {parent}/{child}')
    meshes={int(o.name.rsplit('LOD',1)[1]):o for o in bpy.data.objects if o.type=='MESH' and '_LOD' in o.name}
    require(set(meshes)=={0,1,2,3},'LOD mesh count')
    outline=bpy.data.objects.get(f'{entry["rig"]}_Outline')
    require(outline is not None and outline.type=='MESH' and outline.parent==arm,'Source outline binding')
    require(len(outline.data.polygons)==len(meshes[0].data.polygons),'Source outline triangle count')
    require(all(a.normal.dot(b.normal)<-.5 for a,b in zip(outline.data.polygons,meshes[0].data.polygons)),
            'Source outline normals not reversed')
    require(outline.data.materials[0].name=='M_Prototype_Outline','Source outline material')
    tris=[];verts=[]
    coordinates=[v.co for v in meshes[0].data.vertices]
    actual_dimensions=[max(v[i] for v in coordinates)-min(v[i] for v in coordinates) for i in range(3)]
    require(all(abs(actual_dimensions[i]-entry['body_dimensions_m'][i])<.001 for i in range(3)),'Body dimensions differ from mesh')
    for level in range(4):
        obj=meshes[level]; mesh=obj.data
        require(obj.parent==arm and tuple(obj.location)==(0,0,0) and tuple(obj.scale)==(1,1,1),'Mesh binding/transform')
        require(any(m.type=='ARMATURE' and m.object==arm for m in obj.modifiers),'Armature modifier')
        require(mesh.color_attributes.get('ElementMask') is not None,'Vertex masks missing')
        require(mesh.has_custom_normals and all(p.use_smooth for p in mesh.polygons),'Source custom smooth normals')
        mask=mesh.color_attributes['ElementMask']
        require(mask.domain=='CORNER' and mask.data_type=='FLOAT_COLOR','Vertex mask storage')
        require(all(0.0 <= x.color[0] <= 1.0 and 0.0 <= x.color[1] <= 1.0 for x in mask.data),'Mask range')
        require(len({round(x.color[0],2) for x in mask.data})>=2 and len({round(x.color[1],2) for x in mask.data})>=2,
                'Source masks lack R/G variation')
        for vertex in mesh.vertices:
            influences=list(vertex.groups)
            require(1 <= len(influences) <= 4,'Bone influences out of range')
            require(abs(sum(g.weight for g in influences)-1.0)<1e-5,'Skin weights not normalized')
            require(all(g.weight>=0 and obj.vertex_groups[g.group].name in bones for g in influences),'Invalid bone weights')
        require(all(len(p.vertices)==3 for p in mesh.polygons),'Nontriangle face')
        tris.append(len(mesh.polygons));verts.append(len(mesh.vertices))
        require(entry['lods'][level]['triangles']==tris[-1] and entry['lods'][level]['vertices']==verts[-1],'LOD manifest count')
    require(all(tris[i+1]/tris[i]<=.5 for i in range(3)),f'LOD reduction insufficient: {tris}')
    require(all(tris[i+1]<tris[i] for i in range(3)),'LOD triangle order')
    clips=[]
    require({a['name'] for a in entry['animations']}==EXPECTED,'Action manifest set')
    for meta in entry['animations']:
        action=bpy.data.actions.get(meta['name']);require(action is not None,f'Missing action {meta["name"]}')
        require(len(action.slots)>=1,f'No action slot {action.name}')
        curves=action.layers[0].strips[0].channelbag(action.slots[0]).fcurves
        require(not any('pose.bones["root"]' in curve.data_path for curve in curves),f'Animated root in source {action.name}')
        arm.animation_data_create();arm.animation_data.action=action;arm.animation_data.action_slot=action.slots[0]
        samples=[]
        start,end=meta['frames']
        for frame in [start,start+(end-start)//4,(start+end)//2,start+3*(end-start)//4,end]:
            scene.frame_set(frame)
            samples.append([round(c,5) for b in arm.pose.bones if b.name not in {'root','weapon_l','weapon_r','mount_socket'} for c in b.rotation_euler])
        delta=max(abs(x-y) for sample in samples[1:-1] for x,y in zip(samples[0],sample))
        require(delta>.01,f'Static action {action.name}')
        if meta['loop']:
            require(max(abs(x-y) for x,y in zip(samples[0],samples[-1]))<.002,f'Loop discontinuity {action.name}')
        require(meta['fps'] in (30,60) and meta['frames'][1]>meta['frames'][0],'Clip duration/fps')
        clips.append({'name':action.name,'midpoint_delta_rad':round(delta,4)})
    aim=entry.get('aim_offset')
    if aim:
        require(entry['id'].startswith('biped') and len(aim['poses'])==9,'Aim offset scope/size')
        require(aim['additive_ref']=={'animation':'Idle','frame':1},'Aim reference')
        require(aim['pose_encoding']=='reference_frame_1_then_absolute_target_frame_2' and
                aim['unreal_additive_setup_required'] is True,'Aim additive encoding')
        require({p['name'] for p in aim['poses']}=={'Aim_Center','Aim_Up','Aim_Down','Aim_Left','Aim_Right',
             'Aim_UpLeft','Aim_UpRight','Aim_DownLeft','Aim_DownRight'},'Aim pose set')
        idle=bpy.data.actions['Idle'];arm.animation_data.action=idle;arm.animation_data.action_slot=idle.slots[0]
        scene.frame_set(1);reference={b.name:tuple(b.rotation_euler) for b in arm.pose.bones}
        for pose in aim['poses']:
            action=bpy.data.actions.get(pose['name']);require(action is not None,'Source aim action')
            arm.animation_data.action=action;arm.animation_data.action_slot=action.slots[0]
            scene.frame_set(1)
            require(all(max(abs(b.rotation_euler[i]-reference[b.name][i]) for i in range(3))<.001
                        for b in arm.pose.bones if b.name not in {'root','weapon_l','weapon_r','mount_socket'}),'Aim source reference pose')
            scene.frame_set(2)
            head=arm.pose.bones['head'].rotation_euler
            require(abs((head.x-reference['head'][0])-math.radians(pose['pitch'])*.7)<.002,'Aim source pitch')
            require(abs((head.z-reference['head'][2])-math.radians(pose['yaw'])*.7)<.002,'Aim source yaw')
    else: require(not entry['id'].startswith('biped'),'Biped missing aim offset')
    return {'bones':len(bones),'triangles':tris,'vertices':verts,'actions':clips,
            'aim_poses':len(aim['poses']) if aim else 0}

def imported_arm(entry):
    arms=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
    require(len(arms)==1,f'FBX expected one armature: {entry["id"]}')
    arm=arms[0]
    require(set(arm.data.bones.keys())==set(entry['bones']),'FBX bone set')
    require({b.name:(b.parent.name if b.parent else None) for b in arm.data.bones}==entry['bone_parents'],'FBX bone hierarchy')
    root=arm.data.bones['root']
    require(max(abs(root.matrix_local[i][j]-(1.0 if i==j else 0.0)) for i in range(4) for j in range(4))<1e-4,'FBX root rest matrix')
    require(max(abs(arm.matrix_world[i][j]-(1.0 if i==j else 0.0)) for i in range(4) for j in range(4))<1e-4,'FBX armature transform')
    return arm

def import_one(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(REPO/path),use_manual_orientation=False)

def verify_mesh_fbx(entry, meta, expected_triangles, outline=False):
    import_one(meta['fbx'])
    arm=imported_arm(entry)
    require(arm.animation_data is None or arm.animation_data.action is None,
            f'Mesh FBX unexpectedly contains animation: {meta["fbx"]}')
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    require(len(meshes)==1,f'FBX expected one mesh: {meta["fbx"]}')
    mesh=meshes[0]
    require(mesh.parent==arm,'FBX mesh skin binding')
    require(len(mesh.data.polygons)==expected_triangles,f'FBX triangle count: {meta["fbx"]}')
    require(all(len(p.vertices)==3 for p in mesh.data.polygons),'FBX nontriangle face')
    require(max(abs(mesh.matrix_local[i][j]-(1.0 if i==j else 0.0)) for i in range(4) for j in range(4))<1e-4,'FBX mesh transform')
    mask=mesh.data.color_attributes.get('ElementMask')
    require(mask is not None,'FBX lost vertex mask')
    require(all(0<=c.color[0]<=1 and 0<=c.color[1]<=1 for c in mask.data),'FBX mask range')
    if not outline:
        require(len({round(c.color[0],2) for c in mask.data})>=2 and len({round(c.color[1],2) for c in mask.data})>=2,
                'FBX masks lack R/G variation')
        require(any(poly.use_smooth for poly in mesh.data.polygons),'FBX lost smooth normals')
    else:
        require(mesh.data.materials[0].name=='M_Prototype_Outline','FBX outline material')
    require('root' not in mesh.vertex_groups and 'weapon_r' not in mesh.vertex_groups,'FBX weighted helper bone')
    for vertex in mesh.data.vertices:
        groups=vertex.groups
        require(1<=len(groups)<=4,f'FBX influence count: {meta["fbx"]}')
        require(abs(sum(g.weight for g in groups)-1)<1e-4,'FBX weights not normalized')
        require(all(g.weight>=0 and mesh.vertex_groups[g.group].name in arm.data.bones for g in groups),'FBX invalid weight target')
    coords=[mesh.matrix_world@v.co for v in mesh.data.vertices]
    extent=[max(v[i] for v in coords)-min(v[i] for v in coords) for i in range(3)]
    require(max(extent)<5 and max(extent)>.25,f'FBX scale invalid {extent}')
    if entry['id']=='biped_standard' and (meta['fbx']==entry['mesh_fbx'] or meta.get('level')==0):
        require(abs(extent[2]-1.8)<.005,f'FBX standard height {extent[2]} m')
    return {'path':meta['fbx'],'triangles':len(mesh.data.polygons),
            'extent_m':[round(x,4) for x in extent],
            'first_face_normal':[round(x,4) for x in mesh.data.polygons[0].normal]}

def basis_values(arm):
    return [round(pb.matrix_basis[i][j],5) for pb in arm.pose.bones
            if pb.name!='root' and pb.name not in {'weapon_l','weapon_r','mount_socket'}
            for i in range(3) for j in range(3)]

def verify_animation_fbx(entry, meta):
    import_one(meta['fbx'])
    arm=imported_arm(entry)
    require(not any(o.type=='MESH' for o in bpy.context.scene.objects),'Animation FBX includes mesh')
    action=arm.animation_data.action if arm.animation_data else None
    require(action is not None,f'FBX missing action {meta["name"]}')
    require(action.name==f'{entry["rig"]}|{meta["name"]}',f'FBX action name {action.name}')
    start,end=meta['frames']
    require(abs(action.frame_range[0]-start)<.01 and abs(action.frame_range[1]-end)<.01,
            f'FBX action range {action.frame_range[:]} != {meta["frames"]}')
    require(bpy.context.scene.render.fps==meta['fps'],'FBX fps')
    samples=[]
    for frame in [start,start+(end-start)//4,(start+end)//2,start+3*(end-start)//4,end]:
        bpy.context.scene.frame_set(frame)
        root=arm.pose.bones['root']
        require(max(abs(root.matrix_basis[i][j]-(1.0 if i==j else 0.0)) for i in range(4) for j in range(4))<1e-4,
                f'FBX root translation/rotation/scale changed {meta["fbx"]}')
        samples.append(basis_values(arm))
    motion=max(abs(x-y) for sample in samples[1:] for x,y in zip(samples[0],sample))
    require(motion>.005 or meta['name']=='Aim_Center',f'FBX static action {meta["fbx"]}')
    if meta.get('loop'):
        closure=max(abs(x-y) for x,y in zip(samples[0],samples[-1]))
        require(closure<.005,f'FBX loop discontinuity {meta["fbx"]}: {closure}')
    return {'name':meta['name'],'frame_range':[start,end],'motion_delta':round(motion,4),
            'first_pose':samples[0]}

def verify_fbx(entry):
    meshes=[verify_mesh_fbx(entry,{'fbx':entry['mesh_fbx']},entry['lods'][0]['triangles'])]
    meshes += [verify_mesh_fbx(entry,lod,lod['triangles']) for lod in entry['lods']]
    outline=verify_mesh_fbx(entry,{'fbx':entry['outline_fbx']},entry['lods'][0]['triangles'],outline=True)
    require(sum(x*y for x,y in zip(meshes[1]['first_face_normal'],outline['first_face_normal']))<-.5,
            'FBX outline normals are not reversed')
    animations=[verify_animation_fbx(entry,meta) for meta in entry['animations']]
    aim=[]
    if entry.get('aim_offset'):
        reference=animations[0]['first_pose']
        for pose in entry['aim_offset']['poses']:
            meta=dict(pose);meta['fbx']=meta['pose_fbx']
            result=verify_animation_fbx(entry,meta)
            require(max(abs(x-y) for x,y in zip(reference,result['first_pose']))<.005,
                    f'FBX aim additive reference differs: {pose["name"]}')
            if pose['name']=='Aim_Center':require(result['motion_delta']<.005,'Aim center is not neutral')
            aim.append(result)
    height=meshes[0]['extent_m'][2]
    for group in (animations,aim):
        for item in group:item.pop('first_pose')
    return {'mesh_fbx_checked':len(meshes)+1,'animation_fbx_checked':len(animations),
            'aim_fbx_checked':len(aim),'outline_fbx_checked':1,
            'height_cm_at_ue_scene_unit_conversion':round(height*100,2),
            'meshes':meshes,'outline':outline,'animations':animations,'aim_poses':aim}

def verify_environment(manifest):
    entries=manifest.get('environment',[])
    require({e['name'] for e in entries}=={'SM_Workshop','SM_ServiceMarker','SM_RockCluster','SM_Tree','SM_GroundTile'},
            'Environment asset set')
    result=[]
    for entry in entries:
        verify_file(entry['mesh_fbx'],entry['sha256'])
        import_one(entry['mesh_fbx'])
        require(not any(o.type=='ARMATURE' for o in bpy.context.scene.objects),'Environment contains armature')
        meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
        require(len(meshes)==1 and meshes[0].name==entry['name'],'Environment FBX mesh/name')
        obj=meshes[0]
        require(len(obj.data.polygons)==entry['triangles'],'Environment FBX triangles')
        require(all(len(poly.vertices)==3 for poly in obj.data.polygons),'Environment FBX nontriangle')
        require(max(abs(obj.matrix_world[i][j]-(1 if i==j else 0)) for i in range(4) for j in range(4))<1e-4,
                'Environment FBX transform')
        coords=[obj.matrix_world@v.co for v in obj.data.vertices]
        for i in range(3):
            require(abs(min(v[i] for v in coords)-entry['bounds']['min_m'][i])<.005,'Environment bounds min')
            require(abs(max(v[i] for v in coords)-entry['bounds']['max_m'][i])<.005,'Environment bounds max')
        require(set(entry['palette']) <= {m.name.replace('M_Env_','') for m in obj.data.materials},'Environment palette')
        result.append({'name':entry['name'],'triangles':entry['triangles']})
    return result

def verify_landscape(manifest):
    meta=manifest['landscape'];verify_file(meta['heightmap_png'],meta['sha256'])
    data=(REPO/meta['heightmap_png']).read_bytes()
    require(data.startswith(b'\x89PNG\r\n\x1a\n'),'Landscape PNG signature')
    pos=8;body=b'';size=None
    while pos<len(data):
        length=struct.unpack_from('>I',data,pos)[0]
        kind=data[pos+4:pos+8];chunk=data[pos+8:pos+8+length]
        crc=struct.unpack_from('>I',data,pos+8+length)[0]
        require(zlib.crc32(kind+chunk)&0xffffffff==crc,'Landscape PNG CRC')
        if kind==b'IHDR':
            width,height,depth,color,_,_,_=struct.unpack('>IIBBBBB',chunk)
            size=(width,height)
            require(depth==16 and color==0,'Landscape must be G16 PNG')
        if kind==b'IDAT':body+=chunk
        pos+=length+12
        if kind==b'IEND':break
    require(size==tuple(meta['resolution'])==(505,505),'Landscape resolution')
    require(meta['xy_spacing_cm']==200 and meta['unreal_z_scale_percent']==100 and
            meta['height_value_midpoint']==32768 and meta['height_cm_per_sample']==.78125,'Landscape scale metadata')
    raw=zlib.decompress(body)
    row_bytes=1+size[0]*2
    require(len(raw)==size[1]*row_bytes,'Landscape pixel data length')
    samples=[]
    for y in range(size[1]):
        row=raw[y*row_bytes:(y+1)*row_bytes]
        require(row[0]==0,'Landscape nontrivial PNG filter')
        samples.extend(struct.unpack(f'>{size[0]}H',row[1:]))
    actual=[round((value-32768)*.78125/100,4) for value in (min(samples),max(samples))]
    require(actual==meta['height_range_m'],'Landscape height range metadata')
    return {'resolution':list(size),'range_m':actual,'samples_checked':len(samples)}

def main():
    started=time.perf_counter()
    manifest=json.loads(MANIFEST.read_text())
    require(manifest['schema_version']==1 and manifest['prototype'] is True,'Manifest schema')
    require(len(manifest['archetypes'])==5,'Expected five rigs')
    require(manifest['source_forward_axis']=='+Y' and manifest['unreal_expected_forward_axis']=='+X' and
            'Unreal orientation has not been tested' in manifest['axis_validation'],'Facing axis documentation')
    settings=manifest['export_settings']
    require(settings['axis_forward']=='-Y' and settings['axis_up']=='Z' and settings['apply_scale_options']=='FBX_SCALE_UNITS',
            'Export axes/scale contract')
    report={'status':'pass','blender_version':bpy.app.version_string,
            'validation_scope':'Blender source plus Blender FBX reimport; no Unreal import executed',
            'archetypes':[]}
    try:
        for entry in manifest['archetypes']:
            for key,hashkey in [('blend','blend_sha256'),('mesh_fbx','mesh_sha256')]:verify_file(entry[key],entry[hashkey])
            for lod in entry['lods']:verify_file(lod['fbx'],lod['sha256'])
            for anim in entry['animations']:verify_file(anim['fbx'],anim['sha256'])
            verify_file(entry['outline_fbx'],entry['outline_sha256'])
            if entry.get('aim_offset'):
                for pose in entry['aim_offset']['poses']:verify_file(pose['pose_fbx'],pose['sha256'])
            source=verify_blend(entry);fbx=verify_fbx(entry)
            report['archetypes'].append({'id':entry['id'],'source':source,'fbx_reimport':fbx})
            print('VALID',entry['id'],flush=True)
        report['environment']=verify_environment(manifest)
        report['landscape']=verify_landscape(manifest)
    except Exception as exc:
        report['status']='fail';report['error']=str(exc)
        REPORT.parent.mkdir(parents=True,exist_ok=True)
        REPORT.write_text(json.dumps(report,indent=2)+'\n')
        raise
    REPORT.parent.mkdir(parents=True,exist_ok=True)
    report['fbx_mesh_files_checked']=sum(a['fbx_reimport']['mesh_fbx_checked'] for a in report['archetypes'])
    report['fbx_animation_files_checked']=sum(a['fbx_reimport']['animation_fbx_checked'] for a in report['archetypes'])
    report['fbx_aim_files_checked']=sum(a['fbx_reimport']['aim_fbx_checked'] for a in report['archetypes'])
    report['fbx_outline_files_checked']=sum(a['fbx_reimport']['outline_fbx_checked'] for a in report['archetypes'])
    report['fbx_environment_files_checked']=len(report['environment'])
    report['elapsed_seconds']=round(time.perf_counter()-started,2)
    REPORT.write_text(json.dumps(report,indent=2)+'\n')
    print('VALIDATION',REPORT,flush=True)

if __name__=='__main__':main()
