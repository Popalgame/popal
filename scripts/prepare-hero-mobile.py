"""Build and verify an isolated mobile hero experiment.

Run: blender -b --python scripts/prepare-hero-mobile.py
The shipped hero and game runtime are never modified.
"""

import json
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "site/assets/models/hero-rigged.glb"
OUT = ROOT / "docs/assets"
STEM = "hero-mobile-candidate"
TARGET_TRIS = 38000
TEXTURE_SIZE = 2048
CLIPS = {"idle", "walk", "run", "swim", "hit", "throw", "jump"}


def triangles(mesh):
    return sum(len(face.vertices) - 2 for face in mesh.polygons)


def inspect_scene():
    meshes = [obj for obj in bpy.context.scene.objects
              if obj.type == "MESH" and obj.find_armature()]
    arms = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    assert len(meshes) == len(arms) == 1, "Expected one skinned mesh and one armature"
    mesh, arm = meshes[0], arms[0]
    assert mesh.find_armature() == arm
    assert len(arm.data.bones) == 22
    assert {action.name for action in bpy.data.actions} == CLIPS
    assert all(vertex.groups for vertex in mesh.data.vertices), "Missing source skin weights"
    return mesh, arm


def animation_samples(arm):
    """Sample every bone at the start, midpoint, and end of each clip."""
    samples = {}
    scene = bpy.context.scene
    for action in bpy.data.actions:
        arm.animation_data.action = action
        arm.animation_data.action_slot = action.slots[0]
        start, end = action.frame_range
        for frame in (start, (start + end) / 2, end):
            scene.frame_set(int(frame), subframe=frame % 1)
            samples[(action.name, frame)] = {
                bone.name: tuple(value for row in bone.matrix for value in row)
                for bone in arm.pose.bones
            }
    arm.animation_data.action = None
    return samples


def resize_images():
    for image in bpy.data.images:
        if image.type != "IMAGE" or not image.has_data:
            continue
        width, height = image.size
        factor = min(1, TEXTURE_SIZE / max(width, height))
        if factor < 1:
            image.scale(round(width * factor), round(height * factor))
        image.pack()


def limit_skin_influences(mesh):
    """Match the four weights per vertex that glTF exports for this runtime."""
    groups = list(mesh.vertex_groups)
    for vertex in mesh.data.vertices:
        influences = sorted(((group.group, group.weight) for group in vertex.groups),
                            key=lambda pair: pair[1], reverse=True)
        keep = influences[:4]
        total = sum(weight for _, weight in keep)
        assert total > 0
        for index, _ in influences[4:]:
            groups[index].remove([vertex.index])
        for index, weight in keep:
            groups[index].add([vertex.index], weight / total, "REPLACE")


def protect_features(mesh):
    """Discourage edge collapse around the face, hair, and hands."""
    group = mesh.vertex_groups.new(name="Mobile feature protection")
    for vertex in mesh.data.vertices:
        x, _y, z = mesh.matrix_world @ vertex.co
        head = z > 1.28 and abs(x) < .38
        hands = .97 < z < 1.42 and abs(x) > .42
        if head or hands:
            group.add([vertex.index], 1.0, "REPLACE")
    return group


def feature_counts(mesh):
    points = [mesh.matrix_world @ vertex.co for vertex in mesh.data.vertices]
    return {
        "head": sum(point.z > 1.28 and abs(point.x) < .38 for point in points),
        "hands": sum(.97 < point.z < 1.42 and abs(point.x) > .42 for point in points),
    }


