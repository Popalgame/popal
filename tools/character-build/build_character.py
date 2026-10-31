#!/usr/bin/env python3
"""Zbuduj parametryczną postać w Blenderze z pomiarów 2D.

Uruchamiaj wewnątrz Blendera:
    blender -b --factory-startup --python-exit-code 1 \
      --python tools/character-build/build_character.py -- \
      --measurements output/character-scan/aiko/measurements.json \
      --out output/character-build/aiko --name Aiko

Wynik: siatka, 22-kostny rig, proste akcje, cztery widoki ortograficzne,
render beauty, plik .blend i eksport .glb.

To jest blockout proporcjonalny, nie rekonstrukcja ukrytej anatomii.
Głębokości są jawnymi założeniami, a animacje — demonstracją struktury,
nie produkcją animation-ready.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import humanoid  # noqa: E402

VERSION = 1
SEGMENTS = 32


# ---------------------------------------------------------------------------
# Materiały i pomocnicze obiekty
# ---------------------------------------------------------------------------


def make_material(name: str, color: tuple[float, float, float], roughness: float = 0.6,
                  metallic: float = 0.0) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = (*color, 1.0)
    nodes = material.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf is not None:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
    return material


def move_to_collection(obj: bpy.types.Object, collection: bpy.types.Collection) -> None:
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def finish_primitive(obj: bpy.types.Object, name: str, material: bpy.types.Material,
                     collection: bpy.types.Collection, smooth: bool = True) -> bpy.types.Object:
    obj.name = name
    obj.data.name = f"{name}Mesh"
    move_to_collection(obj, collection)
    obj.data.materials.append(material)
    if smooth:
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


def add_box(name: str, location, size, material, collection) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.object
    obj.scale = size
    return finish_primitive(obj, name, material, collection)


def add_sphere(name: str, location, radii, material, collection,
               segments: int = 24, rings: int = 16) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments, ring_count=rings, radius=1.0, location=location
    )
    obj = bpy.context.object
    obj.scale = radii
    return finish_primitive(obj, name, material, collection)


def add_cone_between(name: str, start, end, radius_start: float, radius_end: float,
                     material, collection, vertices: int = 24) -> bpy.types.Object:
    start = Vector(start)
    end = Vector(end)
    direction = end - start
    length = direction.length
    if length <= 1e-6:
        raise ValueError(f"zerowa długość obiektu {name}")
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius_start,
        radius2=radius_end,
        depth=length,
        end_fill_type="NGON",
        location=(start + end) / 2.0,
    )
    obj = bpy.context.object
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.to_track_quat("Z", "Y")
    return finish_primitive(obj, name, material, collection)


def add_torus(name: str, location, major: float, minor: float, material, collection,
              scale_y: float = 1.0) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=32,
        minor_segments=12,
        location=location,
    )
    obj = bpy.context.object
    obj.scale = (1.0, scale_y, 1.0)
    return finish_primitive(obj, name, material, collection)


def mesh_object(name: str, vertices, faces, materials, collection) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    for material in materials:
        mesh.materials.append(material)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return obj


# ---------------------------------------------------------------------------
# Wagi
# ---------------------------------------------------------------------------


def assign_all(obj: bpy.types.Object, bone: str, weight: float = 1.0) -> None:
    group = obj.vertex_groups.get(bone) or obj.vertex_groups.new(name=bone)
    group.add(list(range(len(obj.data.vertices))), weight, "REPLACE")


def assign_blend(obj: bpy.types.Object, weights: dict[str, float]) -> None:
    total = sum(weights.values())
    if total <= 0:
        raise ValueError("suma wag musi być dodatnia")
    for bone, weight in weights.items():
        group = obj.vertex_groups.get(bone) or obj.vertex_groups.new(name=bone)
        group.add(list(range(len(obj.data.vertices))), weight / total, "REPLACE")


def spine_weights(z: float) -> dict[str, float]:
    centers = (
        ("mixamorig:Hips", 0.78),
        ("mixamorig:Spine", 0.84),
        ("mixamorig:Spine1", 0.92),
        ("mixamorig:Spine2", 1.00),
    )
    if z <= centers[0][1]:
        return {centers[0][0]: 1.0}
    if z >= centers[-1][1]:
        return {centers[-1][0]: 1.0}
    for (lower_name, lower_z), (upper_name, upper_z) in zip(centers, centers[1:]):
        if lower_z <= z <= upper_z:
            t = (z - lower_z) / (upper_z - lower_z)
            return {lower_name: 1.0 - t, upper_name: t}
    return {centers[-1][0]: 1.0}


def neck_weights(z: float, neck_z: float, head_z: float) -> dict[str, float]:
    t = max(0.0, min(1.0, (z - neck_z) / max(1e-6, head_z - neck_z)))
    return {"mixamorig:Neck": 1.0 - t, "mixamorig:Head": t}


# ---------------------------------------------------------------------------
# Budowa ciała
# ---------------------------------------------------------------------------


def build_body(plan: humanoid.Plan, collection, colors) -> tuple[bpy.types.Object, list[str]]:
    materials = {
        key: make_material(f"{key}", color)
        for key, color in colors.items()
    }
    body_parts: list[tuple[bpy.types.Object, object]] = []
    warnings: list[str] = []

    def add(obj, weights):
        if isinstance(weights, str):
            assign_all(obj, weights)
        elif callable(weights):
            for index, vertex in enumerate(obj.data.vertices):
                for bone, weight in weights(vertex.co.z).items():
                    group = obj.vertex_groups.get(bone) or obj.vertex_groups.new(name=bone)
                    group.add([index], weight, "REPLACE")
        else:
            assign_blend(obj, weights)
        body_parts.append((obj, weights))

    def bone_name(label: str, part: str) -> str:
        side = "Left" if label == "L" else "Right"
        return f"mixamorig:{side}{part}"

    # --- tors ---
    rings = plan.torso_rings
    vertices = []
    for ring in rings:
        vertices.extend(humanoid.ring_vertices(ring, SEGMENTS))
    faces = humanoid.loft_faces(len(rings), SEGMENTS)
    torso = mesh_object(
        "Torso", vertices, faces,
        [materials["shorts"], materials["skin"], materials["top"], materials["jacket"]],
        collection,
    )
    for polygon in torso.data.polygons:
        points = [torso.data.vertices[i].co for i in polygon.vertices]
        z = sum(point.z for point in points) / len(points)
        x = sum(point.x for point in points) / len(points)
        side_panel = abs(x) > 0.085
        if z < plan.hip_z + 0.02:
            polygon.material_index = 0
        elif z < plan.waist_z - 0.02:
            polygon.material_index = 3 if side_panel else 1
        elif z < plan.shoulder_z - 0.035:
            polygon.material_index = 3 if side_panel else 2
        else:
            polygon.material_index = 3
    add(torso, lambda z: spine_weights(z))

    # --- szyja i kołnierz ---
    neck_top = plan.head_bottom + 0.015
    add(add_cone_between(
        "Neck", (0, 0, plan.shoulder_z - 0.01), (0, 0, neck_top),
        0.052, 0.05, materials["skin"], collection,
    ), lambda z: neck_weights(z, plan.shoulder_z, neck_top))
    add(add_torus(
        "Collar", (0, 0, plan.shoulder_z + 0.03), 0.095, 0.032,
        materials["fur"], collection, scale_y=0.82,
    ), "mixamorig:Neck")

    # --- głowa ---
    add(add_sphere(
        "Head", (0, 0, plan.head_center_z),
        (plan.head_width / 2.0, plan.head_depth / 2.0, plan.head_height / 2.0),
        materials["skin"], collection, segments=32, rings=24,
    ), "mixamorig:Head")
    for side, label in ((1, "L"), (-1, "R")):
        add(add_sphere(
            f"Ear{label}", (side * plan.head_width * 0.49, 0.005, plan.eye_z - 0.01),
            (0.022, 0.038, 0.052), materials["skin"], collection,
            segments=16, rings=12,
        ), "mixamorig:Head")

    # --- włosy: masa, grzywka, kosmyki, kolce i kucyk ---
    add(add_sphere(
        "HairBack", (0, plan.head_depth * 0.20, plan.head_center_z + 0.01),
        (plan.head_width * 0.62, plan.head_depth * 0.52, plan.head_height * 0.63),
        materials["hair"], collection, segments=32, rings=20,
    ), "mixamorig:Head")
    add(add_sphere(
        "HairTop", (0, plan.head_depth * 0.16, plan.head_top - 0.005),
        (plan.head_width * 0.62, plan.head_depth * 0.56, plan.head_height * 0.48),
        materials["hair"], collection, segments=24, rings=16,
    ), "mixamorig:Head")
    for side, label in ((1, "L"), (-1, "R")):
        add(add_sphere(
            f"HairSide{label}",
            (side * plan.head_width * 0.48, plan.head_depth * 0.10,
             plan.head_center_z + 0.01),
            (plan.head_width * 0.24, plan.head_depth * 0.36, plan.head_height * 0.60),
            materials["hair"], collection, segments=24, rings=16,
        ), "mixamorig:Head")

    for index, x in enumerate((-0.12, -0.08, -0.04, 0.0, 0.04, 0.08, 0.12)):
        add(add_cone_between(
            f"Bang{index}",
            (x, -plan.head_depth * 0.46, plan.head_top - 0.03),
            (x * 1.06, -plan.head_depth * 0.56, plan.eye_z + 0.06),
            0.026, 0.008, materials["hair"], collection, vertices=10,
        ), "mixamorig:Head")

    for side, label in ((1, "L"), (-1, "R")):
        start = (side * plan.head_width * 0.48, -plan.head_depth * 0.12, plan.eye_z + 0.09)
        end = (side * plan.head_width * 0.64, -plan.head_depth * 0.26, plan.chin_z - 0.10)
        add(add_cone_between(
            f"SideLock{label}", start, end, 0.052, 0.022,
            materials["hair"], collection, vertices=16,
        ), "mixamorig:Head")
        add(add_cone_between(
            f"SideLockTip{label}", end,
            (side * plan.head_width * 0.66, -plan.head_depth * 0.27, plan.chin_z - 0.20),
            0.022, 0.006, materials["hair_tip"], collection, vertices=12,
        ), "mixamorig:Head")
        add(add_cone_between(
            f"FrontLock{label}",
            (side * plan.head_width * 0.42, -plan.head_depth * 0.42, plan.eye_z + 0.07),
            (side * plan.head_width * 0.30, -plan.head_depth * 0.52, plan.chin_z - 0.12),
            0.058, 0.028, materials["hair"], collection, vertices=14,
        ), "mixamorig:Head")
        add(add_cone_between(
            f"FrontLockTip{label}",
            (side * plan.head_width * 0.30, -plan.head_depth * 0.52, plan.chin_z - 0.12),
            (side * plan.head_width * 0.28, -plan.head_depth * 0.54, plan.chin_z - 0.24),
            0.028, 0.006, materials["hair_tip"], collection, vertices=10,
        ), "mixamorig:Head")

    spikes = [
        ((side * 0.09, 0.02, plan.head_top - 0.03),
         (side * 0.30, 0.05, plan.head_max_z + 0.02), 0.055, 0.004,
         "hair"),
        ((side * 0.12, 0.04, plan.head_top - 0.04),
         (side * 0.27, 0.11, plan.head_max_z + 0.13), 0.05, 0.005, "hair_tip"),
        ((side * 0.10, 0.06, plan.head_top - 0.01),
         (side * 0.22, 0.17, plan.head_top + 0.22), 0.045, 0.005, "hair"),
        ((side * 0.08, 0.07, plan.head_top + 0.03),
         (side * 0.17, 0.10, plan.height - 0.12), 0.05, 0.005, "hair"),
        ((side * 0.06, 0.08, plan.head_top + 0.06),
         (side * 0.12, 0.13, plan.height - 0.06), 0.045, 0.004, "hair_tip"),
        ((side * 0.10, 0.10, plan.head_top + 0.10),
         (side * 0.16, 0.16, plan.height - 0.20), 0.055, 0.005, "hair"),
        ((side * 0.05, 0.12, plan.head_top + 0.14),
         (side * 0.09, 0.18, plan.height - 0.10), 0.05, 0.004, "hair_tip"),
        ((side * 0.15, 0.06, plan.head_center_z + 0.03),
         (side * 0.29, 0.13, plan.head_center_z - 0.02), 0.05, 0.005, "hair"),
    ]
    for index, (start, end, radius_start, radius_end, material) in enumerate(spikes):
        for side in (1, -1):
            add(add_cone_between(
                f"Spike{index}{'L' if side > 0 else 'R'}",
                (side * start[0], start[1], start[2]),
                (side * end[0], end[1], end[2]),
                radius_start, radius_end, materials[material], collection, vertices=10,
            ), "mixamorig:Head")

    add(add_sphere(
        "PonytailBase", (0, plan.head_depth * 0.33, plan.head_top - 0.04),
        (0.095, 0.10, 0.105), materials["hair"], collection,
        segments=20, rings=14,
    ), "mixamorig:Head")
    tail_segments = [
        ((0, plan.head_depth * 0.33, plan.head_top - 0.04),
         (0.03, plan.head_depth * 0.55, plan.height - 0.18), 0.085, 0.02, "hair"),
        ((0.03, plan.head_depth * 0.55, plan.height - 0.18),
         (0.06, plan.head_depth * 0.45, plan.height - 0.005), 0.02, 0.003, "hair_tip"),
        ((0, plan.head_depth * 0.34, plan.head_top - 0.05),
         (-0.11, plan.head_depth * 0.70, plan.height - 0.09), 0.07, 0.004, "hair"),
        ((0, plan.head_depth * 0.34, plan.head_top - 0.05),
         (0.15, plan.head_depth * 0.62, plan.height - 0.13), 0.07, 0.004, "hair_tip"),
        ((0, plan.head_depth * 0.34, plan.head_top - 0.06),
         (-0.22, plan.head_depth * 0.58, plan.height - 0.23), 0.06, 0.004, "hair_tip"),
        ((0, plan.head_depth * 0.34, plan.head_top - 0.06),
         (0.24, plan.head_depth * 0.52, plan.height - 0.26), 0.06, 0.004, "hair"),
        ((0, plan.head_depth * 0.34, plan.head_top - 0.07),
         (0.04, plan.head_depth * 0.88, plan.height - 0.35), 0.07, 0.008, "hair"),
        ((0, plan.head_depth * 0.34, plan.head_top - 0.08),
         (-0.04, plan.head_depth * 0.82, plan.height - 0.45), 0.07, 0.008, "hair_tip"),
        ((0, plan.head_depth * 0.34, plan.head_top - 0.08),
         (0, plan.head_depth * 0.72, plan.chin_z - 0.10), 0.075, 0.015, "hair"),
        ((0, plan.head_depth * 0.34, plan.head_top - 0.08),
         (0.12, plan.head_depth * 0.68, plan.chin_z - 0.05), 0.06, 0.012, "hair"),
    ]
    for index, (start, end, radius_start, radius_end, material) in enumerate(tail_segments):
        add(add_cone_between(
            f"Ponytail{index}", start, end, radius_start, radius_end,
            materials[material], collection, vertices=10,
        ), "mixamorig:Head")

    # --- twarz ---
    eye_x = plan.eye_x
    eye_z = plan.eye_z
    half_width = plan.head_width / 2.0
    surface = math.sqrt(max(0.05, 1.0 - (eye_x / half_width) ** 2))
    face_y = -plan.head_depth * 0.5 * surface
    eye_y = face_y - 0.002
    for side, label in ((1, "L"), (-1, "R")):
        add(add_sphere(
            f"EyeWhite{label}", (side * eye_x, eye_y, eye_z),
            (plan.eye_width / 2.0, 0.012, plan.eye_height / 2.0),
            materials["eye_white"], collection, segments=24, rings=16,
        ), "mixamorig:Head")
        add(add_sphere(
            f"Iris{label}", (side * eye_x, eye_y - 0.012, eye_z - 0.002),
            (plan.iris_width / 2.0, 0.008, plan.iris_height / 2.0),
            materials["eye_teal"], collection, segments=24, rings=16,
        ), "mixamorig:Head")
        add(add_sphere(
            f"Pupil{label}", (side * eye_x, eye_y - 0.019, eye_z - 0.002),
            (plan.iris_width * 0.22, 0.005, plan.iris_height * 0.27),
            materials["eye_dark"], collection, segments=20, rings=12,
        ), "mixamorig:Head")
        add(add_sphere(
            f"Highlight{label}",
            (side * (eye_x - plan.iris_width * 0.22), eye_y - 0.024,
             eye_z + plan.iris_height * 0.22),
            (plan.iris_width * 0.16, 0.004, plan.iris_height * 0.14),
            materials["eye_white"], collection, segments=16, rings=10,
        ), "mixamorig:Head")
        add(add_box(
            f"Brow{label}", (side * eye_x, face_y + 0.012, eye_z + 0.055),
            (0.072, 0.010, 0.011), materials["brow"], collection,
        ), "mixamorig:Head")
    add(add_sphere(
        "Nose", (0, face_y + 0.002, plan.nose_z),
        (0.016, 0.012, 0.012), materials["skin_dark"], collection,
        segments=16, rings=12,
    ), "mixamorig:Head")
    add(add_box(
        "Mouth", (0, face_y + 0.035, plan.mouth_z),
        (0.042, 0.006, 0.006), materials["mouth"], collection,
    ), "mixamorig:Head")
    for side, label in ((1, "L"), (-1, "R")):
        for index in range(5):
            add(add_sphere(
                f"Freckle{label}{index}",
                (side * (0.062 + index * 0.012), face_y + 0.002,
                 eye_z - 0.038 + (index % 2) * 0.010),
                (0.0032, 0.002, 0.0032), materials["freckle"], collection,
                segments=8, rings=6,
            ), "mixamorig:Head")

    # --- ręce ---
    shoulder_x = plan.shoulder_width / 2.0 - 0.015
    elbow_x = shoulder_x + (plan.arm_half - shoulder_x) * 0.43
    wrist_x = plan.arm_half - 0.085
    hand_x = plan.arm_half - 0.05
    for side, label in ((1, "L"), (-1, "R")):
        shoulder = (side * (shoulder_x - 0.02), 0, plan.shoulder_z)
        elbow = (side * elbow_x, 0, plan.shoulder_z)
        wrist = (side * wrist_x, 0, plan.shoulder_z)
        hand = (side * hand_x, 0, plan.shoulder_z)
        add(add_sphere(
            f"Shoulder{label}", shoulder, (0.082, 0.082, 0.082),
            materials["jacket"], collection, segments=20, rings=14,
        ), {bone_name(label, "Shoulder"): 0.4, bone_name(label, "Arm"): 0.6})
        add(add_cone_between(
            f"UpperArm{label}", (side * (shoulder_x - 0.05), 0, plan.shoulder_z),
            elbow, 0.074, 0.06,
            materials["jacket"], collection, vertices=20,
        ), bone_name(label, "Arm"))
        add(add_cone_between(
            f"ForeArm{label}", elbow, wrist, 0.048, 0.036,
            materials["skin"], collection, vertices=20,
        ), bone_name(label, "ForeArm"))
        add(add_sphere(
            f"Hand{label}", hand, (0.042, 0.03, 0.045),
            materials["skin"], collection, segments=20, rings=14,
        ), bone_name(label, "Hand"))

    # --- biodra, szorty, pasek ---
    for side, label in ((1, "L"), (-1, "R")):
        add(add_cone_between(
            f"ShortsCuff{label}",
            (side * plan.leg_center_x, 0, plan.hip_z + 0.01),
            (side * plan.leg_center_x, 0, plan.crotch_z - 0.06),
            0.098, 0.094, materials["shorts"], collection,
        ), bone_name(label, "UpLeg"))
    add(add_torus(
        "Belt", (0, 0, plan.hip_z + 0.02), plan.hip_width * 0.48, 0.014,
        materials["belt"], collection, scale_y=0.60,
    ), "mixamorig:Hips")
    add(add_box(
        "Buckle", (0, -plan.hip_width * 0.30, plan.hip_z + 0.02),
        (0.045, 0.014, 0.032), materials["metal"], collection,
    ), "mixamorig:Hips")

    # --- nogi ---
    for side, label in ((1, "L"), (-1, "R")):
        hip = (side * plan.leg_center_x, 0, plan.hip_z - 0.03)
        knee = (side * plan.leg_center_x * 0.94, 0, 0.44)
        ankle = (side * plan.leg_center_x * 0.87, 0, 0.16)
        add(add_cone_between(
            f"Thigh{label}", hip, knee, 0.068, 0.052,
            materials["skin"], collection,
        ), bone_name(label, "UpLeg"))
        add(add_cone_between(
            f"Calf{label}", knee, ankle, 0.048, 0.034,
            materials["skin"], collection,
        ), bone_name(label, "Leg"))
        add(add_cone_between(
            f"Sock{label}", (ankle[0], 0, 0.20), (knee[0], 0, 0.43),
            0.049, 0.046, materials["sock"], collection,
        ), bone_name(label, "Leg"))
        add(add_cone_between(
            f"Boot{label}", (ankle[0], 0, 0.015), (ankle[0], 0, 0.20),
            0.058, 0.054, materials["boot"], collection,
        ), bone_name(label, "Foot"))
        add(add_box(
            f"Foot{label}", (ankle[0], -0.06, 0.042),
            (0.088, 0.21, 0.084), materials["boot"], collection,
        ), bone_name(label, "Foot"))
        add(add_box(
            f"Toe{label}", (ankle[0], -0.155, 0.038),
            (0.08, 0.075, 0.066), materials["boot"], collection,
        ), bone_name(label, "ToeBase"))
        add(add_torus(
            f"BootCuff{label}", (ankle[0], 0, 0.20), 0.057, 0.011,
            materials["belt"], collection,
        ), bone_name(label, "Foot"))

    # --- plecak i rekwizyty ---
    add(add_box(
        "Backpack", (0, plan.hip_width * 0.32, plan.waist_z + 0.06),
        (0.24, 0.12, 0.28), materials["pack"], collection,
    ), "mixamorig:Spine2")
    for side, label in ((1, "L"), (-1, "R")):
        add(add_box(
            f"Pouch{label}", (side * 0.17, plan.hip_width * 0.30, plan.waist_z - 0.02),
            (0.08, 0.10, 0.16), materials["jacket"], collection,
        ), "mixamorig:Spine2")
        add(add_sphere(
            f"EyeOrb{label}", (side * 0.205, plan.hip_width * 0.30, plan.hip_z - 0.02),
            (0.05, 0.05, 0.05), materials["eye_white"], collection,
            segments=20, rings=14,
        ), "mixamorig:Spine1")
        add(add_sphere(
            f"EyeOrbIris{label}",
            (side * 0.243, plan.hip_width * 0.30, plan.hip_z - 0.02),
            (0.022, 0.018, 0.024), materials["eye_teal"], collection,
            segments=16, rings=12,
        ), "mixamorig:Spine1")

    if len(body_parts) < 20:
        warnings.append("mało części ciała — sprawdź plan")

    bpy.ops.object.select_all(action="DESELECT")
    for obj, _ in body_parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = body_parts[0][0]
    bpy.ops.object.join()
    body = bpy.context.object
    body.name = "AikoBody"
    body.data.name = "AikoBodyMesh"
    return body, warnings


# ---------------------------------------------------------------------------
# Rig i animacje
# ---------------------------------------------------------------------------


def build_rig(plan: humanoid.Plan, collection) -> bpy.types.Object:
    armature_data = bpy.data.armatures.new("AikoRig")
    armature = bpy.data.objects.new("AikoRig", armature_data)
    collection.objects.link(armature)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="EDIT")
    bones: dict[str, bpy.types.EditBone] = {}

    def add_bone(name, head, tail, parent=None):
        bone = armature_data.edit_bones.new(name)
        bone.head = head
        bone.tail = tail
        bone.use_connect = False
        if parent is not None:
            bone.parent = bones[parent]
        bones[name] = bone
        return bone

    hip_z = plan.hip_z - 0.03
    add_bone("mixamorig:Hips", (0, 0, hip_z), (0, 0, hip_z + 0.06))
    add_bone(
        "mixamorig:Spine", (0, 0, hip_z + 0.06), (0, 0, plan.waist_z + 0.01),
        "mixamorig:Hips",
    )
    add_bone(
        "mixamorig:Spine1", (0, 0, plan.waist_z + 0.01),
        (0, 0, plan.shoulder_z - 0.07), "mixamorig:Spine",
    )
    add_bone(
        "mixamorig:Spine2", (0, 0, plan.shoulder_z - 0.07),
        (0, 0, plan.shoulder_z + 0.02), "mixamorig:Spine1",
    )
    add_bone(
        "mixamorig:Neck", (0, 0, plan.shoulder_z + 0.02),
        (0, 0, plan.head_bottom - 0.01), "mixamorig:Spine2",
    )
    add_bone(
        "mixamorig:Head", (0, 0, plan.head_bottom - 0.01),
        (0, 0, plan.head_top - 0.02), "mixamorig:Neck",
    )

    shoulder_x = plan.shoulder_width / 2.0 - 0.015
    elbow_x = shoulder_x + (plan.arm_half - shoulder_x) * 0.43
    wrist_x = plan.arm_half - 0.085
    hand_x = plan.arm_half - 0.015
    for side, label in ((1, "Left"), (-1, "Right")):
        add_bone(
            f"mixamorig:{label}Shoulder",
            (side * 0.04, 0, plan.shoulder_z + 0.01),
            (side * shoulder_x, 0, plan.shoulder_z),
            "mixamorig:Spine2",
        )
        add_bone(
            f"mixamorig:{label}Arm",
            (side * shoulder_x, 0, plan.shoulder_z),
            (side * elbow_x, 0, plan.shoulder_z),
            f"mixamorig:{label}Shoulder",
        )
        add_bone(
            f"mixamorig:{label}ForeArm",
            (side * elbow_x, 0, plan.shoulder_z),
            (side * wrist_x, 0, plan.shoulder_z),
            f"mixamorig:{label}Arm",
        )
        add_bone(
            f"mixamorig:{label}Hand",
            (side * wrist_x, 0, plan.shoulder_z),
            (side * hand_x, 0, plan.shoulder_z),
            f"mixamorig:{label}ForeArm",
        )
        add_bone(
            f"mixamorig:{label}UpLeg",
            (side * plan.leg_center_x, 0, plan.hip_z - 0.03),
            (side * plan.leg_center_x * 0.94, 0, 0.44),
            "mixamorig:Hips",
        )
        add_bone(
            f"mixamorig:{label}Leg",
            (side * plan.leg_center_x * 0.94, 0, 0.44),
            (side * plan.leg_center_x * 0.87, 0, 0.16),
            f"mixamorig:{label}UpLeg",
        )
        add_bone(
            f"mixamorig:{label}Foot",
            (side * plan.leg_center_x * 0.87, 0, 0.16),
            (side * plan.leg_center_x * 0.87, -0.07, 0.04),
            f"mixamorig:{label}Leg",
        )
        add_bone(
            f"mixamorig:{label}ToeBase",
            (side * plan.leg_center_x * 0.87, -0.07, 0.04),
            (side * plan.leg_center_x * 0.87, -0.18, 0.035),
            f"mixamorig:{label}Foot",
        )

    bpy.ops.object.mode_set(mode="OBJECT")
    armature.show_in_front = True
    armature.data.display_type = "OCTAHEDRAL"
    return armature


def rest_pose(armature: bpy.types.Object) -> None:
    for bone in armature.pose.bones:
        bone.rotation_mode = "XYZ"
        bone.rotation_euler = (0, 0, 0)
        bone.location = (0, 0, 0)
        bone.scale = (1, 1, 1)


def make_action(armature: bpy.types.Object, name: str, keys: list[dict]) -> bpy.types.Action:
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    armature.animation_data.action = action
    for key in keys:
        frame = key["frame"]
        rotations = key.get("rot", {})
        locations = key.get("loc", {})
        bpy.context.scene.frame_set(frame)
        rest_pose(armature)
        for bone, degrees in rotations.items():
            pose_bone = armature.pose.bones.get(bone)
            if pose_bone is None:
                continue
            pose_bone.rotation_euler = tuple(math.radians(value) for value in degrees)
        for bone, location in locations.items():
            pose_bone = armature.pose.bones.get(bone)
            if pose_bone is not None:
                pose_bone.location = location
        for pose_bone in armature.pose.bones:
            pose_bone.keyframe_insert("rotation_euler", frame=frame, group=pose_bone.name)
        armature.pose.bones["mixamorig:Hips"].keyframe_insert(
            "location", frame=frame, group="mixamorig:Hips"
        )
    armature.animation_data.action = None
    rest_pose(armature)
    return action


def build_actions(armature: bpy.types.Object) -> list[bpy.types.Action]:
    armature.animation_data_create()
    actions = []
    actions.append(make_action(armature, "idle", [
        {"frame": 1, "rot": {"mixamorig:Spine2": (1, 0, 0), "mixamorig:Head": (-1, 0, 0)}},
        {"frame": 31, "rot": {"mixamorig:Spine2": (2, 0, 1), "mixamorig:Head": (1, 0, -1)},
         "loc": {"mixamorig:Hips": (0, 0.006, 0)}},
        {"frame": 61, "rot": {"mixamorig:Spine2": (1, 0, 0), "mixamorig:Head": (-1, 0, 0)}},
    ]))
    walk_a = {
        "mixamorig:LeftUpLeg": (25, 0, 0), "mixamorig:RightUpLeg": (-25, 0, 0),
        "mixamorig:LeftLeg": (-10, 0, 0), "mixamorig:RightLeg": (10, 0, 0),
        "mixamorig:LeftArm": (0, 0, 18), "mixamorig:RightArm": (0, 0, -18),
    }
    walk_b = {
        "mixamorig:LeftUpLeg": (-25, 0, 0), "mixamorig:RightUpLeg": (25, 0, 0),
        "mixamorig:LeftLeg": (10, 0, 0), "mixamorig:RightLeg": (-10, 0, 0),
        "mixamorig:LeftArm": (0, 0, -18), "mixamorig:RightArm": (0, 0, 18),
    }
    actions.append(make_action(armature, "walk", [
        {"frame": 1, "rot": walk_a}, {"frame": 16, "rot": {}},
        {"frame": 31, "rot": walk_b}, {"frame": 46, "rot": {}},
        {"frame": 61, "rot": walk_a},
    ]))
    run_a = {key: tuple(value * 1.8 for value in rotation) for key, rotation in walk_a.items()}
    run_b = {key: tuple(value * 1.8 for value in rotation) for key, rotation in walk_b.items()}
    actions.append(make_action(armature, "run", [
        {"frame": 1, "rot": run_a}, {"frame": 16, "rot": {}},
        {"frame": 31, "rot": run_b}, {"frame": 46, "rot": {}},
        {"frame": 61, "rot": run_a},
    ]))
    actions.append(make_action(armature, "swim", [
        {"frame": 1, "rot": {"mixamorig:LeftArm": (0, 0, 70), "mixamorig:RightArm": (0, 0, -70),
                             "mixamorig:LeftUpLeg": (15, 0, 0), "mixamorig:RightUpLeg": (-15, 0, 0)}},
        {"frame": 31, "rot": {"mixamorig:LeftArm": (0, 0, 45), "mixamorig:RightArm": (0, 0, -45),
                              "mixamorig:LeftUpLeg": (-15, 0, 0), "mixamorig:RightUpLeg": (15, 0, 0)}},
        {"frame": 61, "rot": {"mixamorig:LeftArm": (0, 0, 70), "mixamorig:RightArm": (0, 0, -70),
                              "mixamorig:LeftUpLeg": (15, 0, 0), "mixamorig:RightUpLeg": (-15, 0, 0)}},
    ]))
    actions.append(make_action(armature, "hit", [
        {"frame": 1, "rot": {}},
        {"frame": 9, "rot": {"mixamorig:Spine2": (0, 0, -20), "mixamorig:RightArm": (0, 0, -70),
                             "mixamorig:RightForeArm": (0, 0, -30)}},
        {"frame": 25, "rot": {"mixamorig:Spine2": (0, 0, 18), "mixamorig:RightArm": (0, 0, 45)}},
        {"frame": 41, "rot": {}},
    ]))
    actions.append(make_action(armature, "throw", [
        {"frame": 1, "rot": {}},
        {"frame": 13, "rot": {"mixamorig:Spine2": (0, 0, -18), "mixamorig:RightArm": (0, 0, -110),
                              "mixamorig:RightForeArm": (0, 0, -20)}},
        {"frame": 31, "rot": {"mixamorig:Spine2": (0, 0, 20), "mixamorig:RightArm": (0, 0, 55),
                              "mixamorig:RightForeArm": (0, 0, 10)}},
        {"frame": 49, "rot": {}},
    ]))
    actions.append(make_action(armature, "jump", [
        {"frame": 1, "rot": {}},
        {"frame": 15, "rot": {"mixamorig:LeftUpLeg": (40, 0, 0), "mixamorig:RightUpLeg": (40, 0, 0),
                              "mixamorig:LeftLeg": (-60, 0, 0), "mixamorig:RightLeg": (-60, 0, 0)},
         "loc": {"mixamorig:Hips": (0, 0.15, 0)}},
        {"frame": 31, "rot": {"mixamorig:LeftArm": (0, 0, -60), "mixamorig:RightArm": (0, 0, 60)},
         "loc": {"mixamorig:Hips": (0, 0.22, 0)}},
        {"frame": 45, "rot": {"mixamorig:LeftUpLeg": (20, 0, 0), "mixamorig:RightUpLeg": (20, 0, 0),
                              "mixamorig:LeftLeg": (-30, 0, 0), "mixamorig:RightLeg": (-30, 0, 0)},
         "loc": {"mixamorig:Hips": (0, 0.08, 0)}},
        {"frame": 61, "rot": {}, "loc": {"mixamorig:Hips": (0, 0, 0)}},
    ]))
    return actions


def add_nla(armature: bpy.types.Object, actions: list[bpy.types.Action]) -> None:
    armature.animation_data.action = None
    for action in actions:
        track = armature.animation_data.nla_tracks.new()
        track.name = action.name
        strip = track.strips.new(action.name, int(action.frame_range[0]), action)
        strip.name = action.name
        strip.action_frame_start = action.frame_range[0]
        strip.action_frame_end = action.frame_range[1]
        track.mute = True


# ---------------------------------------------------------------------------
# Scena, światła, kamery, render
# ---------------------------------------------------------------------------


def look_at(obj, target) -> None:
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_area_light(name, location, energy, size, collection):
    data = bpy.data.lights.new(name, type="AREA")
    data.energy = energy
    data.size = size
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    collection.objects.link(obj)
    look_at(obj, (0, 0, 0.95))
    return obj


def add_camera(name, location, rotation=None, ortho_scale=None, lens=50.0):
    data = bpy.data.cameras.new(name)
    if ortho_scale is not None:
        data.type = "ORTHO"
        data.ortho_scale = ortho_scale
    else:
        data.type = "PERSP"
        data.lens = lens
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    if rotation is not None:
        obj.rotation_euler = rotation
    return obj


def setup_render(scene, samples: int) -> None:
    for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    scene.render.resolution_x = 720
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    if hasattr(scene, "eevee") and hasattr(scene.eevee, "taa_render_samples"):
        scene.eevee.taa_render_samples = samples
    scene.view_settings.view_transform = "Standard"


def add_ground(collection, material):
    bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, -0.005))
    ground = bpy.context.object
    ground.name = "Ground"
    ground.data.materials.append(material)
    move_to_collection(ground, collection)
    return ground


def render_views(scene, collection, out_dir: Path, plan: humanoid.Plan, samples: int) -> dict:
    views_dir = out_dir / "views"
    views_dir.mkdir(parents=True, exist_ok=True)
    ortho = plan.height * 1.12
    front = add_camera("CameraFront", (0, -4, plan.height / 2), (math.radians(90), 0, 0), ortho_scale=ortho)
    back = add_camera("CameraBack", (0, 4, plan.height / 2), (math.radians(90), 0, math.radians(180)), ortho_scale=ortho)
    left = add_camera("CameraLeft", (-4, 0, plan.height / 2), (math.radians(90), 0, math.radians(-90)), ortho_scale=ortho)
    right = add_camera("CameraRight", (4, 0, plan.height / 2), (math.radians(90), 0, math.radians(90)), ortho_scale=ortho)
    beauty = add_camera("CameraBeauty", (2.7, -3.9, 1.75), lens=55)
    look_at(beauty, (0, 0, 0.92))
    for camera in (front, back, left, right, beauty):
        collection.objects.link(camera)
    scene.camera = front
    render_paths = {}
    for name, camera in (("front", front), ("left", left), ("back", back), ("right", right)):
        scene.camera = camera
        path = views_dir / f"{name}.png"
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        render_paths[name] = str(path)
    return {
        "render_paths": render_paths,
        "cameras": {"front": front.name, "back": back.name, "left": left.name,
                    "right": right.name, "beauty": beauty.name},
        "beauty_camera": beauty.name,
    }


# ---------------------------------------------------------------------------
# Główny przebieg
# ---------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="Zbuduj postać w Blenderze z pomiarów")
    parser.add_argument("--measurements", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--name", default="Aiko")
    parser.add_argument("--height", type=float, default=None)
    parser.add_argument("--depth-profile", type=Path, default=None,
                        help="depth-profile.json z depth_from_side.py (wariant C)")
    parser.add_argument("--depth-hints", type=Path, default=None,
                        help="depth-hints.json z depth_estimation.py (wariant B)")
    parser.add_argument("--samples", type=int, default=24)
    parser.add_argument("--no-render", action="store_true")
    return parser.parse_args(argv)


def main() -> int:
    args = parse_args()
    data = humanoid.load_measurements(args.measurements)
    depth_profile = None
    if args.depth_profile is not None:
        depth_profile = json.loads(
            args.depth_profile.expanduser().read_text(encoding="utf-8")
        )
    depth_hints = None
    if args.depth_hints is not None:
        depth_hints = json.loads(args.depth_hints.expanduser().read_text(encoding="utf-8"))
    plan = humanoid.build_plan(data, args.height, depth_profile, depth_hints)
    out_dir = args.out.expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.materials, bpy.data.armatures,
                       bpy.data.cameras, bpy.data.lights):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)

    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    collection = bpy.data.collections.new(f"{args.name}Build")
    scene.collection.children.link(collection)

    colors = {
        "skin": (0.62, 0.38, 0.26),
        "skin_dark": (0.45, 0.24, 0.18),
        "hair": (0.85, 0.32, 0.42),
        "hair_tip": (0.30, 0.62, 0.68),
        "jacket": (0.015, 0.17, 0.19),
        "top": (0.80, 0.78, 0.74),
        "shorts": (0.22, 0.13, 0.06),
        "belt": (0.13, 0.08, 0.05),
        "sock": (0.74, 0.62, 0.42),
        "boot": (0.16, 0.09, 0.05),
        "pack": (0.18, 0.11, 0.06),
        "fur": (0.85, 0.82, 0.76),
        "metal": (0.45, 0.40, 0.30),
        "eye_white": (0.92, 0.92, 0.90),
        "eye_teal": (0.02, 0.35, 0.40),
        "eye_dark": (0.01, 0.02, 0.03),
        "brow": (0.30, 0.16, 0.16),
        "mouth": (0.30, 0.10, 0.12),
        "freckle": (0.50, 0.26, 0.20),
    }

    body, warnings = build_body(plan, collection, colors)
    armature = build_rig(plan, collection)
    body.parent = armature
    modifier = body.modifiers.new("Armature", "ARMATURE")
    modifier.object = armature
    modifier.use_vertex_groups = True
    armature.data.pose_position = "REST"

    actions = build_actions(armature)
    add_nla(armature, actions)
    armature.data.pose_position = "REST"

    setup_render(scene, args.samples)
    world = bpy.data.worlds.new("AikoWorld")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    if background is not None:
        background.inputs[0].default_value = (0.025, 0.03, 0.04, 1.0)
        background.inputs[1].default_value = 0.45
    scene.world = world

    add_area_light("Key", (-2.6, -3.2, 3.0), 650, 3.0, collection)
    add_area_light("Fill", (3.0, -1.4, 2.0), 260, 2.5, collection)
    add_area_light("Rim", (0.0, 3.4, 3.0), 420, 2.0, collection)

    render_paths = {}
    if not args.no_render:
        render_paths = render_views(scene, collection, out_dir, plan, args.samples)

    # Beauty render: pozycja idle, ziemia i perspektywa.
    beauty_path = None
    if not args.no_render:
        ground_material = make_material("GroundMat", (0.12, 0.13, 0.15), roughness=0.9)
        add_ground(collection, ground_material)
        ground = bpy.data.objects.get("Ground")
        armature.data.pose_position = "POSE"
        armature.animation_data.action = bpy.data.actions.get("idle")
        scene.frame_set(1)
        scene.render.film_transparent = False
        scene.render.resolution_x = 800
        scene.render.resolution_y = 1000
        scene.camera = bpy.data.objects["CameraBeauty"]
        beauty_path = out_dir / "views" / "beauty.png"
        scene.render.filepath = str(beauty_path)
        bpy.ops.render.render(write_still=True)
        armature.animation_data.action = None
        armature.data.pose_position = "REST"
        if ground is not None:
            bpy.data.objects.remove(ground, do_unlink=True)
        ground_material = bpy.data.materials.get("GroundMat")
        if ground_material is not None:
            bpy.data.materials.remove(ground_material)

    # Zapis .blend
    blend_path = out_dir / f"{args.name.lower()}-generated.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

    # Eksport GLB: tylko ciało i rig, bez kamer, świateł i ziemi.
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    glb_path = out_dir / f"{args.name.lower()}-generated.glb"
    saved_tracks = [(track, track.mute) for track in armature.animation_data.nla_tracks]
    saved_pose, saved_frame = armature.data.pose_position, scene.frame_current
    try:
        for track, _ in saved_tracks:
            track.mute = False
        # Rest Position wyłącza ocenę animacji — wtedy glTF zapisuje siedem
        # nazw klipów, lecz wszystkie kanały pozostają stałe.
        armature.data.pose_position = "POSE"
        bpy.ops.export_scene.gltf(
            filepath=str(glb_path),
            export_format="GLB",
            use_selection=True,
            use_active_scene=True,
            export_apply=False,
            export_animations=True,
            export_animation_mode="NLA_TRACKS",
            export_nla_strips=True,
            export_force_sampling=True,
            export_frame_step=1,
            export_skins=True,
            export_influence_nb=4,
            export_all_influences=False,
            export_rest_position_armature=True,
            export_yup=True,
            export_cameras=False,
            export_lights=False,
            export_materials="EXPORT",
            export_normals=True,
            export_texcoords=False,
        )
    finally:
        for track, mute in saved_tracks:
            track.mute = mute
        armature.data.pose_position = saved_pose
        scene.frame_set(saved_frame)
        bpy.context.view_layer.update()

    bounds = [body.matrix_world @ Vector(corner) for corner in body.bound_box]
    zs = [point.z for point in bounds]
    report = {
        "tool": "character-build",
        "version": VERSION,
        "name": args.name,
        "source_measurements": str(args.measurements),
        "depth_hints": ({
            "file": str(args.depth_hints),
            "sha256": hashlib.sha256(args.depth_hints.expanduser().read_bytes()).hexdigest(),
            "hint_policy": depth_hints["hint_policy"],
            "multipliers": depth_hints["depth_hints"],
            "warning": "Eksperymentalne założenie modelarskie, nie pomiar grubości.",
        } if depth_hints is not None else None),
        "depth_profile": (
            {
                "file": str(args.depth_profile),
                "sha256": hashlib.sha256(args.depth_profile.expanduser().read_bytes()).hexdigest(),
                "source_label": depth_profile.get("source_label"),
                "provenance": depth_profile.get("provenance"),
            }
            if depth_profile
            else None
        ),
        "plan": plan.as_dict(),
        "mesh": {
            "vertices": len(body.data.vertices),
            "polygons": len(body.data.polygons),
            "materials": [slot.material.name for slot in body.material_slots if slot.material],
            "height_m": round(max(zs) - min(zs), 4),
            "min_z": round(min(zs), 4),
            "max_z": round(max(zs), 4),
        },
        "rig": {
            "bones": len(armature.data.bones),
            "bone_names": [bone.name for bone in armature.data.bones],
            "actions": [action.name for action in actions],
            "nla_tracks": [track.name for track in armature.animation_data.nla_tracks],
        },
        "renders": render_paths,
        "beauty": str(beauty_path) if beauty_path else None,
        "blend": str(blend_path),
        "glb": str(glb_path),
        "glb_bytes": glb_path.stat().st_size if glb_path.exists() else 0,
        "glb_sha256": hashlib.sha256(glb_path.read_bytes()).hexdigest(),
        "warnings": warnings,
    }
    (out_dir / "build.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(json.dumps({
        "status": "ok",
        "mesh_vertices": report["mesh"]["vertices"],
        "mesh_polygons": report["mesh"]["polygons"],
        "height_m": report["mesh"]["height_m"],
        "bones": report["rig"]["bones"],
        "actions": report["rig"]["actions"],
        "glb_bytes": report["glb_bytes"],
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
