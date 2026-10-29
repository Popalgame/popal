"""Build three small, UV-mapped rock meshes for the browser world.

Run: blender --background --python scripts/prepare-rocks.py
"""
import math
import random
from pathlib import Path

import bpy
from mathutils import Vector, noise


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/assets/terrain-rocks.blend"
EXPORT = ROOT / "site/assets/models/terrain-rocks.glb"

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0

colors = [(0.38, 0.40, 0.43, 1), (0.42, 0.41, 0.39, 1), (0.35, 0.38, 0.40, 1)]
forms = [
    # long and low, broad upper ledge
    (1.24, 0.82, 0.66, 0.33),
    # compact, tall glacial boulder
    (0.87, 1.02, 0.98, 0.58),
    # wide layered stone
    (1.09, 1.14, 0.76, 0.42),
]
for index, color in enumerate(colors):
    rng = random.Random(3281 + index * 719)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=0.7)
    rock = bpy.context.object
    rock.name = f"Rock_{index + 1:02d}"
    mesh = rock.data

    # Two coherent scales break the spherical outline without noisy spikes. The
    # horizontal strata and flattened caps make each form read as weathered rock.
    sx, sy, sz, top = forms[index]
    phase = index * 2.39
    for vertex in mesh.vertices:
        direction = vertex.co.normalized()
        x, y, z = direction
        broad = noise.noise(Vector((x * 2.1 + phase, y * 2.1, z * 2.1)))
        fine = noise.noise(Vector((x * 5.3, y * 5.3 + phase, z * 5.3)))
        angle = math.atan2(y, x)
        radius = 0.77 + 0.105 * broad + 0.035 * fine + rng.uniform(-0.01, 0.01)
        layer = (0.021 + 0.005 * index) * math.sin(
            z * 15 + phase + 1.4 * math.sin(angle * 2 + phase) + 0.5 * broad
        )
        px = x * sx * (radius + layer) + 0.045 * z * (index - 1)
        py = y * sy * (radius + layer) + 0.035 * math.sin(3 * x + phase) * z
        pz = z * sz * radius + 0.025 * math.sin(angle * 3 + phase)
        if pz > top:
            pz = top + (pz - top) * 0.17
        # All game meshes are placed at y=.45 with scale.y=.8.
        vertex.co = Vector((px, py, pz))
        if vertex.co.z < -0.54:
            vertex.co.z = -0.54 + (vertex.co.z + 0.54) * 0.06

    for polygon in mesh.polygons:
        polygon.use_smooth = False

    material = bpy.data.materials.new(f"RockStone_{index + 1:02d}")
    material.diffuse_color = color
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = 0.92
    mesh.materials.append(material)

    bpy.context.view_layer.objects.active = rock
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")

SOURCE.parent.mkdir(parents=True, exist_ok=True)
EXPORT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
bpy.ops.export_scene.gltf(filepath=str(EXPORT), export_format="GLB", use_selection=False,
                          export_apply=True, export_normals=True, export_texcoords=True,
                          export_materials="EXPORT")
print(f"Wrote {SOURCE} and {EXPORT}")
