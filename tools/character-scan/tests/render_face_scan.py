"""Matched rendered inspection of the copied face from the integration study."""
import argparse
from pathlib import Path
import sys

import bpy
from mathutils import Vector

p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True)
args=p.parse_args(sys.argv[sys.argv.index('--')+1:]);args.out.mkdir(parents=True,exist_ok=False)
scene=bpy.context.scene;camera=scene.camera
source=bpy.data.objects['Face - clean cheek and jaw surface']
fitted=next(o for o in scene.objects if 'face_scan_fit' in o)
visibility=[(o,o.hide_render) for o in scene.objects]
old=(camera.location.copy(),camera.rotation_euler.copy(),camera.data.ortho_scale,
     scene.render.resolution_x,scene.render.resolution_y,scene.render.filepath,fitted.matrix_world.copy())
try:
    # Render the normal character assembly, swapping only the copied face.
    for ob in scene.objects:
        if any(c.name.startswith('Face Scan') for c in ob.users_collection):ob.hide_render=True
    fitted.matrix_world=source.matrix_world.copy()
    target=Vector((0,0,(1973-770)*1.8/1773))
    camera.location=(0,-6,target.z)
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.ortho_scale=.52
    scene.render.resolution_x=scene.render.resolution_y=960
    for name,after in (('before',False),('after',True)):
        source.hide_render=after;fitted.hide_render=not after
        scene.render.filepath=str(args.out/(name+'.png'))
        bpy.ops.render.render(write_still=True)
finally:
    for ob,hidden in visibility:ob.hide_render=hidden
    (camera.location,camera.rotation_euler,camera.data.ortho_scale,
     scene.render.resolution_x,scene.render.resolution_y,scene.render.filepath,fitted.matrix_world)=old
