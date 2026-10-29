"""Create tileable building textures and a Blender source/preview.

Run: blender -b --python scripts/create-building-textures.py
"""
from pathlib import Path
import math
import bpy
import mathutils


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "site/assets/building"
SOURCE = ROOT / "docs/assets/building-materials.blend"
PREVIEW = ROOT / "docs/assets/building-materials-preview.png"
SIZE = 256


def clamp(value):
    return max(0.0, min(1.0, value))


def hash2(x, y, seed):
    value = math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
    return value - math.floor(value)


def noise(x, y, cells_x, cells_y, seed):
    px, py = x * cells_x, y * cells_y
    ix, iy = math.floor(px), math.floor(py)
    fx, fy = px - ix, py - iy
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a = hash2(ix % cells_x, iy % cells_y, seed)
    b = hash2((ix + 1) % cells_x, iy % cells_y, seed)
    c = hash2(ix % cells_x, (iy + 1) % cells_y, seed)
    d = hash2((ix + 1) % cells_x, (iy + 1) % cells_y, seed)
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def wood(x, y):
    u, v = x / SIZE, y / SIZE
    row = y // 32
    ly = y % 32
    board = hash2(row, 0, 3)
    grain = noise(u, v, 18, 8, 5) * .13 + noise(u, v, 47, 8, 7) * .065
    fibers = math.sin((v + noise(u, v, 8, 8, 9) * .018) * 256 * .95) * .035
    tone = .78 + board * .17 + grain + fibers
    edge = min(ly, 31 - ly)
    if edge == 0:
        return (.25, .15, .08)
    if edge < 2:
        tone *= .76
    elif edge < 4:
        tone *= .89
    # Sparse knots repeat exactly at tile boundaries.
    for knot_x, knot_y in ((.24, .19), (.78, .56), (.47, .83)):
        dx = min(abs(u - knot_x), 1 - abs(u - knot_x))
        dy = min(abs(v - knot_y), 1 - abs(v - knot_y))
        ring = math.sqrt((dx / .055) ** 2 + (dy / .035) ** 2)
        if ring < 1.0:
            tone -= .18 * (1 - ring) + .035 * math.cos(ring * 12)
    return tuple(clamp(c * tone) for c in (.70, .445, .255))


def stone(x, y):
    u, v = x / SIZE, y / SIZE
    row = y // 32
    ly = y % 32
    shifted = (x + (row % 2) * 32) % SIZE
    col, lx = shifted // 64, shifted % 64
    edge = min(lx, 63 - lx, ly, 31 - ly)
    if edge < 2:
        return (.205, .208, .199)
    block = hash2(col, row, 15)
    coarse = noise(u, v, 16, 16, 21)
    fine = noise(u, v, 64, 64, 22)
    tone = .75 + block * .16 + coarse * .13 + fine * .075
    if edge < 4:
        tone *= .82
    elif edge < 7:
        tone *= .94
    # Small aggregate chips stay inside each stone.
    fleck = hash2(x // 3, y // 3, 29)
    if fleck > .955 and edge > 6:
        tone += .11
    elif fleck < .025 and edge > 6:
        tone -= .11
    return tuple(clamp(c * tone) for c in (.59, .605, .585))


def make_image(name, filename, painter):
    image = bpy.data.images.new(name, width=SIZE, height=SIZE, alpha=True)
    pixels = [0.0] * (SIZE * SIZE * 4)
    for y in range(SIZE):
        for x in range(SIZE):
            r, g, b = painter(x, y)
            i = (y * SIZE + x) * 4
            pixels[i:i + 4] = (r, g, b, 1.0)
    image.pixels.foreach_set(pixels)
    image.filepath_raw = str(OUT / filename)
    image.file_format = 'PNG'
    image.save()
    image.pack()
    return image


def material(name, image):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = .92
    tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image = image
    tex.interpolation = 'Linear'
    tex.extension = 'REPEAT'
    mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    return mat


def preview_block(name, x, mat):
    bpy.ops.mesh.primitive_cube_add(size=2, location=(x, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = (2.4, .65, 2.4)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    uv = obj.data.uv_layers.active
    for face in obj.data.polygons:
        for loop_index, point in zip(face.loop_indices, ((0, 0), (1, 0), (1, 1), (0, 1))):
            uv.data[loop_index].uv = point
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new('Soft edges', 'BEVEL')
    bevel.width = .025
    bevel.segments = 1
    obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')


OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
wood_image = make_image('Building wood · tileable', 'wood-planks.png', wood)
stone_image = make_image('Building stone · tileable', 'stone-blocks.png', stone)
preview_block('Wood preview', -1.45, material('Warm timber', wood_image))
preview_block('Stone preview', 1.45, material('Weathered stone', stone_image))

world = bpy.context.scene.world
world.color = (.45, .45, .45)
bpy.ops.object.light_add(type='AREA', location=(-3, -4, 6))
bpy.context.object.data.energy = 500
bpy.context.object.data.shape = 'DISK'
bpy.context.object.data.size = 5
bpy.ops.object.camera_add(location=(0, -7.8, 4.1))
camera = bpy.context.object
direction = (mathutils.Vector((0, 0, 0)) - camera.location).to_track_quat('-Z', 'Y')
camera.rotation_euler = direction.to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 6.8
scene = bpy.context.scene
scene.camera = camera
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 800
scene.render.resolution_y = 440
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(PREVIEW)
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'Medium High Contrast'
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
bpy.ops.render.render(write_still=True)
print(f'Created {OUT}, {SOURCE}, {PREVIEW}')
