#!/usr/bin/env python3
"""Walidator sceny Blendera: szybki raport stanu pliku .blend.

Uruchomienie (Blender 5.2, tło):
    blender -b plik.blend --python-exit-code 1 --python \
      tools/blender-api/scene_check.py -- [--json raport.json]

Raportuje: kontekst pracy, sceny i obiekty, rigi, akcje i NLA, problemy
wag (liczba wpływów, sumy), materiały bez użytkowników, bounds obiektów.

To kontrole techniczne. Nie oceniają anatomii, przenikania ani jakości
ruchu — do tego potrzebne są rendery i oględziny.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="Raport stanu sceny")
    parser.add_argument("--json", type=Path, default=None)
    parser.add_argument("--max-influences", type=int, default=4)
    return parser.parse_args(argv)


def weight_report(obj: bpy.types.Object, limit: int) -> dict:
    mesh = obj.data
    max_influences = 0
    bad_sum = 0
    zero_vertices = 0
    for vertex in mesh.vertices:
        values = [group.weight for group in vertex.groups if abs(group.weight) > 1e-6]
        if not values:
            zero_vertices += 1
            continue
        max_influences = max(max_influences, len(values))
        if abs(sum(values) - 1.0) > 0.02:
            bad_sum += 1
    return {
        "vertices": len(mesh.vertices),
        "vertex_groups": len(obj.vertex_groups),
        "max_influences": max_influences,
        "over_limit": max_influences > limit,
        "bad_weight_sum": bad_sum,
        "vertices_without_weights": zero_vertices,
    }


def object_report(obj: bpy.types.Object, limit: int) -> dict:
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    minimum = [round(min(point[i] for point in points), 4) for i in range(3)]
    maximum = [round(max(point[i] for point in points), 4) for i in range(3)]
    entry = {
        "name": obj.name,
        "type": obj.type,
        "parent": obj.parent.name if obj.parent else None,
        "modifiers": [(m.type, m.name) for m in obj.modifiers],
        "bounds_min": minimum,
        "bounds_max": maximum,
    }
    if obj.type == "MESH":
        entry["triangles"] = sum(len(p.vertices) - 2 for p in obj.data.polygons)
        entry["materials"] = [
            slot.material.name if slot.material else None
            for slot in obj.material_slots
        ]
        entry["weights"] = weight_report(obj, limit)
    if obj.type == "ARMATURE":
        entry["bones"] = len(obj.data.bones)
        entry["pose_position"] = obj.data.pose_position
        entry["actions"] = sorted({strip.action.name for track in obj.animation_data.nla_tracks for strip in track.strips if strip.action}) if obj.animation_data else []
        entry["nla_tracks"] = (
            [track.name for track in obj.animation_data.nla_tracks]
            if obj.animation_data
            else []
        )
    return entry


def main() -> int:
    args = parse_args()
    scene = bpy.context.scene
    objects = [object_report(obj, args.max_influences) for obj in bpy.data.objects]

    weight_warnings = []
    for entry in objects:
        weights = entry.get("weights")
        if not weights:
            continue
        if weights["over_limit"]:
            weight_warnings.append(
                f"{entry['name']}: maks. {weights['max_influences']} wpływów "
                f"(limit {args.max_influences})"
            )
        if weights["bad_weight_sum"]:
            weight_warnings.append(
                f"{entry['name']}: {weights['bad_weight_sum']} wag poza 1±0.02"
            )

    orphan_meshes = sum(1 for mesh in bpy.data.meshes if mesh.users == 0)
    orphan_materials = sum(
        1 for material in bpy.data.materials if material.users == 0
    )
    orphan_actions = sum(1 for action in bpy.data.actions if action.users == 0)

    report = {
        "tool": "blender-api scene_check",
        "file": bpy.data.filepath or "<bez zapisu>",
        "blender_version": ".".join(str(part) for part in bpy.app.version),
        "scene": {
            "name": scene.name,
            "unit_system": scene.unit_settings.system,
            "scale_length": scene.unit_settings.scale_length,
            "engine": scene.render.engine,
            "resolution": [
                scene.render.resolution_x,
                scene.render.resolution_y,
                scene.render.resolution_percentage,
            ],
            "camera": scene.camera.name if scene.camera else None,
            "frame_current": scene.frame_current,
        },
        "counts": {
            "objects": len(bpy.data.objects),
            "meshes": len(bpy.data.meshes),
            "armatures": sum(
                1 for obj in bpy.data.objects if obj.type == "ARMATURE"
            ),
            "materials": len(bpy.data.materials),
            "actions": len(bpy.data.actions),
            "orphan_meshes": orphan_meshes,
            "orphan_materials": orphan_materials,
            "orphan_actions": orphan_actions,
        },
        "objects": objects,
        "warnings": weight_warnings,
    }

    document = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
    if args.json:
        args.json.expanduser().parent.mkdir(parents=True, exist_ok=True)
        args.json.expanduser().write_text(document, encoding="utf-8")
    print(document)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
