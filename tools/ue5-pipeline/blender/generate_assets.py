"""Generate deliberately simple, reproducible Blender/FBX rig prototypes.

Run with Blender 5.2 in background mode. Paths are relative to the repository.
"""
import bpy
import bmesh
import hashlib
import json
import math
import os
import struct
import zlib
from array import array
from pathlib import Path
from mathutils import Vector

REPO = Path(__file__).resolve().parents[3]
ART = REPO / 'unreal/PolpalUE/Art/Generated'
OUT = REPO / 'output/ue5-pipeline'
MANIFEST = REPO / 'tools/ue5-pipeline/manifests/pipeline.json'
ART.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

CLIPS = [
    ('Idle', 30, True), ('Walk_Fwd', 24, True), ('Run_Fwd', 18, True),
    ('Jump_Start', 15, False), ('Fall_Loop', 24, True), ('Land', 12, False),
    ('Work_Hammering', 24, True), ('Work_Mining', 30, True),
    ('Work_Watering', 30, True), ('Work_Carrying_Idle', 30, True),
    ('Work_Carrying_Walk', 24, True), ('Attack_Melee', 18, False),
    ('Attack_Cast_Skill', 24, False), ('Hit_React', 15, False),
    ('Stunned_Loop', 24, True), ('Captured_Struggle', 24, True),
    ('Sleep', 30, True),
]
AIM_POSES=[('Aim_Center',0,0),('Aim_Up',0,45),('Aim_Down',0,-45),
 ('Aim_Left',-60,0),('Aim_Right',60,0),('Aim_UpLeft',-60,45),
 ('Aim_UpRight',60,45),('Aim_DownLeft',-60,-45),('Aim_DownRight',60,-45)]

# Dimensions and part positions are in metres, +Y is front in Blender.
SPECS = [
    ('biped_standard', 'Rig_Biped_Standard', 'Fire', (0.94, .66, 1.80),
     [('pelvis',(0,0,.87),(.27,.18,.21)),('spine_01',(0,0,1.23),(.34,.22,.43)),
      ('head',(0,.01,1.57),(.25,.23,.23)),('upperarm_l',(-.47,0,1.30),(.14,.14,.20)),
      ('upperarm_r',(.47,0,1.30),(.14,.14,.20)),
      ('lowerarm_l',(-.50,0,1.12),(.12,.12,.18)),('lowerarm_r',(.50,0,1.12),(.12,.12,.18)),
      ('hand_l',(-.51,0,.98),(.13,.13,.13)),('hand_r',(.51,0,.98),(.13,.13,.13)),
      ('thigh_l',(-.17,0,.66),(.16,.17,.22)),('thigh_r',(.17,0,.66),(.16,.17,.22)),
      ('calf_l',(-.17,0,.37),(.13,.14,.23)),('calf_r',(.17,0,.37),(.13,.14,.23)),
      ('foot_l',(-.17,.12,.13),(.17,.29,.13)),
      ('foot_r',(.17,.12,.13),(.17,.29,.13))]),
    ('biped_chibi', 'Rig_Biped_Chibi', 'Electric', (.96,.67,1.18),
     [('pelvis',(0,0,.42),(.30,.22,.25)),('spine_01',(0,0,.69),(.34,.23,.29)),
      ('head',(0,.02,.94),(.44,.34,.34)),('upperarm_l',(-.43,0,.69),(.15,.16,.14)),
      ('upperarm_r',(.43,0,.69),(.15,.16,.14)),
      ('lowerarm_l',(-.46,0,.55),(.13,.13,.13)),('lowerarm_r',(.46,0,.55),(.13,.13,.13)),
      ('hand_l',(-.48,.02,.45),(.14,.14,.12)),('hand_r',(.48,.02,.45),(.14,.14,.12)),
      ('thigh_l',(-.18,0,.33),(.16,.16,.13)),('thigh_r',(.18,0,.33),(.16,.16,.13)),
      ('calf_l',(-.18,0,.22),(.13,.13,.10)),('calf_r',(.18,0,.22),(.13,.13,.10)),
      ('foot_l',(-.18,.10,.12),(.17,.22,.11)),
      ('foot_r',(.18,.10,.12),(.17,.22,.11))]),
    ('quadruped', 'Rig_Quadruped', 'Earth', (.91,1.71,1.05),
     [('pelvis',(0,-.48,.64),(.36,.37,.31)),('spine_01',(0,0,.66),(.39,.69,.34)),
      ('head',(0,.73,.82),(.30,.32,.25)),('muzzle',(0,1.00,.72),(.21,.23,.12)),
      ('foreleg_upper_l',(-.31,.39,.57),(.14,.15,.17)),('foreleg_upper_r',(.31,.39,.57),(.14,.15,.17)),
      ('foreleg_lower_l',(-.31,.39,.40),(.12,.14,.15)),('foreleg_lower_r',(.31,.39,.40),(.12,.14,.15)),
      ('hand_l',(-.31,.39,.22),(.12,.15,.16)),('hand_r',(.31,.39,.22),(.12,.15,.16)),
      ('hindleg_upper_l',(-.28,-.53,.56),(.15,.16,.17)),('hindleg_upper_r',(.28,-.53,.56),(.15,.16,.17)),
      ('hindleg_lower_l',(-.28,-.53,.39),(.12,.14,.15)),('hindleg_lower_r',(.28,-.53,.39),(.12,.14,.15)),
      ('foot_l',(-.28,-.53,.22),(.13,.16,.16)),('foot_r',(.28,-.53,.22),(.13,.16,.16)),
      ('tail',(0,-.91,.71),(.16,.36,.13)),('ear_l',(-.21,.73,1.02),(.10,.10,.18)),
      ('ear_r',(.21,.73,1.02),(.10,.10,.18))]),
    ('avian', 'Rig_Avian', 'Air', (1.98,.71,1.24),
     [('pelvis',(0,0,.48),(.27,.24,.27)),('spine_01',(0,0,.77),(.35,.29,.38)),
      ('head',(0,.10,1.08),(.23,.24,.23)),('beak',(0,.41,1.04),(.14,.22,.08)),
      ('hand_l',(-.52,0,.78),(.54,.15,.12)),('hand_r',(.52,0,.78),(.54,.15,.12)),
      ('wing_tip_l',(-.86,-.03,.71),(.27,.11,.09)),('wing_tip_r',(.86,-.03,.71),(.27,.11,.09)),
      ('foot_l',(-.17,.12,.18),(.12,.23,.16)),('foot_r',(.17,.12,.18),(.12,.23,.16)),
      ('tail',(0,-.36,.50),(.26,.30,.09))]),
    ('blob', 'Rig_Blob', 'Water', (1.10,.94,.97),
     [('pelvis',(0,0,.36),(.45,.40,.34)),('spine_01',(0,0,.57),(.53,.44,.39)),
      ('head',(0,.04,.76),(.37,.36,.22)),('hand_l',(-.48,.13,.45),(.18,.15,.17)),
      ('hand_r',(.48,.13,.45),(.18,.15,.17)),('foot_l',(-.27,.12,.13),(.17,.19,.11)),
      ('foot_r',(.27,.12,.13),(.17,.19,.11)),('crest',(0,-.12,.94),(.12,.13,.15))]),
]

