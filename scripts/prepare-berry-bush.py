"""Build a compact, stylized berry bush for the world.

Run: blender --background --python scripts/prepare-berry-bush.py
"""
import math
import random
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/assets/berry-bush.blend'
PREVIEW = ROOT / 'docs/assets/berry-bush-preview.png'
EXPORT = ROOT / 'site/assets/models/berry-bush.glb'
RNG = random.Random(2847)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0


def material(name, color, roughness=0.9):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    return mat


stem_mat = material('Warm twig', (0.23, 0.29, 0.10))
dark_mat = material('Leaf shade', (0.08, 0.33, 0.13))
leaf_mat = material('Leaf green', (0.20, 0.57, 0.16))
light_mat = material('Leaf sunlight', (0.37, 0.72, 0.19))
berry_mat = material('Blueberries', (0.12, 0.16, 0.54), 0.55)
berry_highlight_mat = material('Berry crowns', (0.28, 0.35, 0.69), 0.7)


def ico(name, location, scale, mat, subdivisions=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    return obj


def cylinder_between(name, a, b, radius, mat, vertices=5):
    middle = (Vector(a) + Vector(b)) / 2
    direction = Vector(b) - Vector(a)
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=direction.length, location=middle)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction.to_track_quat('Z', 'Y').to_euler()
    obj.data.materials.append(mat)
    return obj


# A few dark rounded clumps give the foliage volume at game-camera distance.
for index, (loc, scale) in enumerate([
    ((0, .37, 0), (.34, .29, .31)),
    ((-.27, .34, .05), (.27, .25, .27)),
    ((.26, .37, -.05), (.28, .26, .27)),
]):
    ico(f'Foliage core {index}', loc, scale, dark_mat)

for i in range(8):
    angle = i * math.tau / 8 + .15
    tip = (math.cos(angle) * .34, .38 + (i % 3) * .055, math.sin(angle) * .28)
    cylinder_between(f'Twig {i}', (0, .018, 0), tip, .018, stem_mat)

# Pointed, folded leaves are readable in silhouette without texture alpha.
for layer, count in enumerate((11, 11)):
    for i in range(count):
        a = (i + (layer * .48)) * math.tau / count + RNG.uniform(-.09, .09)
        radius = (.33 if layer == 0 else .23) + RNG.uniform(-.03, .04)
        y = (.47 if layer == 0 else .65) + RNG.uniform(-.05, .04)
        center = Vector((math.cos(a) * radius, y, math.sin(a) * radius))
        outward = Vector((math.cos(a), 0, math.sin(a)))
        tangent = Vector((-math.sin(a), 0, math.cos(a)))
        length = .28 if layer == 0 else .24
        width = .105 if layer == 0 else .09
        root = center - outward * length * .47
        tip = center + outward * length * .56 + Vector((0, -.055 if layer == 0 else .04, 0))
        left = center + tangent * width
        right = center - tangent * width
        ridge = center + Vector((0, .04, 0))
        verts = [root, left, tip, right, ridge]
        faces = [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)]
        mesh = bpy.data.meshes.new(f'Leaf mesh {layer}-{i}')
        mesh.from_pydata(verts, [], faces)
        mesh.materials.append(light_mat if (i + layer) % 3 == 0 else leaf_mat)
        leaf = bpy.data.objects.new(f'Leaf {layer}-{i}', mesh)
        bpy.context.collection.objects.link(leaf)

# Low-poly berry clusters are placed around the rim so they remain visible.
for i in range(12):
    a = i * math.tau / 12 + .19
    radius = .39 + RNG.uniform(-.025, .045)
    y = .34 + (i % 3) * .075
    pos = (math.cos(a) * radius, y, math.sin(a) * radius)
    ico(f'Berry {i}', pos, (.061, .068, .061), berry_mat)
    crown = (pos[0], y + .063, pos[2])
    ico(f'Berry crown {i}', crown, (.019, .009, .019), berry_highlight_mat, 0)

# Apply object transforms, then merge by material: six draw calls per bush.
for obj in list(bpy.context.scene.objects):
    if obj.type != 'MESH':
        continue
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

for mat in (stem_mat, dark_mat, leaf_mat, light_mat, berry_mat, berry_highlight_mat):
    objects = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.data.materials[0] == mat]
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    objects[0].name = mat.name.replace(' ', '_')

# One material and vertex colors keep every bush to a single draw call.
white = material('Bush vertex colors', (1, 1, 1))
nodes = white.node_tree.nodes
vertex_color = nodes.new('ShaderNodeVertexColor')
vertex_color.layer_name = 'Color'
white.node_tree.links.new(vertex_color.outputs['Color'], nodes.get('Principled BSDF').inputs['Base Color'])
for obj in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
    tint = obj.data.materials[0].diffuse_color
    colors = obj.data.color_attributes.new(name='Color', type='BYTE_COLOR', domain='CORNER')
    for loop in colors.data:
        loop.color = tint
    obj.data.materials.clear()
    obj.data.materials.append(white)
bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
bpy.ops.object.join()
bpy.context.view_layer.objects.active.name = 'Berry_bush'

# Viewable source scene and a reproducible preview. Only bush meshes enter the GLB.
bush_meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
bpy.ops.mesh.primitive_plane_add(size=2.2, location=(0, -.025, 0), rotation=(math.pi / 2, 0, 0))
ground = bpy.context.object
ground.name = 'Preview ground (not exported)'
ground.data.materials.append(material('Preview grass', (0.27, 0.43, 0.20)))
bpy.ops.object.camera_add(location=(1.9, 1.0, 2.35))
camera = bpy.context.object
back = (camera.location - Vector((0, .36, 0))).normalized()
right = Vector((0, 1, 0)).cross(back).normalized()
camera_up = back.cross(right).normalized()
camera.rotation_euler = Matrix((right, camera_up, back)).transposed().to_quaternion().to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 1.65
bpy.context.scene.camera = camera
bpy.ops.object.light_add(type='AREA', location=(1.2, 2.5, 1.8))
bpy.context.object.data.energy = 450
bpy.context.object.data.shape = 'DISK'
bpy.context.object.data.size = 3
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = scene.render.resolution_y = 640
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(PREVIEW)
scene.world.color = (.16, .19, .20)
SOURCE.parent.mkdir(parents=True, exist_ok=True)
EXPORT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action='DESELECT')
meshes = bush_meshes
for obj in meshes:
    obj.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.export_scene.gltf(filepath=str(EXPORT), export_format='GLB', use_selection=True,
                          export_apply=True, export_yup=False,
                          export_normals=True, export_materials='EXPORT')
triangles = sum(sum(len(poly.vertices) - 2 for poly in obj.data.polygons) for obj in meshes)
print(f'Wrote {SOURCE}, {PREVIEW}, {EXPORT}; {triangles} triangles across {len(meshes)} meshes')
