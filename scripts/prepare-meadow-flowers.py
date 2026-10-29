"""Create a low-poly meadow flower and an inspection render.

Run: blender --background --python scripts/prepare-meadow-flowers.py
"""
import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/assets/meadow-flowers.blend"
PREVIEW = ROOT / "docs/assets/meadow-flowers-preview.png"
EXPORT = ROOT / "site/assets/models/meadow-flowers.glb"

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0

vertices = []
faces = []
colors = []


def vertex(point):
    vertices.append(point)
    return len(vertices) - 1


def face(indices, color):
    faces.append(indices)
    colors.append(color)


# Game placement uses H(x,z)+0.1, so the model's root is 0.1 below its origin.
base, crown = -0.1, 0.28
green = (0.17, 0.43, 0.15, 1)
light_green = (0.30, 0.57, 0.20, 1)
petal = (0.97, 0.68, 0.69, 1)
petal_tip = (1.0, 0.84, 0.78, 1)
gold = (1.0, 0.68, 0.13, 1)
gold_light = (1.0, 0.84, 0.30, 1)

# Five-sided tapered stem, with its foot exactly at the terrain after placement.
stem_bottom = []
stem_top = []
for i in range(5):
    a = 2 * math.pi * i / 5
    stem_bottom.append(vertex((0.012 * math.cos(a), 0.012 * math.sin(a), base)))
    stem_top.append(vertex((0.008 * math.cos(a), 0.008 * math.sin(a), crown)))
for i in range(5):
    j = (i + 1) % 5
    face((stem_bottom[i], stem_bottom[j], stem_top[j]), green)
    face((stem_bottom[i], stem_top[j], stem_top[i]), light_green)

# Folded broad leaves have two sides and remain readable from either camera side.
for a, height in ((0.5, 0.06), (3.45, 0.12)):
    direction = Vector((math.cos(a), math.sin(a), 0))
    side = Vector((-math.sin(a), math.cos(a), 0))
    root = vertex((0, 0, height))
    left = vertex(tuple(direction * 0.077 + side * 0.038 + Vector((0, 0, height + 0.021))))
    right = vertex(tuple(direction * 0.077 - side * 0.038 + Vector((0, 0, height + 0.021))))
    tip = vertex(tuple(direction * 0.155 + Vector((0, 0, height + 0.006))))
    face((root, left, tip), light_green)
    face((root, tip, right), green)

# Each petal has a gently raised middle ridge and a rounded, tapered silhouette.
for i in range(6):
    a = 2 * math.pi * i / 6
    d = Vector((math.cos(a), math.sin(a), 0))
    s = Vector((-math.sin(a), math.cos(a), 0))
    points = [
        d * 0.026 + Vector((0, 0, crown + 0.012)),
        d * 0.075 - s * 0.041 + Vector((0, 0, crown + 0.033)),
        d * 0.075 + s * 0.041 + Vector((0, 0, crown + 0.033)),
        d * 0.124 - s * 0.043 + Vector((0, 0, crown + 0.038)),
        d * 0.124 + s * 0.043 + Vector((0, 0, crown + 0.038)),
        d * 0.153 + Vector((0, 0, crown + 0.019)),
    ]
    p = [vertex(tuple(q)) for q in points]
    for tri, shade in (((0, 1, 2), petal), ((1, 3, 4), petal),
                       ((1, 4, 2), petal_tip), ((3, 5, 4), petal_tip)):
        face(tuple(p[n] for n in tri), shade)

# Golden raised disk: a darker skirt and brighter top cap.
lower = []
upper = []
for i in range(8):
    a = 2 * math.pi * i / 8
    lower.append(vertex((0.034 * math.cos(a), 0.034 * math.sin(a), crown + 0.032)))
    upper.append(vertex((0.025 * math.cos(a), 0.025 * math.sin(a), crown + 0.049)))
center = vertex((0, 0, crown + 0.055))
for i in range(8):
    j = (i + 1) % 8
    face((lower[i], lower[j], upper[j]), gold)
    face((lower[i], upper[j], upper[i]), gold)
    face((upper[i], upper[j], center), gold_light)

mesh = bpy.data.meshes.new("MeadowFlowerGeometry")
mesh.from_pydata(vertices, [], faces)
mesh.update()
flower = bpy.data.objects.new("MeadowFlower", mesh)
bpy.context.collection.objects.link(flower)
layer = mesh.color_attributes.new(name="FlowerColor", type="FLOAT_COLOR", domain="CORNER")
for poly, color in zip(mesh.polygons, colors):
    for loop in poly.loop_indices:
        layer.data[loop].color = color

material = bpy.data.materials.new("MeadowFlowerVertexColor")
material.use_nodes = True
nodes = material.node_tree.nodes
bsdf = nodes.get("Principled BSDF")
attribute = nodes.new("ShaderNodeVertexColor")
attribute.layer_name = layer.name
material.node_tree.links.new(attribute.outputs["Color"], bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value = 0.85
material.diffuse_color = petal
mesh.materials.append(material)

SOURCE.parent.mkdir(parents=True, exist_ok=True)
EXPORT.parent.mkdir(parents=True, exist_ok=True)

# Preview uses only Blender-owned scene objects; the GLB selection remains one mesh.
ground_mat = bpy.data.materials.new("PreviewGrass")
ground_mat.diffuse_color = (0.25, 0.38, 0.18, 1)
ground_mat.use_nodes = True
ground_mat.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = ground_mat.diffuse_color
bpy.ops.mesh.primitive_plane_add(size=1.4, location=(0, 0, -0.105))
ground = bpy.context.object
ground.name = "PreviewGround"
ground.data.materials.append(ground_mat)
for position, energy, size in (((-1.4, -1.2, 2.4), 45, 2.0), ((0.8, 1.4, 2.0), 25, 1.5)):
    light_data = bpy.data.lights.new("PreviewSoftbox", "AREA")
    light_data.energy, light_data.shape, light_data.size = energy, "DISK", size
    light = bpy.data.objects.new("PreviewSoftbox", light_data)
    bpy.context.collection.objects.link(light)
    light.location = position
    light.rotation_euler = (Vector((0, 0, 0.15)) - light.location).to_track_quat("-Z", "Y").to_euler()
camera_data = bpy.data.cameras.new("PreviewCamera")
camera = bpy.data.objects.new("PreviewCamera", camera_data)
bpy.context.collection.objects.link(camera)
camera.location = (0.75, -0.9, 0.8)
camera.rotation_euler = (Vector((0, 0, 0.12)) - camera.location).to_track_quat("-Z", "Y").to_euler()
camera_data.type = "ORTHO"
camera_data.ortho_scale = 0.67
bpy.context.scene.camera = camera
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 32
scene.render.resolution_x = scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(PREVIEW)
scene.world.color = (0.6, 0.7, 0.8)
scene.view_settings.view_transform = "Standard"

bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action="DESELECT")
flower.select_set(True)
bpy.context.view_layer.objects.active = flower
bpy.ops.export_scene.gltf(filepath=str(EXPORT), export_format="GLB", use_selection=True,
                          export_apply=True, export_normals=True,
                          export_materials="EXPORT")
print(f"Flower: {len(vertices)} vertices, {len(faces)} triangles; wrote {SOURCE}, {PREVIEW}, {EXPORT}")