PARENTS = {'pelvis':'root','spine_01':'pelvis','head':'spine_01',
 'upperarm_l':'spine_01','upperarm_r':'spine_01',
 'lowerarm_l':'upperarm_l','lowerarm_r':'upperarm_r',
 'hand_l':'lowerarm_l','hand_r':'lowerarm_r',
 'thigh_l':'pelvis','thigh_r':'pelvis','calf_l':'thigh_l','calf_r':'thigh_r',
 'foot_l':'calf_l','foot_r':'calf_r',
 'foreleg_upper_l':'spine_01','foreleg_upper_r':'spine_01',
 'foreleg_lower_l':'foreleg_upper_l','foreleg_lower_r':'foreleg_upper_r',
 'hindleg_upper_l':'pelvis','hindleg_upper_r':'pelvis',
 'hindleg_lower_l':'hindleg_upper_l','hindleg_lower_r':'hindleg_upper_r',
 'muzzle':'head','tail':'pelvis',
 'ear_l':'head','ear_r':'head','beak':'head','wing_tip_l':'hand_l',
 'wing_tip_r':'hand_r','crest':'head','weapon_l':'hand_l',
 'weapon_r':'hand_r','mount_socket':'spine_01'}

PALETTE = {'Fire':(.95,.23,.08,1),'Electric':(.98,.73,.10,1),
           'Earth':(.42,.28,.12,1),'Air':(.38,.72,.84,1),
           'Water':(.09,.62,.90,1)}

FACE_DETAILS={
 'biped_standard':[('head',(-.09,.225,1.60),(.038,.025,.042),'eye'),('head',(.09,.225,1.60),(.038,.025,.042),'eye'),('spine_01',(0,.225,1.30),(.065,.035,.065),'accent')],
 'biped_chibi':[('head',(-.14,.337,.99),(.060,.027,.067),'eye'),('head',(.14,.337,.99),(.060,.027,.067),'eye'),('head',(0,.35,.84),(.07,.025,.035),'mouth')],
 'quadruped':[('head',(-.19,.91,.90),(.052,.035,.052),'eye'),('head',(.19,.91,.90),(.052,.035,.052),'eye'),('muzzle',(0,1.23,.73),(.11,.034,.065),'mouth')],
 'avian':[('head',(-.13,.28,1.13),(.052,.03,.05),'eye'),('head',(.13,.28,1.13),(.052,.03,.05),'eye'),('spine_01',(0,.30,.84),(.07,.035,.07),'accent')],
 'blob':[('head',(-.18,.37,.78),(.07,.034,.08),'eye'),('head',(.18,.37,.78),(.07,.034,.08),'eye'),('head',(0,.40,.62),(.11,.025,.038),'mouth')],
}

