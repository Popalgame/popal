"""Polpal Studio engine — identical EEVEE review renders of a GLB (Blender side, read-only).

Run: Blender --background --factory-startup --python engine_compare.py -- CHARACTER.glb OUT_DIR LABEL
Views: front, three-quarter, back, face close-up and a run frame, same lights and cameras for every GLB.
"""
import sys
from pathlib import Path

import bpy
from mathutils import Vector

glb, out, label = sys.argv[sys.argv.index('--')+1:][:3]
glb, out = Path(glb), Path(out)
out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(glb))
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x, scene.render.resolution_y = 600, 800
scene.view_settings.view_transform = 'Standard'
world = bpy.data.worlds.new('Review world')
world.color = (.18, .19, .2)
scene.world = world
for name, loc, energy in (('Key', (2.5, -3.5, 3.5), 900), ('Fill', (-3, -2, 2), 450), ('Rim', (0, 3.5, 3), 600)):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.size = energy, 3
    light = bpy.data.objects.new(name, data)
    light.location = loc
    light.rotation_euler = (Vector((0, 0, 1))-Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(light)
cam_data = bpy.data.cameras.new('Review camera')
cam_data.type = 'ORTHO'
cam = bpy.data.objects.new('Review camera', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
arm = next((o for o in scene.objects if o.type == 'ARMATURE'), None)


def shoot(name, direction, target, scale):
    cam_data.ortho_scale = scale
    direction = Vector(direction).normalized()
    cam.location = Vector(target)+direction*6
    cam.rotation_euler = (-direction).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(out/f'{label}-{name}.png')
    bpy.ops.render.render(write_still=True)


if arm and arm.animation_data:
    arm.animation_data.action = None
    for track in arm.animation_data.nla_tracks:
        track.mute = True
for name, direction, target, scale in (('front', (0, -1, 0), (0, 0, .9), 2.2), ('three_quarter', (.7, -.7, .1), (0, 0, .9), 2.2),
                                       ('back', (0, 1, 0), (0, 0, .9), 2.2), ('face', (0, -1, 0), (0, 0, 1.38), .7)):
    shoot(name, direction, target, scale)
# The glTF importer stores clips as NLA tracks; play only the wanted one.
for clip, at in (('run', .5), ('hit', .5), ('throw', .55)):
    action = bpy.data.actions.get(clip)
    if not (arm and arm.animation_data and action):
        continue
    for track in arm.animation_data.nla_tracks:
        track.mute = not any(strip.action == action for strip in track.strips)
    scene.frame_set(int(action.frame_range[0]+(action.frame_range[1]-action.frame_range[0])*at))
    shoot(clip, (.7, -.7, .1), (0, 0, .9), 2.2)
