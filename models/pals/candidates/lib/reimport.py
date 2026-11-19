import bpy,sys,os,math
f=sys.argv[sys.argv.index('--')+1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=f)
objs=list(bpy.context.scene.objects)
arm=[o for o in objs if o.type=='ARMATURE'];me=[o for o in objs if o.type=='MESH']
print('objects',[(o.name,o.type) for o in objs])
a=arm[0];m=me[0];ad=a.animation_data
tracks=[t.name for t in ad.nla_tracks] if ad else []
acts=[x.name for x in bpy.data.actions]
print('tracks',tracks,'actions',acts)
dg=bpy.context.evaluated_depsgraph_get()
def bounds():
    ev=m.evaluated_get(bpy.context.evaluated_depsgraph_get());mm=ev.to_mesh()
    co=[ev.matrix_world@v.co for v in mm.vertices];ev.to_mesh_clear()
    ok=all(math.isfinite(c) for v in co for c in v)
    return ok,[round(min(v[i] for v in co),3) for i in range(3)],[round(max(v[i] for v in co),3) for i in range(3)]
for t in ad.nla_tracks: t.mute=True
rest=bounds();print('rest',rest)
for t in ad.nla_tracks:
    for o in ad.nla_tracks:o.mute=(o!=t)
    st=t.strips[0];fs=[st.frame_start,(st.frame_start+st.frame_end)/2,st.frame_end]
    for fr in fs:
        bpy.context.scene.frame_set(int(fr));print(t.name,int(fr),bounds())
def cos():
    ev=m.evaluated_get(bpy.context.evaluated_depsgraph_get());mm=ev.to_mesh();c=[(ev.matrix_world@v.co).copy() for v in mm.vertices];ev.to_mesh_clear();return c
while ad.nla_tracks: ad.nla_tracks.remove(ad.nla_tracks[0])
ad.action=None;bpy.context.scene.frame_set(1);R0=cos()
for act in bpy.data.actions:
    ad.action=act
    try: ad.action_slot=act.slots[0]
    except Exception as e: print('slot',e)
    f0,f1=act.frame_range;best=0;bf=0
    for fr in range(int(f0),int(f1)+1):
        bpy.context.scene.frame_set(fr);C=cos();d=max((a-b).length for a,b in zip(C,R0))
        if d>best:best,bf=d,fr
    print('MAXDISP',act.name,round(best,3),'at',bf,'range',(f0,f1),'finite',all(math.isfinite(x) for v in C for x in v))