def rel(path): return path.relative_to(REPO).as_posix()
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version=0
    s=bpy.context.scene
    s.unit_settings.system='METRIC'; s.unit_settings.scale_length=1.0
    s.render.fps=30
    s.frame_start=1
    return s

def rig(spec):
    key, name, element, dims, parts = spec
    # Bone positions deliberately follow each silhouette.
    positions={n:Vector(c) for n,c,_ in parts}
    positions['root']=Vector((0,0,0))
    positions['weapon_l']=positions['hand_l']+Vector((0,.15,0))
    positions['weapon_r']=positions['hand_r']+Vector((0,.15,0))
    positions['mount_socket']=positions['spine_01']+Vector((0,0,.24))
    arm_data=bpy.data.armatures.new(name)
    arm=bpy.data.objects.new(name,arm_data); bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active=arm; arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for n,p in positions.items():
        b=arm_data.edit_bones.new(n); b.head=p
        b.tail=p+Vector((0,.055,0))
        b.roll=0.0
    for prefix,terminal in [('upperarm','lowerarm'),('lowerarm','hand'),
                            ('thigh','calf'),('calf','foot'),
                            ('foreleg_upper','foreleg_lower'),('foreleg_lower','hand'),
                            ('hindleg_upper','hindleg_lower'),('hindleg_lower','foot')]:
        for side in ('l','r'):
            source=f'{prefix}_{side}'; destination=f'{terminal}_{side}'
            if source in positions and destination in positions:
                arm_data.edit_bones[source].tail=positions[destination]
    for n in positions:
        if n!='root':
            parent=PARENTS[n]
            if n.startswith('hand') and key=='quadruped': parent=n.replace('hand','foreleg_lower')
            if n.startswith('foot') and key=='quadruped': parent=n.replace('foot','hindleg_lower')
            if parent not in positions: parent='spine_01' if n.startswith(('hand','wing')) else 'pelvis'
            arm_data.edit_bones[n].parent=arm_data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    for b in arm.data.bones: b.use_deform=b.name not in {'root','weapon_l','weapon_r','mount_socket'}
    arm.show_in_front=True
    return arm, positions

def ico(subdiv):
    bm=bmesh.new(); bmesh.ops.create_icosphere(bm,subdivisions=subdiv,radius=1)
    bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
    verts=list(bm.verts); idx={v:i for i,v in enumerate(verts)}
    v=[tuple(x.co) for x in verts]
    f=[tuple(idx[x] for x in face.verts) for face in bm.faces]
    bm.free(); return v,f

def octa():
    return [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)], [
      (0,2,4),(2,1,4),(1,3,4),(3,0,4),(2,0,5),(1,2,5),(3,1,5),(0,3,5)]

def mesh_for(spec, arm, lod):
    key,name,element,dims,parts=spec
    primitive=ico(3-lod) if lod<3 else octa()
    vertices=[]; faces=[]; groups=[]; shade=[]; outline=[]; face_material=[]
    for bone,centre,scale,kind in [(n,c,r,'body') for n,c,r in parts]+FACE_DETAILS[key]:
        pv,pf=primitive; off=len(vertices)
        vertices += [tuple(centre[i]+scale[i]*v[i] for i in range(3)) for v in pv]
        faces += [tuple(off+i for i in face) for face in pf]
        groups += [bone]*len(pv)
        shade += [(0.58 if kind=='mouth' else 0.67 if v[2]<-.35 and bone in {'head','muzzle','beak','ear_l','ear_r'} else 0.82 if v[2]<-.45 else 1.0) for v in pv]
        outline += [(0.9 if kind in {'eye','accent'} else .72 if bone in {'ear_l','ear_r','wing_tip_l','wing_tip_r','crest'} else .45) for _ in pv]
        face_material += [1 if kind in {'eye','mouth'} else 2 if kind=='accent' else 0]*len(pf)
    data=bpy.data.meshes.new(f'{name}_LOD{lod}'); data.from_pydata(vertices,[],faces); data.update()
    obj=bpy.data.objects.new(data.name,data); bpy.context.collection.objects.link(obj)
    for bone in sorted(set(groups)): obj.vertex_groups.new(name=bone)
    for i,bone in enumerate(groups): obj.vertex_groups[bone].add([i],1.0,'REPLACE')
    col=data.color_attributes.new(name='ElementMask',type='FLOAT_COLOR',domain='CORNER')
    for poly in data.polygons:
        poly.use_smooth=True
        poly.material_index=face_material[poly.index]
        for li in poly.loop_indices:
            vi=data.loops[li].vertex_index
            col.data[li].color=(shade[vi],outline[vi],0,1)
    data.normals_split_custom_set([tuple(data.vertex_normals[data.loops[li].vertex_index].vector) for li in range(len(data.loops))])
    mat=bpy.data.materials.get(f'M_{element}') or bpy.data.materials.new(f'M_{element}')
    mat.diffuse_color=PALETTE[element]
    mat.use_nodes=True
    mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=PALETTE[element]
    data.materials.append(mat)
    detail=bpy.data.materials.get('M_Face_Dark') or bpy.data.materials.new('M_Face_Dark')
    detail.diffuse_color=(.015,.025,.045,1);detail.use_nodes=True
    detail.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=detail.diffuse_color
    data.materials.append(detail)
    accent=bpy.data.materials.get('M_Accent_Light') or bpy.data.materials.new('M_Accent_Light')
    accent.diffuse_color=(1,.85,.4,1);accent.use_nodes=True
    accent.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=accent.diffuse_color
    data.materials.append(accent)
    mod=obj.modifiers.new('Armature','ARMATURE'); mod.object=arm
    obj.parent=arm
    return obj

