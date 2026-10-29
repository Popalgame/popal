"""Build the collectable mushroom cluster.

Run: blender --background --python scripts/prepare-mushroom.py
The mesh is authored Y-up to match Three.js and exported without axis conversion.
"""
import math
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/assets/mushroom.blend'
PREVIEW = ROOT / 'docs/assets/mushroom-preview.png'
EXPORT = ROOT / 'site/assets/models/mushroom.glb'

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0

verts, faces, colors = [], [], []
PALETTE = {
    'stem': (.83, .73, .52, 1), 'stem_light': (1, .91, .68, 1),
    'gill': (.64, .43, .31, 1), 'gill_light': (.89, .65, .46, 1),
    'cap_red': (.77, .12, .10, 1), 'cap_lit': (1, .29, .15, 1),
    'cap_dark': (.50, .075, .07, 1), 'spot': (1, .94, .70, 1),
    'moss': (.22, .41, .16, 1), 'moss_light': (.43, .59, .19, 1),
}


def polygon(points, color):
    offset = len(verts)
    verts.extend(points)
    faces.append(tuple(range(offset, offset + len(points))))
    colors.append(PALETTE[color])


def mushroom(cx, cz, height, radius, phase):
    count = 12
    stem_h = height * .66
    # Slightly bent, tapered stalk. Cap silhouette rises to a rounded crown.
    for i in range(count):
        a = math.tau * i / count + phase
        b = math.tau * (i + 1) / count + phase
        def ring(angle, y, r, bend):
            return (cx + math.cos(angle) * r + bend, y, cz + math.sin(angle) * r)
        polygon([ring(a, .015, radius * .21, 0), ring(b, .015, radius * .21, 0),
                 ring(b, stem_h, radius * .15, radius * .10),
                 ring(a, stem_h, radius * .15, radius * .10)],
                'stem_light' if i % 4 < 2 else 'stem')
    # Warm radial gills beneath an overhanging rim.
    for i in range(count):
        a = math.tau * i / count + phase
        b = math.tau * (i + 1) / count + phase
        cx2 = cx + radius * .10
        polygon([(cx2, stem_h + radius * .08, cz),
                 (cx2 + math.cos(b) * radius, stem_h - radius * .02, cz + math.sin(b) * radius),
                 (cx2 + math.cos(a) * radius, stem_h - radius * .02, cz + math.sin(a) * radius)],
                'gill_light' if i % 3 else 'gill')
    # Three rings make a plump, pitched cap without a high polygon count.
    rings = [(.98, 0), (.83, .30), (.43, .65)]
    for ring_index in range(2):
        r0, y0 = rings[ring_index]
        r1, y1 = rings[ring_index + 1]
        for i in range(count):
            a = math.tau * i / count + phase
            b = math.tau * (i + 1) / count + phase
            def p(angle, r, rise):
                return (cx + radius * .10 + math.cos(angle) * radius * r,
                        stem_h + radius * rise,
                        cz + math.sin(angle) * radius * r)
            polygon([p(a, r0, y0), p(b, r0, y0), p(b, r1, y1), p(a, r1, y1)],
                    'cap_lit' if (i + ring_index) % 5 < 2 else 'cap_red')
    for i in range(count):
        a = math.tau * i / count + phase
        b = math.tau * (i + 1) / count + phase
        polygon([(cx + radius * .10, stem_h + radius * .80, cz),
                 (cx + radius * (.10 + .43 * math.cos(a)), stem_h + radius * .65, cz + radius * .43 * math.sin(a)),
                 (cx + radius * (.10 + .43 * math.cos(b)), stem_h + radius * .65, cz + radius * .43 * math.sin(b))],
                'cap_lit' if i % 3 else 'cap_red')
    # Ivory flecks lie on the cap surface. Each patch costs two triangles.
    for k, (angle, distance) in enumerate(((.35, .62), (1.7, .49), (3.0, .70), (4.15, .52), (5.45, .68))):
        a = angle + phase
        x = cx + radius * (.10 + distance * math.cos(a))
        z = cz + radius * distance * math.sin(a)
        y = stem_h + radius * (.65 - (distance - .43) * .73) + .006
        size = radius * (.10 if k % 2 else .13)
        polygon([(x - size, y, z), (x, y + size * .18, z - size),
                 (x + size, y, z), (x, y + size * .18, z + size)], 'spot')


