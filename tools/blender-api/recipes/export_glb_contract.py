#!/usr/bin/env python3
"""Receptura: export_glb_contract

requires: [mesh, armature, vertex_groups, action]
inputs:   [--out katalog wynikowy]
steps:
  - zbuduj minimalny szkic: siatka + 2 kości + wagi + 1 akcja w NLA
  - wyeksportuj wyłącznie zaznaczenie, tryb NLA_TRACKS (kontrakt projektu)
  - wyczyść scenę i zaimportuj plik ponownie
checks:
  - po reimportcie: 1 scena, 1 siatka, 1 armatura, animacje >= 1
  - maksymalna liczba wpływów <= 4, sumy wag 1 +/- 0.02
  - brak lamp, kamer i obcych siatek w pliku

Uruchomienie (Blender 5.2, tło):
    blender -b --factory-startup --python-exit-code 1 \
      --python tools/blender-api/recipes/export_glb_contract.py
"""

from __future__ import annotations

import json
import sys
from math import radians
from pathlib import Path

import bpy
from mathutils import Vector

OUT_DIR = Path("output/blender-api/recipe-artifacts/export_glb_contract")


def build_fixture() -> tuple[bpy.types.Object, bpy.types.Object]:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    armature_data = bpy.data.armatures.new("Rig")
    armature = bpy.data.objects.new("Rig", armature_data)
    bpy.context.scene.collection.objects.link(armature)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="EDIT")
    root = armature_data.edit_bones.new("Root")
    root.head = (0, 0, 0)
    root.tail = (0, 0, 0.5)
    child = armature_data.edit_bones.new("Child")
    child.head = (0, 0, 0.5)
    child.tail = (0, 0, 1.0)
    child.parent = root
    bpy.ops.object.mode_set(mode="OBJECT")

    mesh = bpy.data.meshes.new("Box")
    mesh.from_pydata(
        [
            (-0.25, -0.25, 0.0), (0.25, -0.25, 0.0),
            (0.25, 0.25, 0.0), (-0.25, 0.25, 0.0),
            (-0.25, -0.25, 1.0), (0.25, -0.25, 1.0),
            (0.25, 0.25, 1.0), (-0.25, 0.25, 1.0),
        ],
        [],
        [
            (0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4),
            (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7),
        ],
    )
    mesh.update()
    body = bpy.data.objects.new("Box", mesh)
    bpy.context.scene.collection.objects.link(body)
    lower = body.vertex_groups.new(name="Root")
    upper = body.vertex_groups.new(name="Child")
    for vertex in mesh.vertices:
        target = upper if vertex.co.z > 0.5 else lower
        target.add([vertex.index], 1.0, "REPLACE")

    body.parent = armature
    modifier = body.modifiers.new("Armature", "ARMATURE")
    modifier.object = armature

    armature.animation_data_create()
    action = bpy.data.actions.new("sway")
    action.use_fake_user = True
    armature.animation_data.action = action
    pose_bone = armature.pose.bones["Child"]
    pose_bone.rotation_mode = "XYZ"
    bpy.context.scene.frame_set(1)
    pose_bone.rotation_euler = (0, 0, radians(-30))
    pose_bone.keyframe_insert("rotation_euler", frame=1, group="Child")
    bpy.context.scene.frame_set(24)
    pose_bone.rotation_euler = (0, 0, radians(30))
    pose_bone.keyframe_insert("rotation_euler", frame=24, group="Child")
    armature.animation_data.action = None
    # Tryb eksportu NLA_TRACKS czyta ścieżki NLA — sama akcja nie wystarczy.
    track = armature.animation_data.nla_tracks.new()
    track.name = "sway"
    track.strips.new("sway", 1, action)
    return body, armature


def export(body: bpy.types.Object, armature: bpy.types.Object, path: Path) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        use_active_scene=True,
        export_apply=False,
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_nla_strips=True,
        export_force_sampling=True,
        export_skins=True,
        export_all_influences=False,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
    )


def reimport(path: Path) -> dict:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [
        obj
        for obj in bpy.data.objects
        if obj not in before
        and not any(
            collection.name == "glTF_not_exported"
            for collection in obj.users_collection
        )
    ]
    meshes = [obj for obj in imported if obj.type == "MESH"]
    armatures = [obj for obj in imported if obj.type == "ARMATURE"]
    animations = 0
    for armature in armatures:
        if armature.animation_data:
            animations += sum(
                len(track.strips) for track in armature.animation_data.nla_tracks
            )

    weights = {"max_influences": 0, "bad_sum": 0}
    for mesh in meshes:
        for vertex in mesh.data.vertices:
            values = [group.weight for group in vertex.groups if group.weight > 1e-6]
            weights["max_influences"] = max(weights["max_influences"], len(values))
            if values and abs(sum(values) - 1.0) > 0.02:
                weights["bad_sum"] += 1

    unexpected = [
        obj.name for obj in imported if obj.type not in {"MESH", "ARMATURE"}
    ]
    return {
        "imported_objects": [obj.name for obj in imported],
        "meshes": len(meshes),
        "armatures": len(armatures),
        "animations": animations,
        "weights": weights,
        "unexpected_types": unexpected,
    }


def main() -> int:
    body, armature = build_fixture()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    glb_path = OUT_DIR / "fixture.glb"
    export(body, armature, glb_path)

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.armatures, bpy.data.actions):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)

    result = reimport(glb_path)
    checks = {
        "one_scene": len(bpy.data.scenes) == 1,
        "mesh_and_rig": result["meshes"] == 1 and result["armatures"] == 1,
        "animation_present": result["animations"] >= 1,
        "influence_limit": result["weights"]["max_influences"] <= 4,
        "weights_normalized": result["weights"]["bad_sum"] == 0,
        "no_unexpected_objects": not result["unexpected_types"],
        "file_written": glb_path.is_file() and glb_path.stat().st_size > 0,
    }
    report = {
        "recipe": "export_glb_contract",
        "file": str(glb_path),
        "bytes": glb_path.stat().st_size,
        "reimport": result,
        "checks": checks,
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if all(checks.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