def outline_for(arm, source):
    obj=source.copy();obj.data=source.data.copy();obj.name=source.name.replace('LOD0','Outline')
    bpy.context.collection.objects.link(obj)
    mesh=obj.data
    for v in mesh.vertices:
        v.co += v.normal*.018
    mesh.flip_normals()
    for polygon in mesh.polygons: polygon.use_smooth=True;polygon.material_index=0
    mesh.materials.clear()
    material=bpy.data.materials.get('M_Prototype_Outline') or bpy.data.materials.new('M_Prototype_Outline')
    material.diffuse_color=(.015,.025,.045,1);material.use_nodes=True
    material.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=material.diffuse_color
    mesh.materials.append(material)
    return obj

def select(*objects):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]

FBX_SETTINGS=dict(use_selection=True,global_scale=1.0,apply_unit_scale=True,
 apply_scale_options='FBX_SCALE_UNITS',axis_forward='-Y',axis_up='Z',
 add_leaf_bones=False,use_armature_deform_only=False,
 armature_nodetype='NULL',use_mesh_modifiers=False,colors_type='LINEAR',
 bake_anim_use_nla_strips=False,bake_anim_use_all_actions=False,
 bake_anim_step=1.0,bake_anim_simplify_factor=0.0)

def export(path, arm, mesh=None, animated=False, clip=None):
    select(*( [arm,mesh] if mesh else [arm] ))
    settings=FBX_SETTINGS.copy()
    track=None
    if animated:
        assert clip and arm.animation_data.action is not None
        action=arm.animation_data.action; slot=arm.animation_data.action_slot
        track=arm.animation_data.nla_tracks.new();track.name=clip
        track.strips.new(clip,bpy.context.scene.frame_start,action)
        arm.animation_data.action=None
        settings['bake_anim_use_nla_strips']=True
    try:
        bpy.ops.export_scene.fbx(filepath=str(path),bake_anim=animated,**settings)
    finally:
        if track is not None:
            arm.animation_data.nla_tracks.remove(track)
            arm.animation_data.action=action;arm.animation_data.action_slot=slot

