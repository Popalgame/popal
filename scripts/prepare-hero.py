"""Prepare an upright, textured humanoid GLB for the Popal hero runtime.

Run with Blender, for example:
  blender -b --python scripts/prepare-hero.py -- --source /path/to/hero.glb

Input contract: a single upright humanoid, feet below head, facing glTF +Z,
arms separated from the torso in an A or T pose, with embedded or resolvable
textures. --front also accepts glTF -Z, +X and -X. The output faces glTF +Z,
is 1.8 world units tall, and has feet at Y=0. Actions are locally authored;
this script does not claim that Mixamo produced them.
"""

import argparse
import math
import statistics
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector


BONES = [
    ("mixamorig:Hips", None, (0, 0, .38), (0, 0, .43)),
    ("mixamorig:Spine", "Hips", (0, 0, .43), (0, 0, .51)),
    ("mixamorig:Spine1", "Spine", (0, 0, .51), (0, 0, .59)),
    ("mixamorig:Spine2", "Spine1", (0, 0, .59), (0, 0, .67)),
    ("mixamorig:Neck", "Spine2", (0, 0, .67), (0, 0, .73)),
    ("mixamorig:Head", "Neck", (0, 0, .73), (0, 0, .98)),
    ("mixamorig:LeftShoulder", "Spine2", (.08, 0, .64), (.13, 0, .64)),
    ("mixamorig:LeftArm", "LeftShoulder", (.13, 0, .64), (.23, 0, .64)),
    ("mixamorig:LeftForeArm", "LeftArm", (.23, 0, .64), (.32, 0, .64)),
    ("mixamorig:LeftHand", "LeftForeArm", (.32, 0, .64), (.39, 0, .64)),
    ("mixamorig:RightShoulder", "Spine2", (-.08, 0, .64), (-.13, 0, .64)),
    ("mixamorig:RightArm", "RightShoulder", (-.13, 0, .64), (-.23, 0, .64)),
    ("mixamorig:RightForeArm", "RightArm", (-.23, 0, .64), (-.32, 0, .64)),
    ("mixamorig:RightHand", "RightForeArm", (-.32, 0, .64), (-.39, 0, .64)),
    ("mixamorig:LeftUpLeg", "Hips", (.065, 0, .38), (.07, 0, .20)),
    ("mixamorig:LeftLeg", "LeftUpLeg", (.07, 0, .20), (.07, 0, .055)),
    ("mixamorig:LeftFoot", "LeftLeg", (.07, 0, .055), (.07, -.065, .025)),
    ("mixamorig:LeftToeBase", "LeftFoot", (.07, -.065, .025), (.07, -.12, .025)),
    ("mixamorig:RightUpLeg", "Hips", (-.065, 0, .38), (-.07, 0, .20)),
    ("mixamorig:RightLeg", "RightUpLeg", (-.07, 0, .20), (-.07, 0, .055)),
    ("mixamorig:RightFoot", "RightLeg", (-.07, 0, .055), (-.07, -.065, .025)),
    ("mixamorig:RightToeBase", "RightFoot", (-.07, -.065, .025), (-.07, -.12, .025)),
]


def arguments():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source", type=Path, required=True)
    p.add_argument("--glb", type=Path, default=Path("site/assets/models/hero-rigged.glb"))
    p.add_argument("--blend", type=Path, default=Path("docs/assets/hero-rigged.blend"))
    p.add_argument("--fbx", type=Path, default=Path("docs/assets/hero-rigged.fbx"))
    p.add_argument("--front", choices=("+Z", "-Z", "+X", "-X"), default="+Z",
                   help="Source facing direction in glTF coordinates")
    p.add_argument("--max-tris", type=int, default=50000)
    p.add_argument("--no-fbx", action="store_true")
    return p.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])


def full_name(short):
    return "mixamorig:" + short


def meshes():
    return [o for o in bpy.context.scene.objects if o.type == "MESH" and len(o.data.vertices)]