# Three cap sizes make the collectible readable from the game's elevated camera.
mushroom(-.12, -.04, .47, .205, .13)
mushroom(.19, .09, .34, .150, .43)
mushroom(-.24, .19, .28, .118, -.17)
# Low moss blades connect the cluster to the ground without transparent textures.
for i in range(12):
    a = math.tau * i / 12
    r = .17 + (i % 3) * .055
    x, z = math.cos(a) * r, math.sin(a) * r
    tangent = Vector((-math.sin(a), 0, math.cos(a)))
    base = Vector((x, .012, z))
    tip = base + Vector((math.cos(a) * .07, .055 + (i % 3) * .017, math.sin(a) * .07))
    polygon([base - tangent * .027, base + tangent * .027, tip],
            'moss_light' if i % 3 == 0 else 'moss')

mesh = bpy.data.meshes.new('Mushroom cluster geometry')
mesh.from_pydata(verts, [], faces)
mesh.update()
color_layer = mesh.color_attributes.new(name='Color', type='BYTE_COLOR', domain='CORNER')
for face, color in zip(mesh.polygons, colors):
    for loop_index in face.loop_indices:
        color_layer.data[loop_index].color = color
mat = bpy.data.materials.new('Mushroom vertex colors')
mat.use_nodes = True
mat.diffuse_color = (1, 1, 1, 1)
bsdf = mat.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Roughness'].default_value = .88
attribute = mat.node_tree.nodes.new('ShaderNodeVertexColor')
attribute.layer_name = 'Color'
mat.node_tree.links.new(attribute.outputs['Color'], bsdf.inputs['Base Color'])
mesh.materials.append(mat)
cluster = bpy.data.objects.new('Collectible mushrooms', mesh)
bpy.context.collection.objects.link(cluster)

# A source scene with a ground plane, soft key light, and rendered preview.
bpy.ops.mesh.primitive_plane_add(size=2.1, location=(0, -.012, 0), rotation=(math.pi / 2, 0, 0))
ground = bpy.context.object
ground.name = 'Preview ground (not exported)'
ground_mat = bpy.data.materials.new('Preview meadow')
ground_mat.diffuse_color = (.20, .38, .16, 1)
ground_mat.use_nodes = True
ground_mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = (.20, .38, .16, 1)
ground.data.materials.append(ground_mat)
bpy.ops.object.camera_add(location=(1.1, .85, 1.55))
camera = bpy.context.object
back = (camera.location - Vector((0, .23, 0))).normalized()
right = Vector((0, 1, 0)).cross(back).normalized()
camera_up = back.cross(right).normalized()
camera.rotation_euler = Matrix((right, camera_up, back)).transposed().to_quaternion().to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 1.18
bpy.context.scene.camera = camera
bpy.ops.object.light_add(type='AREA', location=(-.8, 1.8, 1.1))
bpy.context.object.data.energy = 300
bpy.context.object.data.shape = 'DISK'
bpy.context.object.data.size = 2
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.view_settings.view_transform = 'Standard'
scene.render.resolution_x = scene.render.resolution_y = 640
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(PREVIEW)
scene.world.color = (.19, .22, .24)
SOURCE.parent.mkdir(parents=True, exist_ok=True)
EXPORT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action='DESELECT')
cluster.select_set(True)
bpy.context.view_layer.objects.active = cluster
bpy.ops.export_scene.gltf(filepath=str(EXPORT), export_format='GLB', use_selection=True,
                          export_apply=True, export_yup=False,
                          export_normals=True, export_materials='EXPORT')
print(f'Wrote {SOURCE}, {PREVIEW}, {EXPORT}; {len(faces)} polygons, one mesh')