def render_comparison(original_data, candidate, arm):
    """Compare both meshes under the same animated walk pose."""
    scene = bpy.context.scene
    source_arm = arm.copy()
    source_arm.data = arm.data.copy()
    scene.collection.objects.link(source_arm)
    source_mesh = candidate.copy()
    source_mesh.data = original_data
    scene.collection.objects.link(source_mesh)
    source_mesh.parent = source_arm
    for modifier in source_mesh.modifiers:
        if modifier.type == "ARMATURE":
            modifier.object = source_arm
    source_arm.matrix_world = Matrix.Translation(Vector((-.7, 0, 0))) @ arm.matrix_world
    arm.matrix_world = Matrix.Translation(Vector((.7, 0, 0))) @ arm.matrix_world
    walk = bpy.data.actions["walk"]
    for rig in (source_arm, arm):
        rig.animation_data.action = walk
        rig.animation_data.action_slot = walk.slots[0]
    scene.frame_set(5)
    for name, x in (("Original 50k", -.7), ("Mobile 38k", .7)):
        font = bpy.data.curves.new(name + " label", "FONT")
        font.body = name
        font.size = .085
        label = bpy.data.objects.new(name + " label", font)
        scene.collection.objects.link(label)
        label.location = (x - .27, -1, .38)
        label.rotation_euler = (1.57079632679, 0, 0)
    camera_data = bpy.data.cameras.new("Comparison camera")
    camera = bpy.data.objects.new("Comparison camera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = (0, -4, .95)
    camera.rotation_euler = (Vector((0, 0, .95)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 2.15
    scene.camera = camera
    light_data = bpy.data.lights.new("Comparison key", "AREA")
    light = bpy.data.objects.new("Comparison key", light_data)
    scene.collection.objects.link(light)
    light.location = (0, -2.5, 3.5)
    light_data.energy = 800
    light_data.size = 3
    scene.world = bpy.data.worlds.new("Comparison world")
    scene.world.color = (.15, .18, .22)
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 700
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(OUT / (STEM + "-preview.png"))
    bpy.ops.render.render(write_still=True)


def verify_glb(expected_tris, source_ranges, source_samples):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(OUT / (STEM + ".glb")))
    mesh, arm = inspect_scene()
    assert triangles(mesh.data) == expected_tris
    assert all(vertex.groups for vertex in mesh.data.vertices), "GLB lost skin weights"
    bone_names = {bone.name for bone in arm.data.bones}
    weighted = {
        mesh.vertex_groups[group.group].name
        for vertex in mesh.data.vertices for group in vertex.groups if group.weight > 0
    }
    assert bone_names <= weighted, "At least one bone has no weighted vertices"
    for action in bpy.data.actions:
        assert action.frame_range[1] > action.frame_range[0], f"Empty animation: {action.name}"
        assert list(action.frame_range) == source_ranges[action.name], (
            f"Changed animation range: {action.name}"
        )
    candidate_samples = animation_samples(arm)
    assert candidate_samples.keys() == source_samples.keys()
    maximum_bone_delta = max(
        abs(a - b)
        for key, bones in source_samples.items()
        for bone_name, values in bones.items()
        for a, b in zip(values, candidate_samples[key][bone_name])
    )
    assert maximum_bone_delta < 1e-4, f"Animation transform drift: {maximum_bone_delta}"
    print("MOBILE_REIMPORT", json.dumps({
        "triangles": triangles(mesh.data),
        "vertices": len(mesh.data.vertices),
        "bones": len(arm.data.bones),
        "weighted_bones": len(weighted & bone_names),
        "max_sampled_bone_matrix_delta": maximum_bone_delta,
        "clips": {action.name: list(action.frame_range) for action in bpy.data.actions},
        "images": {image.name: list(image.size) for image in bpy.data.images},
        "glb_bytes": (OUT / (STEM + ".glb")).stat().st_size,
    }, sort_keys=True))


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    mesh, arm = inspect_scene()
    source_ranges = {action.name: list(action.frame_range) for action in bpy.data.actions}
    source_samples = animation_samples(arm)
    source_tris = triangles(mesh.data)
    source_features = feature_counts(mesh)
    original_data = mesh.data.copy()
    print("MOBILE_SOURCE", json.dumps({
        "triangles": source_tris,
        "vertices": len(mesh.data.vertices),
        "glb_bytes": (ROOT / "site/assets/models/hero-rigged.glb").stat().st_size,
    }))
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    protected = protect_features(mesh)
    modifier = mesh.modifiers.new("Mobile triangle budget", "DECIMATE")
    modifier.ratio = TARGET_TRIS / source_tris
    modifier.vertex_group = protected.name
    modifier.vertex_group_factor = 20
    modifier.invert_vertex_group = True
    bpy.ops.object.modifier_move_up(modifier=modifier.name)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    reduced_tris = triangles(mesh.data)
    reduced_features = feature_counts(mesh)
    assert reduced_tris <= TARGET_TRIS + 100 and reduced_tris < source_tris * .8
    assert all(reduced_features[part] >= source_features[part] * .99
               for part in source_features), "Protected features lost detail"
    print("MOBILE_FEATURES", json.dumps({"source": source_features,
                                         "candidate": reduced_features}))
    assert len(mesh.data.uv_layers) > 0
    assert all(vertex.groups for vertex in mesh.data.vertices), "Decimation lost skin weights"
    limit_skin_influences(mesh)
    resize_images()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / (STEM + ".blend")))
    bpy.ops.export_scene.gltf(
        filepath=str(OUT / (STEM + ".glb")),
        export_format="GLB", export_animations=True, export_skins=True,
        export_all_influences=False,
    )
    arm.animation_data.action = None
    for bone in arm.pose.bones:
        bone.matrix_basis.identity()
    bpy.context.scene.frame_set(1)
    render_comparison(original_data, mesh, arm)
    verify_glb(reduced_tris, source_ranges, source_samples)


if __name__ == "__main__":
    main()
