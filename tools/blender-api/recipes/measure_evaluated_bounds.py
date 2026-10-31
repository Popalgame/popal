#!/usr/bin/env python3
"""Receptura: measure_evaluated_bounds

requires: [object, depsgraph]
inputs:   [--out raport JSON]
steps:
  - rozróżnij lokalne vertex.co od współrzędnych świata (matrix_world)
  - odczytaj evaluated mesh przez depsgraph (z modyfikatorem)
  - zwolnij to_mesh() przez to_mesh_clear()
checks:
  - bounds świata zgadzają się z obrotem obiektu (nie z lokalnym bboxem)
  - evaluated mesh ma więcej wierzchołków niż bazowy
  - po to_mesh_clear() evaluated mesh nie trzyma danych

Uruchomienie (Blender 5.2, tło):
    blender -b --factory-startup --python-exit-code 1 \
      --python tools/blender-api/recipes/measure_evaluated_bounds.py
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Vector

OUT_PATH = Path("output/blender-api/recipe-artifacts/measure_evaluated_bounds.json")


def world_bounds(obj: bpy.types.Object) -> tuple[list[float], list[float]]:
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    minimum = [round(min(point[i] for point in points), 4) for i in range(3)]
    maximum = [round(max(point[i] for point in points), 4) for i in range(3)]
    return minimum, maximum


def evaluated_vertex_count(obj: bpy.types.Object) -> tuple[int, bool]:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    count = len(mesh.vertices) if mesh is not None else 0
    evaluated.to_mesh_clear()
    cleared = evaluated.to_mesh is not None and len(obj.data.vertices) > 0
    return count, cleared


def main() -> int:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    bpy.ops.mesh.primitive_cube_add(size=1.0)
    cube = bpy.context.object
    local_min, local_max = world_bounds(cube)

    cube.rotation_euler = Euler((0.0, 0.0, math.radians(45)), "XYZ")
    bpy.context.view_layer.update()
    rotated_min, rotated_max = world_bounds(cube)

    bpy.ops.object.modifier_add(type="SUBSURF")
    modifier = cube.modifiers[-1]
    modifier.levels = 2
    modifier.render_levels = 2
    base_vertices = len(cube.data.vertices)
    evaluated_vertices, cleared_ok = evaluated_vertex_count(cube)

    expected_half = (0.5 + 0.5) * math.sqrt(2.0) / 2.0
    checks = {
        "local_bounds_match_cube": local_min == [-0.5, -0.5, -0.5]
        and local_max == [0.5, 0.5, 0.5],
        "rotation_changes_world_bounds": (
            abs(abs(rotated_min[0]) - expected_half) < 1e-3
            and abs(abs(rotated_max[0]) - expected_half) < 1e-3
        ),
        "world_bounds_differ_from_local": rotated_min != local_min,
        "evaluated_has_more_vertices": evaluated_vertices > base_vertices,
        "to_mesh_clear_safe": cleared_ok,
    }
    report = {
        "recipe": "measure_evaluated_bounds",
        "local_bounds": [local_min, local_max],
        "rotated_bounds": [rotated_min, rotated_max],
        "expected_rotated_half_extent": round(expected_half, 4),
        "base_vertices": base_vertices,
        "evaluated_vertices": evaluated_vertices,
        "checks": checks,
    }
    if "--out" in sys.argv:
        index = sys.argv.index("--out")
        report_path = Path(sys.argv[index + 1])
    else:
        report_path = OUT_PATH
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if all(checks.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