def bounds(objects):
    points = [o.matrix_world @ Vector(corner) for o in objects for corner in o.bound_box]
    return Vector(tuple(min(p[i] for p in points) for i in range(3))), Vector(
        tuple(max(p[i] for p in points) for i in range(3)))


def body_measurements(objects):
    points = [o.matrix_world @ v.co for o in objects for v in o.data.vertices]
    min_z = min(p.z for p in points)
    max_z = max(p.z for p in points)
    span = max_z - min_z
    lower = [p.x for p in points if min_z + .10 * span < p.z < min_z + .36 * span]
    center_x = statistics.median(lower) if lower else statistics.median(p.x for p in points)
    center_y = statistics.median(p.y for p in points)
    left = center_x - min(p.x for p in points)
    right = max(p.x for p in points) - center_x
    half_reach = min(left, right)
    central = [p.z for p in points if abs(p.x - center_x) <= max(.08, half_reach * .55)]
    top = max(central) if central else max_z
    return min_z, top, center_x, center_y, half_reach


def normalize(objects, front):
    # Imported glTF +Z front becomes Blender -Y. Rotation is about Blender Z.
    degrees = {"+Z": 0, "-Z": 180, "+X": -90, "-X": 90}[front]
    rot = Matrix.Rotation(math.radians(degrees), 4, "Z")
    roots = [o for o in bpy.context.scene.objects if o.parent is None]
    for o in roots:
        o.matrix_world = rot @ o.matrix_world
    low_z, top_z, center_x, center_y, _ = body_measurements(objects)
    height = top_z - low_z
    if height <= 1e-5:
        raise ValueError("Source has zero height")
    scale = 1.8 / height
    matrix = Matrix.Translation(Vector((-center_x * scale, -center_y * scale,
                                        -low_z * scale))) @ Matrix.Scale(scale, 4)
    for o in roots:
        o.matrix_world = matrix @ o.matrix_world
    bpy.context.view_layer.update()


def triangle_count(objects):
    return sum(sum(max(0, len(p.vertices) - 2) for p in o.data.polygons) for o in objects)


def reduce_geometry(objects, limit):
    before = triangle_count(objects)
    if before <= limit:
        return
    # Decimation retains material slots, UVs, and image textures. Armatures and
    # their skin weights are left intact; changing topology there loses weights.
    if any(o.find_armature() for o in objects):
        print(f"Existing rig has {before} triangles; skipping destructive decimation")
        return
    ratio = max(.05, limit / before)
    for o in objects:
        if len(o.data.polygons) < 100:
            continue
        bpy.context.view_layer.objects.active = o
        mod = o.modifiers.new("Hero triangle budget", "DECIMATE")
        mod.ratio = ratio
        bpy.ops.object.modifier_apply(modifier=mod.name)
    print(f"Triangles: {before} -> {triangle_count(objects)}")


def embedded_images():
    for image in bpy.data.images:
        if image.size[0] > 2048 or image.size[1] > 2048:
            ratio = min(2048 / image.size[0], 2048 / image.size[1])
            image.scale(round(image.size[0] * ratio), round(image.size[1] * ratio))
        if image.source == "FILE" and not image.packed_file:
            try:
                image.pack()
            except RuntimeError as exc:
                print(f"Image cannot be packed: {image.name}: {exc}")


def create_armature(objects):
    _, _, _, _, half_reach = body_measurements(objects)
    arm_x = max(.55, min(1.35, half_reach / (.39 * 1.8)))
    arm_data = bpy.data.armatures.new("HeroArmature")
    arm = bpy.data.objects.new("HeroRig", arm_data)
    bpy.context.collection.objects.link(arm)
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for name, _, head, tail in BONES:
        bone = arm_data.edit_bones.new(name)
        factor = arm_x if any(term in name for term in ("Arm", "Shoulder", "Hand")) else 1
        bone.head = Vector((head[0] * factor, head[1], head[2])) * 1.8
        bone.tail = Vector((tail[0] * factor, tail[1], tail[2])) * 1.8
    for name, parent, _, _ in BONES:
        if parent:
            arm_data.edit_bones[name].parent = arm_data.edit_bones[full_name(parent)]
    bpy.ops.object.mode_set(mode="OBJECT")
    arm.show_in_front = True
    return arm


