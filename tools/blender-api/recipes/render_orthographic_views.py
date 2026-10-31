#!/usr/bin/env python3
"""Receptura: render_orthographic_views

requires: [camera, object]
inputs:   [--out katalog wynikowy]
steps:
  - dopasuj cztery kamery ortograficzne do bounds obiektu
  - renderuj front/left/back/right z przezroczystym tłem
checks:
  - cztery pliki istnieją i mają niepustą sylwetkę
  - sylwetka nie dotyka krawędzi kadru
  - widoki różnią się między sobą (nie wyrenderował się cztery razy ten sam)

Uruchomienie (Blender 5.2, tło):
    blender -b --factory-startup --python-exit-code 1 \
      --python tools/blender-api/recipes/render_orthographic_views.py
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

OUT_DIR = Path("output/blender-api/recipe-artifacts/render_orthographic_views")
MARGIN = 1.15


def pick_engine(scene: bpy.types.Scene) -> str:
    """Silnik zależy od builda: nie zakładaj jednego identyfikatora."""
    for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        try:
            scene.render.engine = engine
            return engine
        except TypeError:
            continue
    raise RuntimeError("brak znanego silnika renderującego")


def add_camera(name: str, location: Vector, rotation, ortho_scale: float):
    data = bpy.data.cameras.new(name)
    data.type = "ORTHO"
    data.ortho_scale = ortho_scale
    camera = bpy.data.objects.new(name, data)
    camera.location = location
    camera.rotation_euler = rotation
    bpy.context.scene.collection.objects.link(camera)
    return camera


def image_alpha_stats(path: Path) -> dict:
    image = bpy.data.images.load(str(path))
    try:
        pixels = image.pixels[:]
        width, height = image.size
        alpha = [pixels[i + 3] for i in range(0, len(pixels), 4)]
        border = 0.0
        for y in range(height):
            for x in (0, width - 1):
                border = max(border, alpha[y * width + x])
        for x in range(width):
            for y in (0, height - 1):
                border = max(border, alpha[y * width + x])
        return {
            "size": [width, height],
            "opaque_pixels": sum(1 for value in alpha if value > 0.05),
            "border_alpha_max": border,
        }
    finally:
        bpy.data.images.remove(image)


def main() -> int:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    # Obiekt próbny: asymetryczny, żeby widoki były rozróżnialne.
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.5))
    subject = bpy.context.object
    subject.name = "Subject"
    subject.scale = (1.0, 0.5, 1.0)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    light_data = bpy.data.lights.new("Sun", type="SUN")
    light_data.energy = 3.0
    light = bpy.data.objects.new("Sun", light_data)
    light.rotation_euler = (math.radians(50), 0, math.radians(30))
    bpy.context.scene.collection.objects.link(light)

    points = [subject.matrix_world @ Vector(corner) for corner in subject.bound_box]
    x_extent = max(point.x for point in points) - min(point.x for point in points)
    z_extent = max(point.z for point in points) - min(point.z for point in points)
    center_z = (max(point.z for point in points) + min(point.z for point in points)) / 2.0
    scale = max(x_extent, z_extent) * MARGIN

    half_x = x_extent * MARGIN
    views = {
        "front": ((0, -half_x - 1, center_z), (math.radians(90), 0, 0)),
        "left": ((-half_x - 1, 0, center_z), (math.radians(90), 0, math.radians(-90))),
        "back": ((0, half_x + 1, center_z), (math.radians(90), 0, math.radians(180))),
        "right": ((half_x + 1, 0, center_z), (math.radians(90), 0, math.radians(90))),
    }
    cameras = {
        name: add_camera(f"Camera{name.capitalize()}", location, rotation, scale)
        for name, (location, rotation) in views.items()
    }

    scene = bpy.context.scene
    engine = pick_engine(scene)
    scene.render.resolution_x = 256
    scene.render.resolution_y = 256
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.view_settings.view_transform = "Standard"

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    report_views = {}
    for name, camera in cameras.items():
        scene.camera = camera
        path = OUT_DIR / f"{name}.png"
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        report_views[name] = image_alpha_stats(path)

    checks = {
        "all_files_exist": all(
            (OUT_DIR / f"{name}.png").is_file() for name in views
        ),
        "silhouettes_present": all(
            view["opaque_pixels"] > 100 for view in report_views.values()
        ),
        "no_edge_touching": all(
            view["border_alpha_max"] == 0.0 for view in report_views.values()
        ),
        "views_differ": len({
            view["opaque_pixels"] for view in report_views.values()
        }) >= 2,
    }
    report = {
        "recipe": "render_orthographic_views",
        "engine": engine,
        "ortho_scale": round(scale, 4),
        "views": report_views,
        "checks": checks,
        "artifacts": str(OUT_DIR),
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if all(checks.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