def pose_value(clip, bone, phase, archetype):
    # Distinct authored prototype motions, all around a stationary root.
    s=math.sin(phase*2*math.pi); c=math.cos(phase*2*math.pi)
    wings=archetype=='avian'; quad=archetype=='quadruped'; blob=archetype=='blob'
    limb=bone.startswith(('hand_','foot_','wing_tip_','upperarm_','lowerarm_',
                          'thigh_','calf_','foreleg_','hindleg_'))
    side=-1 if bone.endswith('_l') else 1
    if clip=='Idle': return (.035*s if bone=='spine_01' else 0,.03*c if bone=='head' else 0,0)
    if clip in {'Walk_Fwd','Run_Fwd','Work_Carrying_Walk'}:
        amp={'Walk_Fwd':.34,'Run_Fwd':.55,'Work_Carrying_Walk':.22}[clip]
        if wings and 'hand' in bone: return (0,0,side*(.18+.32*s))
        if quad and bone.startswith(('foot','hindleg')): return (-side*amp*s,0,0)
        if blob and bone=='spine_01': return (.12*s,0,0)
        if limb: return (side*amp*s,0,0)
        if bone=='pelvis':return (0,.05*s,0)
        if bone=='head':return (0,.07*c,0)
    if clip=='Jump_Start':
        if bone=='pelvis':return (-.25*math.sin(math.pi*phase),0,0)
        if limb:return (.30*math.sin(math.pi*phase),0,side*.12)
    if clip=='Fall_Loop':
        if limb:return (.25+.08*s,0,side*.15)
        if bone=='spine_01':return (.12,0,0)
    if clip=='Land':
        if bone=='pelvis':return (.35*math.sin(math.pi*phase),0,0)
        if bone=='head':return (-.15*math.sin(math.pi*phase),0,0)
    if clip in {'Work_Hammering','Work_Mining'}:
        if bone in {'hand_r','upperarm_r','spine_01'}:return ((.48 if clip=='Work_Hammering' else .64)*s,0,side*.12)
        if bone=='head':return (.10*c,0,0)
    if clip=='Work_Watering':
        if bone in {'head','muzzle','beak'}:return (-.23+.15*s,0,0)
        if bone=='spine_01':return (.10*s,0,0)
    if clip=='Work_Carrying_Idle':
        if bone in {'hand_l','hand_r'}:return (-.35+.03*s,0,side*.12)
        if bone=='spine_01':return (.03*s,0,0)
    if clip=='Attack_Melee':
        if bone in {'hand_r','head','muzzle','beak','wing_tip_r'}:return (-.8*math.sin(math.pi*phase),0,-.25*math.sin(math.pi*phase))
        if bone=='spine_01':return (0,0,-.28*math.sin(math.pi*phase))
    if clip=='Attack_Cast_Skill':
        if bone in {'hand_l','hand_r','wing_tip_l','wing_tip_r'}:return (-.55*math.sin(math.pi*phase),0,side*.35)
        if bone=='head':return (-.20*math.sin(math.pi*phase),0,0)
    if clip=='Hit_React':
        if bone in {'spine_01','head'}:return (.45*math.sin(math.pi*phase),0,0)
    if clip=='Stunned_Loop':
        if bone in {'head','spine_01'}:return (.12*s,.20*c,0)
    if clip=='Captured_Struggle':
        if limb:return (.40*s,0,side*.25*c)
        if bone=='spine_01':return (0,.22*c,0)
    if clip=='Sleep':
        if bone in {'head','spine_01'}:return (.25+.015*s,0,.12)
        if limb:return (.10,0,0)
    return (0,0,0)