def segment_distance(point, a, b):
    ab = b - a
    factor = max(0., min(1., (point - a).dot(ab) / max(ab.length_squared, 1e-8)))
    return (point - (a + ab * factor)).length, factor


def fallback_weights(o, arm):
    """Anatomical smooth weights when Blender's heat solve rejects scan meshes."""
    groups = {b.name: o.vertex_groups.get(b.name) or o.vertex_groups.new(name=b.name)
              for b in arm.data.bones}
    names = [name for name, _, _, _ in BONES]
    positions = {b.name: (b.head_local, b.tail_local) for b in arm.data.bones}
    for v in o.data.vertices:
        p = o.matrix_world @ v.co
        x, y, z = p
        candidates = []
        for name in names:
            short = name.split(":")[-1]
            side = 1 if short.startswith("Left") else -1 if short.startswith("Right") else 0
            if side and x * side < -.015:
                continue
            d, t = segment_distance(p, *positions[name])
            if "Leg" in short or "Foot" in short or "Toe" in short:
                if z > .84:
                    continue
                if z > .70:
                    d += (z - .70) * 2
            elif "Arm" in short or "Shoulder" in short or "Hand" in short:
                if z < .82:
                    d += (.82 - z) * 1.6
            elif short in ("Head", "Neck"):
                if z < 1.20:
                    d += (1.20 - z) * 2
            else:
                if z < .70:
                    d += (.70 - z) * 1.5
                if abs(x) > .20:
                    d += (abs(x) - .20) * 1.3
            candidates.append((name, d))
        candidates.sort(key=lambda item: item[1])
        nearest = candidates[:4]
        weights = [(name, 1 / max(.025, d) ** 3) for name, d in nearest]
        total = sum(weight for _, weight in weights)
        for name, weight in weights:
            groups[name].add([v.index], weight / total, "REPLACE")


def rig_meshes(objects, arm):
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = arm
    try:
        bpy.ops.object.parent_set(type="ARMATURE_AUTO", keep_transform=True)
        valid = all(o.find_armature() == arm and all(v.groups for v in o.data.vertices)
                    for o in objects)
    except RuntimeError as exc:
        print(f"Automatic weights failed: {exc}")
        valid = False
    if not valid:
        for o in objects:
            for group in list(o.vertex_groups):
                o.vertex_groups.remove(group)
            fallback_weights(o, arm)
            if o.parent != arm:
                world = o.matrix_world.copy()
                o.parent = arm
                o.matrix_world = world
            if not any(m.type == "ARMATURE" for m in o.modifiers):
                mod = o.modifiers.new("Hero skin", "ARMATURE")
                mod.object = arm
    rigid_regions(objects)
    for o in objects:
        for v in o.data.vertices:
            influences = [(o.vertex_groups[g.group], g.weight) for g in v.groups
                          if o.vertex_groups[g.group].name in arm.data.bones and g.weight > 0]
            total = sum(weight for _, weight in influences)
            if total <= 0:
                raise ValueError(f"Unweighted vertex in {o.name}")
            for group, weight in influences:
                group.add([v.index], weight / total, "REPLACE")
    print("Rig weights:", "auto" if valid else "anatomical fallback")


