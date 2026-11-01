"""Polpal Studio engine — review renders of a built GLB (Blender side, read-only).

Imports character.glb into an empty scene and renders fixed views plus a few
animation frames with neutral studio lighting. Nothing is saved to any .blend.

Run: Blender --background --factory-startup --python engine_render.py -- CHARACTER.glb OUT_DIR
"""
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

glb, out = (Path(a) for a in sys.argv[sys.argv.index('--')+1:][:2])
out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(glb))
scene = bpy.context.scene
arm = next(o for o in scene.objects if o.type == 'ARMATURE')
scene.render.engine = 'BLENDER_WORKBENCH'
shading = scene.display.shading
shading.light, shading.color_type, shading.show_specular_highlight = 'STUDIO', 'MATERIAL', True
shading.show_shadows = True
scene.render.resolution_x, scene.render.resolution_y = 480, 640
scene.render.film_transparent = False
scene.view_settings.view_transform = 'Standard'
cam_data = bpy.data.cameras.new('Review camera')
cam = bpy.data.objects.new('Review camera', cam_data)
scene.collection.objects.link(cam)
cam_data.type = 'ORTHO'
cam_data.ortho_scale = 2.25
scene.camera = cam
# glTF +Z forward becomes Blender -Y: the character faces -Y.
views = {'front': Vector((0, -1, 0)), 'three_quarter': Vector((.7, -.7, 0)), 'side': Vector((1, 0, 0)),
         'back': Vector((0, 1, 0))}
target = Vector((0, 0, .9))


def shoot(name, direction):
    cam.location = target+direction.normalized()*6
    cam.rotation_euler = (-direction.normalized()).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(out/f'{name}.png')
    bpy.ops.render.render(write_still=True)


rendered = []
arm.animation_data_create()
arm.animation_data.action = None
for name, direction in views.items():
    shoot(name, direction)
    rendered.append(name)
for clip, frame in (('run', 5), ('hit', 8), ('throw', 8), ('jump', 9)):
    action = bpy.data.actions.get(clip)
    if action is None:
        continue
    arm.animation_data.action = action
    if action.slots:
        arm.animation_data.action_slot = action.slots[0]
    scene.frame_set(frame)
    shoot(f'pose-{clip}', views['three_quarter'])
    rendered.append(f'pose-{clip}')
(out/'renders.json').write_text(json.dumps({'glb': glb.name, 'views': rendered, 'blender': bpy.app.version_string}, indent=2))