def make_actions(arm, archetype):
    result=[]
    for clip,frames,loop in CLIPS:
        action=bpy.data.actions.new(clip); action.use_fake_user=True
        slot=action.slots.new('OBJECT',arm.name)
        arm.animation_data_create(); arm.animation_data.action=action
        arm.animation_data.action_slot=slot
        for frame in sorted(set((1,1+frames//4,1+frames//2,1+3*frames//4,1+frames))):
            phase=(frame-1)/frames
            for bone in arm.pose.bones:
                if bone.name=='root' or bone.name in {'weapon_l','weapon_r','mount_socket'}:continue
                v=pose_value(clip,bone.name,phase,archetype)
                bone.rotation_mode='XYZ'; bone.rotation_euler=v
                bone.keyframe_insert(data_path='rotation_euler',frame=frame,group=bone.name)
                if archetype=='blob' and bone.name in {'pelvis','spine_01'}:
                    pulse=math.sin(2*math.pi*phase)
                    amount=.12 if clip in {'Walk_Fwd','Run_Fwd','Captured_Struggle'} else .035
                    bone.scale=(1.0-amount*pulse,1.0-amount*pulse,1.0+amount*pulse)
                    bone.keyframe_insert(data_path='scale',frame=frame,group=bone.name)
        result.append((action,slot,clip,frames,loop))
    return result

def make_aim_actions(arm, idle):
    result=[]
    arm.animation_data.action=idle[0];arm.animation_data.action_slot=idle[1]
    bpy.context.scene.frame_set(1)
    reference={b.name:tuple(b.rotation_euler) for b in arm.pose.bones}
    for name,yaw,pitch in AIM_POSES:
        action=bpy.data.actions.new(name);action.use_fake_user=True
        slot=action.slots.new('OBJECT',arm.name)
        arm.animation_data.action=action;arm.animation_data.action_slot=slot
        for frame in (1,2):
            for bone in arm.pose.bones:
                if bone.name in {'root','weapon_l','weapon_r','mount_socket'}:continue
                xyz=list(reference[bone.name])
                if frame==2:
                    if bone.name=='head':
                        xyz[0]+=math.radians(pitch)*.7;xyz[2]+=math.radians(yaw)*.7
                    elif bone.name=='spine_01':
                        xyz[0]+=math.radians(pitch)*.3;xyz[2]+=math.radians(yaw)*.3
                bone.rotation_mode='XYZ';bone.rotation_euler=xyz
                bone.keyframe_insert(data_path='rotation_euler',frame=frame,group=bone.name)
        result.append((action,slot,name,yaw,pitch))
    return result

def bounds(spec):
    parts=spec[4]
    return {'min_m':[round(min(c[i]-r[i] for _,c,r in parts),4) for i in range(3)],
            'max_m':[round(max(c[i]+r[i] for _,c,r in parts),4) for i in range(3)]}

def preview(spec, arm, mesh):
    # One simple orthographic render per archetype, assembled later as contact sheet.
    for obj in bpy.context.scene.objects:
        if obj.type=='MESH': obj.hide_render=obj!=mesh
    world=bpy.context.scene.world or bpy.data.worlds.new('World')
    bpy.context.scene.world=world; world.color=(.15,.15,.15)
    cam_data=bpy.data.cameras.new('PreviewCamera'); cam=bpy.data.objects.new('PreviewCamera',cam_data)
    bpy.context.collection.objects.link(cam)
    target=Vector((0,0,spec[3][2]*.5)); cam.location=(2.3,5,2.5)
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    cam_data.type='ORTHO';cam_data.ortho_scale=max(spec[3][0],spec[3][1],spec[3][2])*1.8
    bpy.context.scene.camera=cam
    light_data=bpy.data.lights.new('PreviewLight','AREA'); light=bpy.data.objects.new('PreviewLight',light_data)
    bpy.context.collection.objects.link(light);light.location=(2,-3,4);light_data.energy=650;light_data.shape='DISK';light_data.size=5
    scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE'
    scene.render.resolution_x=384;scene.render.resolution_y=384;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/f'{spec[0]}.png')
    bpy.ops.render.render(write_still=True)

ENV_PALETTE={
 'wood':(.43,.25,.10,1),'stone':(.43,.46,.48,1),'roof':(.18,.34,.46,1),
 'grass':(.19,.48,.19,1),'soil':(.28,.20,.11,1),'signal':(.96,.66,.13,1),
 'leaf':(.12,.40,.27,1),'dark':(.035,.055,.07,1)}

ENV_SHAPES={
 'SM_Workshop':[('box',(0,0,.12),(1.65,1.45,.12),'stone'),
   ('box',(0,0,1.15),(1.45,1.25,.96),'wood'),
   ('box',(0,0,2.22),(1.62,1.43,.20),'roof'),
   ('box',(0,1.27,.77),(.34,.06,.57),'dark'),
   ('box',(-.86,1.28,1.45),(.25,.06,.23),'signal'),
   ('box',(.86,1.28,1.45),(.25,.06,.23),'signal')],
 'SM_ServiceMarker':[('box',(0,0,.10),(.55,.55,.10),'stone'),
   ('box',(0,0,.82),(.10,.10,.72),'wood'),
   ('box',(0,0,1.55),(.45,.12,.42),'roof'),
   ('ico',(0,-.145,1.55),(.25,.09,.25),'signal')],
 'SM_RockCluster':[('ico',(-.48,0,.42),(.62,.45,.42),'stone'),
   ('ico',(.39,-.22,.34),(.48,.39,.34),'stone'),
   ('ico',(.25,.40,.27),(.40,.36,.27),'stone')],
 'SM_Tree':[('box',(0,0,.80),(.20,.20,.80),'wood'),
   ('ico',(0,0,1.86),(.82,.76,.72),'leaf'),
   ('ico',(-.32,.10,1.50),(.45,.47,.40),'grass')],
 'SM_GroundTile':[('box',(0,0,-.14),(1.0,1.0,.14),'soil'),
   ('box',(0,0,.015),(1.0,1.0,.025),'grass'),
   ('ico',(-.46,.37,.08),(.18,.17,.07),'leaf'),
   ('ico',(.44,-.35,.06),(.16,.15,.05),'leaf')],
}

def cube():
    return [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),
            (1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)], [
            (0,4,6),(0,6,2),(1,3,7),(1,7,5),
            (0,1,5),(0,5,4),(2,6,7),(2,7,3),
            (0,2,3),(0,3,1),(4,5,7),(4,7,6)]

def environment_assets():
    result=[]
    for name,shapes in ENV_SHAPES.items():
        reset()
        verts=[];faces=[];materials=[]
        for shape,centre,scale,palette in shapes:
            v,f=cube() if shape=='box' else ico(1)
            offset=len(verts)
            verts.extend(tuple(centre[i]+scale[i]*p[i] for i in range(3)) for p in v)
            faces.extend(tuple(offset+j for j in poly) for poly in f)
            materials.extend([palette]*len(f))
        data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
        obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj)
        for key,color in ENV_PALETTE.items():
            mat=bpy.data.materials.new(f'M_Env_{key}')
            mat.diffuse_color=color;mat.use_nodes=True
            mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=color
            data.materials.append(mat)
        palette_keys=list(ENV_PALETTE)
        for poly in data.polygons:poly.material_index=palette_keys.index(materials[poly.index])
        path=ART/f'{name}.fbx';export(path,obj)
        result.append({'name':name,'mesh_fbx':rel(path),'sha256':sha(path),
          'palette':{k:list(ENV_PALETTE[k]) for k in sorted(set(materials))},
          'bounds':{'min_m':[round(min(v[i] for v in verts),4) for i in range(3)],
                    'max_m':[round(max(v[i] for v in verts),4) for i in range(3)]},
          'triangles':len(faces),'prototype':True,'style':'stylized low poly'})
        print('ENVIRONMENT',name,flush=True)
    return result

