#!/usr/bin/env python3
"""Zweryfikuj wyeksportowany GLB przez reimport w czystej scenie.

Uruchamiaj wewnątrz Blendera:
    blender -b --factory-startup --python-exit-code 1 --python \
      tools/character-build/verify_glb.py -- path/to/model.glb [report.json]

Kontrole: sceny, siatki, materiały, skiny, kości, animacje, atrybuty
JOINTS/WEIGHTS (liczba wpływów i suma wag), bounds, próbki animacji.
To są kontrole techniczne — nie oceniają anatomii ani jakości ruchu.
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
    parser = argparse.ArgumentParser(description="Weryfikacja GLB po reimportcie")
    parser.add_argument("glb", type=Path)
    parser.add_argument("report", type=Path, nargs=None, default=None)
    parser.add_argument("--samples", type=int, default=3,
                        help="próbki na klip: początek, środek, koniec i tak są")
    return parser.parse_args(argv)


def max_influences(mesh: bpy.types.Mesh) -> dict:
    worst = 0
    bad_sum = 0
    negative = 0
    for vertex in mesh.vertices:
        values = [group.weight for group in vertex.groups if group.weight > 1e-6]
        worst = max(worst, len(values))
        total = sum(values)
        if abs(total - 1.0) > 0.02:
            bad_sum += 1
        if any(value < 0 for value in values):
            negative += 1
    return {
        "max_influences": worst,
        "vertices_bad_weight_sum": bad_sum,
        "vertices_negative_weight": negative,
        "vertices": len(mesh.vertices),
    }


def animation_samples(armature: bpy.types.Object, body, scene) -> list[dict]:
    results = []
    dg = bpy.context.evaluated_depsgraph_get()
    if armature.animation_data is None:
        return results
    for track in armature.animation_data.nla_tracks:
        for strip in track.strips:
            action = strip.action
            start, end = strip.action_frame_start, strip.action_frame_end
            frames = sorted({
                int(start),
                int((start + end) / 2),
                int(end),
            })
            entries = []
            for frame in frames:
                scene.frame_set(frame)
                evaluated = body.evaluated_get(dg)
                points = [
                    evaluated.matrix_world @ Vector(corner)
                    for corner in evaluated.bound_box
                ]
                zs = [point.z for point in points]
                entries.append({
                    "frame": frame,
                    "z_min": round(min(zs), 4),
                    "z_max": round(max(zs), 4),
                })
            results.append({
                "track": track.name,
                "action": action.name if action else None,
                "frames": [int(start), int(end)],
                "samples": entries,
                "exploded": any(
                    sample["z_max"] > 3.0 or sample["z_min"] < -1.0
                    for sample in entries
                ),
            })
    return results


def main() -> int:
    args = parse_args()
    glb_path = args.glb.expanduser().resolve()
    if not glb_path.is_file():
        print(f"Błąd: nie ma pliku {glb_path}", file=sys.stderr)
        return 1

    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(glb_path))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    # Importer glTF tworzy pomocniczy kształt kości (Icosphere) w ukrytej
    # kolekcji specjalnej; nie jest częścią assetu.
    special = "glTF_not_exported"
    imported = [
        obj
        for obj in imported
        if not any(collection.name == special for collection in obj.users_collection)
    ]
    scene = bpy.context.scene

    meshes = [obj for obj in imported if obj.type == "MESH"]
    armatures = [obj for obj in imported if obj.type == "ARMATURE"]

    mesh_reports = []
    for mesh in meshes:
        weights = max_influences(mesh.data)
        points = [mesh.matrix_world @ Vector(corner) for corner in mesh.bound_box]
        mesh_reports.append({
            "name": mesh.name,
            "vertices": len(mesh.data.vertices),
            "triangles": sum(
                len(polygon.vertices) - 2 for polygon in mesh.data.polygons
            ),
            "materials": [slot.material.name for slot in mesh.material_slots if slot.material],
            "shape_keys": mesh.data.shape_keys is not None,
            "bounds_min": [round(min(p[i] for p in points), 4) for i in range(3)],
            "bounds_max": [round(max(p[i] for p in points), 4) for i in range(3)],
            **weights,
        })

    animation = []
    body = meshes[0] if meshes else None
    for armature in armatures:
        animation.extend(animation_samples(armature, body, scene))

    report = {
        "tool": "character-build-verify",
        "version": 1,
        "file": str(glb_path),
        "bytes": glb_path.stat().st_size,
        "scenes": len(bpy.data.scenes),
        "imported_objects": len(imported),
        "meshes": mesh_reports,
        "armatures": [
            {
                "name": armature.name,
                "bones": len(armature.data.bones),
                "bone_names": [bone.name for bone in armature.data.bones],
            }
            for armature in armatures
        ],
        "animations": animation,
        "warnings": [],
    }

    if not meshes:
        report["warnings"].append("brak siatek po imporcie")
    for mesh in mesh_reports:
        if mesh["max_influences"] > 4:
            report["warnings"].append(
                f"{mesh['name']}: {mesh['max_influences']} wpływów na wierzchołek "
                "(kontrakt: maksymalnie 4)"
            )
        if mesh["vertices_bad_weight_sum"]:
            report["warnings"].append(
                f"{mesh['name']}: {mesh['vertices_bad_weight_sum']} wag poza sumą 1±0.02"
            )
    for clip in animation:
        if clip["exploded"]:
            report["warnings"].append(f"{clip['track']}: bounds poza rozsądkiem")

    document = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
    if args.report:
        args.report.expanduser().parent.mkdir(parents=True, exist_ok=True)
        args.report.expanduser().write_text(document, encoding="utf-8")
    print(document)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