def rigid_regions(objects):
    """Keep the face, backpack and held prop intact on fragmented scan meshes."""
    for o in objects:
        buckets = {"Head": [], "LeftHand": [], "Spine1": []}
        for v in o.data.vertices:
            x, y, z = o.matrix_world @ v.co
            if x > .50 and z > .78:
                buckets["LeftHand"].append(v.index)
            elif z > 1.27 and abs(x) < .50:
                buckets["Head"].append(v.index)
            elif y > .12 and abs(x) < .42 and .68 < z < 1.20:
                buckets["Spine1"].append(v.index)
        affected = [i for indices in buckets.values() for i in indices]
        if not affected:
            continue
        for group in o.vertex_groups:
            group.remove(affected)
        for short, indices in buckets.items():
            if indices:
                o.vertex_groups[full_name(short)].add(indices, 1, "REPLACE")
        print("Rigid regions", o.name, {name: len(indices) for name, indices in buckets.items()})


def vector_rotation(arm, bone_name, specification):
    bone = arm.data.bones[bone_name]
    rest = bone.matrix_local.to_3x3()
    rotations = (specification,) if isinstance(specification[0][0], (int, float)) else specification
    world = Quaternion()
    for axis, angle in rotations:
        world = Quaternion(Vector(axis), angle) @ world
    local = rest.inverted() @ world.to_matrix() @ rest
    return local.to_quaternion()


def canonicalize_bones(arm, objects):
    aliases = {"leftupperarm": "LeftArm", "rightupperarm": "RightArm",
               "leftlowerarm": "LeftForeArm", "rightlowerarm": "RightForeArm",
               "leftforearm": "LeftForeArm", "rightforearm": "RightForeArm",
               "leftupperleg": "LeftUpLeg", "rightupperleg": "RightUpLeg",
               "leftthigh": "LeftUpLeg", "rightthigh": "RightUpLeg",
               "leftlowerleg": "LeftLeg", "rightlowerleg": "RightLeg",
               "leftshin": "LeftLeg", "rightshin": "RightLeg",
               "pelvis": "Hips", "root": "Hips", "chest": "Spine2"}
    known = {name.split(":")[-1].lower(): name.split(":")[-1] for name, _, _, _ in BONES}
    for bone in list(arm.data.bones):
        stem = bone.name.split(":")[-1]
        if stem.lower().startswith("mixamorig"):
            stem = stem[10:]
        key = "".join(c for c in stem.lower() if c.isalnum())
        short = aliases.get(key) or known.get(key)
        if short:
            old_name = bone.name
            bone.name = full_name(short)
            for o in objects:
                group = o.vertex_groups.get(old_name)
                if group:
                    group.name = bone.name
    essential = ("Hips", "Spine", "Head", "LeftArm", "RightArm",
                 "LeftUpLeg", "RightUpLeg")
    missing = [name for name in essential if full_name(name) not in arm.data.bones]
    if missing:
        raise ValueError(f"Pre-rigged source missing recognized humanoid bones: {missing}")


def normalize_existing_weights(objects, arm):
    for o in objects:
        for v in o.data.vertices:
            influences = [(o.vertex_groups[g.group], g.weight) for g in v.groups
                          if o.vertex_groups[g.group].name in arm.data.bones and g.weight > 0]
            total = sum(weight for _, weight in influences)
            if total <= 0:
                raise ValueError(f"Unweighted vertex in {o.name}")
            for group, weight in influences:
                group.add([v.index], weight / total, "REPLACE")


def action(arm, name, frames, fps=30):
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    slot = act.slots.new("OBJECT", arm.name)
    arm.animation_data_create()
    arm.animation_data.action = act
    arm.animation_data.action_slot = slot
    for frame, rotations in frames:
        for bone in arm.pose.bones:
            short = bone.name.split(":")[-1]
            bone.rotation_mode = "QUATERNION"
            specification = rotations.get(short, ((1, 0, 0), 0))
            bone.rotation_quaternion = vector_rotation(arm, bone.name, specification)
            bone.keyframe_insert("rotation_quaternion", frame=frame, group=bone.name)
    for layer in act.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    for key in fc.keyframe_points:
                        key.interpolation = "LINEAR"
    return act