def landscape_heightmap():
    width=height=505
    samples=[]
    for y in range(height):
        row=[]
        for x in range(width):
            nx=(x-(width-1)/2)/((width-1)/2)
            ny=(y-(height-1)/2)/((height-1)/2)
            edge=max(0.0,1.0-.25*(nx*nx+ny*ny))
            metres=edge*(3.2*math.sin(nx*5.4)*math.cos(ny*4.7)+
                         1.1*math.sin(nx*12.2+ny*4.5))
            row.append(max(0,min(65535,round(32768+metres*100/.78125))))
        samples.append(row)
    raw=b''.join(b'\x00'+struct.pack(f'>{width}H',*row) for row in samples)
    def chunk(kind,data):
        return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
    png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,16,0,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')
    path=ART/'Landscape_505_G16.png';path.write_bytes(png)
    actual_min=min(min(row) for row in samples);actual_max=max(max(row) for row in samples)
    return {'heightmap_png':rel(path),'sha256':sha(path),'resolution':[width,height],
      'format':'PNG_G16','xy_spacing_cm':200,'unreal_z_scale_percent':100,
      'height_value_midpoint':32768,'height_cm_per_sample':.78125,
      'height_range_m':[round((actual_min-32768)*.78125/100,4),round((actual_max-32768)*.78125/100,4)],
      'prototype':True,'style':'procedural stylized terrain'}

