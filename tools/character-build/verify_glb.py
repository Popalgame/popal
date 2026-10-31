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
import hashlib
import json
import math
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="Weryfikacja GLB po reimportcie")
    parser.add_argument("glb", type=Path)
    parser.add_argument("report", type=Path, nargs="?", default=None)
    parser.add_argument("--samples", type=int, default=3,
                        help="próbki na klip: początek, środek, koniec i tak są")
    parser.add_argument("--render-dir", type=Path, help="rendery Rest i próbek każdej animacji")
    return parser.parse_args(argv)


def max_influences(mesh: bpy.types.Mesh) -> dict:
    worst = 0
    bad_sum = 0
    negative = 0
    for vertex in mesh.vertices:
        values = [group.weight for group in vertex.groups]
        worst = max(worst, sum(value > 1e-6 for value in values))
        total = sum(values)
        if not all(math.isfinite(value) for value in values) or abs(total - 1.0) > 0.02:
            bad_sum += 1
        if any(value < 0 for value in values):
            negative += 1
    return {
        "max_influences": worst,
        "vertices_bad_weight_sum": bad_sum,
        "vertices_negative_weight": negative,
        "vertices": len(mesh.vertices),
    }


def animation_samples(armature: bpy.types.Object, body, scene, samples=3,
                      render_dir=None) -> list[dict]:
    results = []
    if armature.animation_data is None:
        return results
    animation = armature.animation_data
    tracks = list(animation.nla_tracks)
    saved = [(track, track.mute, track.is_solo) for track in tracks]
    old_action, old_slot = animation.action, animation.action_slot
    old_pose, old_frame = armature.data.pose_position, scene.frame_current
    try:
        animation.action = None
        armature.data.pose_position = "POSE"
        for track in tracks:
            track.mute, track.is_solo = True, False
        for index, track in enumerate(tracks):
            track.mute = False  # jeden klip, nigdy suma ścieżek NLA
            try:
                for strip in track.strips:
                    action = strip.action
                    start, end = strip.frame_start, strip.frame_end
                    frames = sorted({round(start + (end - start) * i / (samples - 1))
                                     for i in range(samples)} | {round((start + end) / 2)})
                    entries = []
                    for frame in frames:
                        scene.frame_set(frame)
                        bpy.context.view_layer.update()
                        dg = bpy.context.evaluated_depsgraph_get()
                        evaluated = body.evaluated_get(dg)
                        mesh = evaluated.to_mesh()
                        try:
                            points = [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
                            zs = [point.z for point in points]
                            finite = all(math.isfinite(value) for point in points for value in point)
                        finally:
                            evaluated.to_mesh_clear()
                        entry = {"frame": frame, "z_min": round(min(zs), 4),
                                 "z_max": round(max(zs), 4), "finite": finite}
                        if render_dir:
                            path = render_dir / f"clip-{index:02d}-{frame:04d}.png"
                            scene.render.filepath = str(path)
                            bpy.ops.render.render(write_still=True)
                            entry["render"] = str(path)
                        entries.append(entry)
                    results.append({
                        "track": track.name, "action": action.name if action else None,
                        "frames": [int(start), int(end)], "samples": entries,
                        "exploded": any(not entry["finite"] or entry["z_max"] > 3.0
                                        or entry["z_min"] < -1.0 for entry in entries),
                    })
            finally:
                track.mute = True
    finally:
        animation.action = old_action
        if old_action and old_slot:
            animation.action_slot = old_slot
        for track, mute, solo in saved:
            track.mute, track.is_solo = mute, solo
        armature.data.pose_position = old_pose
        scene.frame_set(old_frame)
    return results


def moving_channel_counts(document, payload, binary_offset):
    """Sprawdź dane binarne, nie samą obecność nazw klipów.

    Eksporter projektu zapisuje niekompresowane float32. Inny format jest
    oznaczany jako niesprawdzony, zamiast fałszywego zera ruchu.
    """
    counts = {}
    for index, animation in enumerate(document.get("animations", [])):
        moving, unknown = 0, 0
        for channel in animation.get("channels", []):
            sampler = animation["samplers"][channel["sampler"]]
            accessor = document["accessors"][sampler["output"]]
            dimensions = {"SCALAR": 1, "VEC3": 3, "VEC4": 4}.get(accessor["type"])
            if (accessor.get("componentType") != 5126 or not dimensions
                    or "bufferView" not in accessor or "sparse" in accessor):
                unknown += 1
                continue
            view = document["bufferViews"][accessor["bufferView"]]
            offset = binary_offset + view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
            stride = view.get("byteStride", dimensions * 4)
            values = [struct.unpack_from("<" + "f" * dimensions, payload, offset + i * stride)
                      for i in range(accessor["count"])]
            if values and any(max(value[k] for value in values) - min(value[k] for value in values) > 1e-5
                              for k in range(dimensions)):
                moving += 1
        counts[animation.get("name", str(index))] = {"moving": moving, "unchecked": unknown}
    return counts


def setup_preview(scene, body, directory):
    """Tylko scena walidacyjna w tym osobnym procesie; nie zapisujemy .blend."""
    directory.mkdir(parents=True, exist_ok=True)
    for engine in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    scene.render.resolution_x, scene.render.resolution_y = 320, 400
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    points = [body.matrix_world @ Vector(corner) for corner in body.bound_box]
    center_z = (min(p.z for p in points) + max(p.z for p in points)) / 2
    camera_data = bpy.data.cameras.new("VerificationCamera")
    camera_data.type, camera_data.ortho_scale = "ORTHO", 2.6
    camera = bpy.data.objects.new("VerificationCamera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = (3, -5, 2)
    camera.rotation_euler = (Vector((0, 0, center_z)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera
    for name, location, energy in (("Key", (-3, -4, 4), 300), ("Fill", (3, 2, 3), 200)):
        data = bpy.data.lights.new(name, type="AREA")
        data.energy, data.size = energy, 4
        obj = bpy.data.objects.new(name, data)
        scene.collection.objects.link(obj)
        obj.location = location
        obj.rotation_euler = (Vector((0, 0, center_z)) - obj.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = str(directory / "rest.png")
    bpy.ops.render.render(write_still=True)


def main() -> int:
    args = parse_args()
    if args.samples < 3:
        raise ValueError("wymagane co najmniej 3 próbki na klip")
    glb_path = args.glb.expanduser().resolve()
    if not glb_path.is_file():
        print(f"Błąd: nie ma pliku {glb_path}", file=sys.stderr)
        return 1

    payload = glb_path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", payload)
    if magic != b"glTF" or version != 2 or length != len(payload):
        raise ValueError("niepoprawny nagłówek GLB")
    json_length, json_type = struct.unpack_from("<I4s", payload, 12)
    if json_type != b"JSON":
        raise ValueError("brak sekcji JSON GLB")
    document = json.loads(payload[20:20 + json_length])
    motion_counts = moving_channel_counts(document, payload, 28 + json_length)
    # Jednorazowy walidator na czystej scenie, nigdy na GUI użytkownika.
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
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
    if args.render_dir and body:
        setup_preview(scene, body, args.render_dir.expanduser().resolve())
    for armature in armatures:
        if body:
            animation.extend(animation_samples(armature, body, scene, args.samples,
                args.render_dir.expanduser().resolve() if args.render_dir else None))

    report = {
        "tool": "character-build-verify",
        "version": 2,
        "sha256": hashlib.sha256(payload).hexdigest(),
        "blender_version": bpy.app.version_string,
        "glb_structure": {
            "scenes": len(document.get("scenes", [])),
            "meshes": len(document.get("meshes", [])),
            "skins": len(document.get("skins", [])),
            "animations": [a.get("name") for a in document.get("animations", [])],
            "animation_motion": motion_counts,
            "skinned_primitives": sum(
                {"JOINTS_0", "WEIGHTS_0"} <= set(p.get("attributes", {}))
                for mesh in document.get("meshes", []) for p in mesh["primitives"]),
        },
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
    for name, motion in motion_counts.items():
        if not motion["moving"]:
            report["warnings"].append(f"{name}: brak potwierdzonych ruchomych kanałów")
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
        if mesh["vertices_negative_weight"]:
            report["warnings"].append(f"{mesh['name']}: ujemne wagi")
    for clip in animation:
        if clip["exploded"]:
            report["warnings"].append(f"{clip['track']}: bounds poza rozsądkiem")

    document = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
    if args.report:
        args.report.expanduser().parent.mkdir(parents=True, exist_ok=True)
        args.report.expanduser().write_text(document, encoding="utf-8")
    print(document)
    return 1 if report["warnings"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
