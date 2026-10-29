"""Create the modular 3 m timber roof, preview, Blender source, and game GLB.

Run: blender --background --python scripts/prepare-building-roof.py
"""
from pathlib import Path
import math
import random

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/assets/building-roof.blend'
PREVIEW = ROOT / 'docs/assets/building-roof-preview.png'
EXPORT = ROOT / 'site/assets/models/building-roof.glb'

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0
random.seed(5914)


def material(name, color):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = .88
    return mat


surface = material('Roof_Surface', (.42, .23, .11))
trim = material('Roof_Trim', (.30, .16, .075))
objects = []


def mesh(name, verts, faces, mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.materials.append(mat)
    data.update()
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    objects.append(ob)
    for poly in data.polygons:
        poly.use_smooth = False
    return ob


def beam(name, a, b, width, depth, mat=trim):
    direction = Vector(b) - Vector(a)
    mid = (Vector(a) + Vector(b)) / 2
    bpy.ops.mesh.primitive_cube_add(size=1, location=mid)
    ob = bpy.context.object
    ob.name = name
    ob.dimensions = (width, depth, direction.length)
    ob.rotation_euler = direction.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.data.materials.append(mat)
    objects.append(ob)
    return ob


# Blender uses Z up. GLB export turns this into game Y up. Eaves fit a
# 3 m cell with 18 cm overhang; the ridge reaches 1.68 m above wall top.
eave = 1.68
ridge = 1.68
run = 1.68
for side in (-1, 1):
    # Thin continuous decking prevents gaps between the individually cut shakes.
    verts = [(0, -eave, ridge-.07), (side*run, -eave, -.07),
             (side*run, eave, -.07), (0, eave, ridge-.07),
             (0, -eave, ridge-.15), (side*run, -eave, -.15),
             (side*run, eave, -.15), (0, eave, ridge-.15)]
    mesh(f'Roof_Surface_Deck_{side:+d}', verts,
         [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1),
          (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)], surface)
    # Three overlapping courses, each with staggered plank joints and
    # slight variations in width and pitch for a hand-built silhouette.
    for row in range(4):
        divisions = 7
        offset = (row % 2) * .19
        for col in range(divisions+1):
            y0 = -eave + col*(2*eave/divisions) - offset
            y1 = y0 + 2*eave/divisions + .035
            y0, y1 = max(-eave-.035, y0), min(eave+.035, y1)
            if y1-y0 < .09:
                continue
            t0, t1 = row/4, min(1, (row+1)/4+.055)
            jitter = random.uniform(-.023, .023)
            x0, x1 = side*run*t0, side*run*t1
            z0, z1 = ridge*(1-t0)+.045+jitter, ridge*(1-t1)+.045+jitter
            # Raised lower edge gives each shake a visible thickness.
            verts = [(x0, y0, z0), (x1, y0, z1), (x1, y1, z1), (x0, y1, z0),
                     (x0, y0, z0-.035), (x1, y0, z1-.035),
                     (x1, y1, z1-.035), (x0, y1, z0-.035)]
            mesh(f'Roof_Surface_Shake_{side:+d}_{row}_{col}', verts,
                 [(0,1,2,3), (0,4,5,1), (1,5,6,2), (2,6,7,3),
                  (3,7,4,0), (4,7,6,5)], surface)
    for y in (-1.48, 0, 1.48):
        beam(f'Roof_Trim_Rafter_{side:+d}_{y:+.2f}',
             (0,y,ridge-.21), (side*run,y,-.20), .10, .13)
    beam(f'Roof_Trim_Fascia_{side:+d}',
         (side*run,-eave,-.10), (side*run,eave,-.10), .13, .18)

# Gable framing and a rounded ridge cap add depth without closing the attic.
for y in (-1.52, 1.52):
    for side in (-1, 1):
        beam(f'Roof_Trim_Gable_{side:+d}_{y:+.2f}',
             (0,y,ridge-.12), (side*1.51,y,.05), .10, .12)
beam('Roof_Trim_Ridge', (0,-1.75,ridge+.045), (0,1.75,ridge+.045), .15, .15)

# Join by material to keep the exported model lightweight and make material
# remapping in Three.js stable for either resource variant and ghost preview.
for mat, name in ((surface, 'Roof_Surface'), (trim, 'Roof_Trim')):
    bpy.ops.object.select_all(action='DESELECT')
    members = [ob for ob in bpy.data.objects if ob.type == 'MESH' and ob.data.materials and ob.data.materials[0] == mat]
    for ob in members:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = members[0]
    bpy.ops.object.join()
    members[0].name = name
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(island_margin=.015)
    bpy.ops.object.mode_set(mode='OBJECT')

SOURCE.parent.mkdir(parents=True, exist_ok=True)
EXPORT.parent.mkdir(parents=True, exist_ok=True)

# A studio render is included to inspect the silhouette and weathering.
world = bpy.context.scene.world
world.color = (.28, .34, .43)
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (.28, .34, .43, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = .8
bpy.ops.object.light_add(type='AREA', location=(2.7, -4.5, 6))
light = bpy.context.object
light.name = 'Preview_Light'
light.data.energy = 650
light.data.shape = 'DISK'
light.data.size = 5
bpy.ops.object.camera_add(location=(5.3, -6.8, 4.2))
cam = bpy.context.object
cam.name = 'Preview_Camera'
point = Vector((0,0,.7))
cam.rotation_euler = (point-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.context.scene.camera = cam
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.render.resolution_x = 900
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(PREVIEW)
scene.render.film_transparent = True
bpy.ops.render.render(write_still=True)

bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
bpy.ops.object.select_all(action='DESELECT')
for ob in bpy.data.objects:
    if ob.name in ('Roof_Surface', 'Roof_Trim'):
        ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(EXPORT), export_format='GLB', use_selection=True,
                          export_apply=True, export_normals=True,
                          export_materials='EXPORT')
print(f'Wrote {SOURCE}, {PREVIEW}, and {EXPORT}')