def main():
    manifest={'schema_version':1,'prototype':True,'unit_system':'METRIC','unit_scale':1.0,
      'source_forward_axis':'+Y','unreal_expected_forward_axis':'+X',
      'axis_validation':'Blender FBX roundtrip only; Unreal orientation has not been tested',
      'blender_version':bpy.app.version_string,'export_settings':{
       'axis_forward':'-Y','axis_up':'Z','apply_scale_options':'FBX_SCALE_UNITS',
       'global_scale':1.0,'apply_unit_scale':True,'add_leaf_bones':False,
       'use_armature_deform_only':False,'animation_bake_step':1.0,
       'unreal_import_uniform_scale':1.0,'unreal_convert_scene_unit':True},
      'vertex_mask':{'R':'multiply toon shade, default 1.0 with localized 0.58-0.82 shadows',
                     'G':'outline/specularity control, authored values 0.45-0.90'},
      'notes':['Prototype meshes with rigid one-bone skinning. Not production-ready art.',
       'HeroRig Mixamo in the existing site needs an adapted skeleton/retarget; this is a separate prototype.',
       'Similar retarget chain names do not imply UE Mannequin skeleton compatibility.',
       'Aim FBX has Idle reference at frame 1 and absolute target at frame 2; configure Unreal additive settings at import.'],
      'archetypes':[]}
    for spec in SPECS:
        scene=reset();key,name,element,dims,parts=spec
        arm,positions=rig(spec)
        lod_meshes=[mesh_for(spec,arm,lod) for lod in range(4)]
        outline_mesh=outline_for(arm,lod_meshes[0])
        actions=make_actions(arm,key)
        aim_actions=make_aim_actions(arm,actions[0]) if key.startswith('biped') else []
        path=ART/f'{name}.blend'
        arm.animation_data.action=actions[0][0];arm.animation_data.action_slot=actions[0][1]
        bpy.ops.wm.save_as_mainfile(filepath=str(path))
        mesh_path=ART/f'{name}_SK.fbx'
        arm.animation_data.action=None
        export(mesh_path,arm,lod_meshes[0])
        outline_path=ART/f'{name}_Outline.fbx'
        export(outline_path,arm,outline_mesh)
        lods=[]
        for i,obj in enumerate(lod_meshes):
            fbx=ART/f'{name}_LOD{i}.fbx'
            export(fbx,arm,obj)
            lods.append({'level':i,'fbx':rel(fbx),'sha256':sha(fbx),
                         'triangles':len(obj.data.polygons),'vertices':len(obj.data.vertices)})
        animations=[]
        for action,slot,clip,frames,loop in actions:
            arm.animation_data.action=action;arm.animation_data.action_slot=slot
            scene.frame_start=1;scene.frame_end=frames+1
            fbx=ART/f'{name}_{clip}.fbx'; export(fbx,arm,animated=True,clip=clip)
            animations.append({'name':clip,'fbx':rel(fbx),'sha256':sha(fbx),
                               'fps':30,'frames':[1,frames+1],'loop':loop})
        aim_offset=None
        if aim_actions:
            aim_offset={'additive_ref':{'animation':'Idle','frame':1},
                        'pose_encoding':'reference_frame_1_then_absolute_target_frame_2',
                        'unreal_additive_setup_required':True,'poses':[]}
            for action,slot,clip,yaw,pitch in aim_actions:
                arm.animation_data.action=action;arm.animation_data.action_slot=slot
                scene.frame_start=1;scene.frame_end=2
                fbx=ART/f'{name}_{clip}.fbx';export(fbx,arm,animated=True,clip=clip)
                aim_offset['poses'].append({'name':clip,'pose_fbx':rel(fbx),'sha256':sha(fbx),
                                            'yaw':yaw,'pitch':pitch,'frames':[1,2],'fps':30})
        arm.animation_data.action=actions[0][0];arm.animation_data.action_slot=actions[0][1]
        scene.frame_set(1)
        arm_start='upperarm' if key.startswith('biped') else 'foreleg_upper' if key=='quadruped' else 'hand'
        leg_start='thigh' if key.startswith('biped') else 'hindleg_upper' if key=='quadruped' else 'foot'
        chains={'spine':['pelvis','head'],'head':['head','head'],
                'left_arm':[f'{arm_start}_l','hand_l'],'right_arm':[f'{arm_start}_r','hand_r'],
                'left_leg':[f'{leg_start}_l','foot_l'],'right_leg':[f'{leg_start}_r','foot_r']}
        if key=='avian': chains['left_wing']=['hand_l','wing_tip_l'];chains['right_wing']=['hand_r','wing_tip_r']
        if key=='quadruped':
            chains['front_left']=['foreleg_upper_l','hand_l'];chains['front_right']=['foreleg_upper_r','hand_r']
            chains['hind_left']=['hindleg_upper_l','foot_l'];chains['hind_right']=['hindleg_upper_r','foot_r']
        if key=='blob': chains['squash']=['pelvis','head']
        coordinates=[v.co for v in lod_meshes[0].data.vertices]
        actual_bounds={'min_m':[round(min(v[i] for v in coordinates),4) for i in range(3)],
                       'max_m':[round(max(v[i] for v in coordinates),4) for i in range(3)]}
        actual_dimensions=[round(actual_bounds['max_m'][i]-actual_bounds['min_m'][i],4) for i in range(3)]
        manifest['archetypes'].append({'id':key,'asset_name':name,'rig':name,
          'element':element,'prototype':True,'blend':rel(path),'blend_sha256':sha(path),
          'mesh_fbx':rel(mesh_path),'mesh_sha256':sha(mesh_path),
          'outline_fbx':rel(outline_path),'outline_sha256':sha(outline_path),
          'body_dimensions_m':actual_dimensions,'bounds':actual_bounds,
          'bones':list(positions),
          'bone_parents':{b.name:(b.parent.name if b.parent else None) for b in arm.data.bones},
          'retarget_chains':chains,'animations':animations,'lods':lods,
          'aim_offset':aim_offset,
          'max_bone_influences':1,'skin_weights':'rigid normalized'})
        preview(spec,arm,lod_meshes[0])
        print('GENERATED',name,flush=True)
    manifest['environment']=environment_assets()
    manifest['landscape']=landscape_heightmap()
    MANIFEST.write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
    width=384; height=384
    contact=bpy.data.images.new('Prototype silhouettes',width=width*len(SPECS),height=height,alpha=True)
    pixels=array('f',[0.0])*(width*height*len(SPECS)*4)
    for column,spec in enumerate(SPECS):
        source=bpy.data.images.load(str(OUT/f'{spec[0]}.png'),check_existing=False)
        tile=array('f',[0.0])*(width*height*4)
        source.pixels.foreach_get(tile)
        for row in range(height):
            start=(row*len(SPECS)*width+column*width)*4
            pixels[start:start+width*4]=tile[row*width*4:(row+1)*width*4]
    contact.pixels.foreach_set(pixels)
    contact.filepath_raw=str(OUT/'contact_sheet.png')
    contact.file_format='PNG';contact.save()
    print('MANIFEST',MANIFEST,flush=True)

if __name__=='__main__': main()