def add_animations(arm):
    # World-axis rotations are converted into each bone's rest-local frame.
    def gait(phase, amp, arms=.6):
        s = math.sin(phase)
        return {
            "LeftUpLeg": ((1, 0, 0), amp * s),
            "RightUpLeg": ((1, 0, 0), -amp * s),
            "LeftLeg": ((1, 0, 0), max(0, -s) * amp * .8),
            "RightLeg": ((1, 0, 0), max(0, s) * amp * .8),
            "LeftArm": (((0, 1, 0), .9), ((1, 0, 0), -amp * s * arms)),
            "RightArm": (((0, 1, 0), -.9), ((1, 0, 0), amp * s * arms)),
            "LeftForeArm": ((0, 1, 0), .17),
            "RightForeArm": ((0, 1, 0), -.17),
            "LeftHand": ((0, 1, 0), -1.07),
        }
    idle = {"LeftArm": ((0, 1, 0), .9), "RightArm": ((0, 1, 0), -.9),
            "LeftForeArm": ((0, 1, 0), .16), "RightForeArm": ((0, 1, 0), -.16),
            "LeftHand": ((0, 1, 0), -1.06)}
    action(arm, "idle", [(1, idle), (16, {**idle, "Spine2": ((1, 0, 0), .025)}),
                         (31, idle)])
    action(arm, "walk", [(1 + i * 6, gait(i * math.pi / 2, .38)) for i in range(5)])
    action(arm, "run", [(1 + i * 4, gait(i * math.pi / 2, .67, .9)) for i in range(5)])
    swim_base = {"Hips": ((1, 0, 0), 1.25),
                 "LeftArm": ((0, 0, 1), -.9), "RightArm": ((0, 0, 1), .9)}
    action(arm, "swim", [(1, swim_base), (8, {**swim_base,
                                    "LeftArm": ((0, 0, 1), -.55),
                                    "RightArm": ((0, 0, 1), .55),
                                    "LeftUpLeg": ((1, 0, 0), .2),
                                    "RightUpLeg": ((1, 0, 0), -.2)}),
                         (16, {**swim_base, "LeftArm": ((0, 0, 1), -1.2),
                                     "RightArm": ((0, 0, 1), 1.2)}), (24, swim_base)])
    action(arm, "hit", [(1, idle), (4, {**idle,
                                   "RightArm": ((0, 1, 0), .55),
                                   "RightForeArm": ((0, 1, 0), .30),
                                   "RightHand": ((0, 1, 0), -.20)}),
                         (8, {**idle, "Spine2": ((0, 0, 1), .16),
                                   "RightArm": ((0, 1, 0), -1.25),
                                   "RightForeArm": ((0, 1, 0), -.40),
                                   "RightHand": ((0, 1, 0), .25)}), (15, idle)])
    action(arm, "throw", [(1, idle), (8, {**idle, "LeftArm": ((0, 1, 0), 1.2),
                                      "LeftForeArm": ((0, 1, 0), -.45),
                                      "LeftHand": ((0, 1, 0), -.75),
                                      "Spine2": ((0, 0, 1), -.18)}),
                           (13, {**idle, "LeftArm": ((0, 1, 0), -.52),
                                     "LeftHand": ((0, 1, 0), .68),
                                     "Spine2": ((0, 0, 1), .23)}), (23, idle)])
    action(arm, "jump", [(1, {**idle, "LeftUpLeg": ((1, 0, 0), -.35),
                                    "RightUpLeg": ((1, 0, 0), -.35)}),
                          (9, {"LeftArm": ((0, 1, 0), -.6),
                                   "RightArm": ((0, 1, 0), .6),
                                   "LeftHand": ((0, 1, 0), .44),
                                   "LeftUpLeg": ((1, 0, 0), .28),
                                   "RightUpLeg": ((1, 0, 0), .28)}), (19, idle)])
    arm.animation_data.action = None


def validate(objects, arm):
    if not objects or not arm:
        raise ValueError("Export needs meshes and an armature")
    for o in objects:
        if o.find_armature() != arm:
            raise ValueError(f"{o.name} is not bound to {arm.name}")
        for v in o.data.vertices:
            if not all(math.isfinite(c) for c in v.co):
                raise ValueError(f"Non-finite vertex in {o.name}")
            total = sum(g.weight for g in v.groups if o.vertex_groups[g.group].name in arm.data.bones)
            if not .995 <= total <= 1.005:
                raise ValueError(f"Unnormalized skin weight in {o.name}: {total}")
    expected = {"idle", "walk", "run", "swim", "hit", "throw", "jump"}
    if not expected <= set(bpy.data.actions.keys()):
        raise ValueError("Missing animation clips")
    low_z, top_z, _, _, _ = body_measurements(objects)
    if abs(low_z) > .03 or abs((top_z - low_z) - 1.8) > .03:
        raise ValueError(f"Bad normalized body height: {low_z} {top_z}")
    print(f"Validated: {len(objects)} mesh(es), {triangle_count(objects)} triangles, "
          f"{len(arm.data.bones)} bones, {len(expected)} clips")


def verify_reimport(glb):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(glb.resolve()))
    arms = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
    if len(arms) != 1:
        raise ValueError(f"Reimported GLB has {len(arms)} armatures; expected one")
    arm = arms[0]
    bound = [o for o in bpy.context.scene.objects
             if o.type == "MESH" and o.find_armature() == arm]
    validate(bound, arm)


def write_fbx_texture_sidecar(fbx):
    # FBX embeds color and normal maps, but has no standard combined
    # roughness/metallic texture channel. Keep every original packed map beside
    # the FBX so an artist can reconnect that channel in another DCC.
    folder = fbx.with_suffix(".fbm")
    folder.mkdir(parents=True, exist_ok=True)
    for image in bpy.data.images:
        if image.packed_file:
            (folder / Path(image.name).name).write_bytes(image.packed_file.data)


def main():
    args = arguments()
    source = args.source.expanduser().resolve()
    if not source.is_file() or source.suffix.lower() not in (".glb", ".gltf"):
        raise ValueError(f"Expected existing GLB/glTF source: {source}")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    objects = meshes()
    if not objects:
        raise ValueError("Source contains no mesh")
    normalize(objects, args.front)
    reduce_geometry(objects, args.max_tris)
    embedded_images()
    armatures = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
    arm = next((a for a in armatures if all(o.find_armature() == a for o in objects)), None)
    if arm:
        print(f"Preserving source armature {arm.name} and its existing weights")
        canonicalize_bones(arm, objects)
        normalize_existing_weights(objects, arm)
    else:
        arm = create_armature(objects)
        rig_meshes(objects, arm)
    for previous in list(bpy.data.actions):
        bpy.data.actions.remove(previous)
    add_animations(arm)
    validate(objects, arm)
    for path in (args.glb, args.blend, args.fbx):
        path.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(args.blend.resolve()))
    bpy.ops.export_scene.gltf(filepath=str(args.glb.resolve()), export_format="GLB",
                              export_animations=True, export_skins=True,
                              export_all_influences=False, export_image_format="AUTO")
    if not args.no_fbx:
        bpy.ops.object.select_all(action="DESELECT")
        arm.select_set(True)
        for o in objects:
            o.select_set(True)
        bpy.context.view_layer.objects.active = arm
        bpy.ops.export_scene.fbx(filepath=str(args.fbx.resolve()), use_selection=True,
                                 path_mode="COPY", embed_textures=True,
                                 add_leaf_bones=False, bake_anim=True)
        write_fbx_texture_sidecar(args.fbx)
    verify_reimport(args.glb)
    print("Wrote", args.glb, args.blend, "and" if not args.no_fbx else "", args.fbx if not args.no_fbx else "")


if __name__ == "__main__":
    main()
