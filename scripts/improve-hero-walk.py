"""Build an isolated, measured walk experiment from the shipped hero GLB.

Run: blender -b --python scripts/improve-hero-walk.py
Outputs are confined to docs/assets/hero-walk-candidate.*,
docs/assets/hero-walk-preview.png and docs/assets/hero-walk-clip.glb.
"""

import json
import math
import subprocess
import tempfile
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "site/assets/models/hero-rigged.glb"
OUT = ROOT / "docs/assets"
FPS = 24
START = 0
END = 20
STANCE = 0.27
STRIDE = 0.30
ANKLE_Z = 0.100


def bone(arm, name):
    return arm.pose.bones["mixamorig:" + name]


def smooth(t):
    return t * t * (3 - 2 * t)


def world_axis_delta(pose_bone, axis, angle):
    rest = pose_bone.bone.matrix_local.to_3x3()
    return (rest.inverted() @ Quaternion(Vector(axis), angle).to_matrix() @ rest).to_quaternion()


def foot_position(phase, side):
    phase %= 1
    if phase < STANCE:
        y = -STRIDE / 2 + STRIDE * phase / STANCE
        lift = 0
    else:
        t = (phase - STANCE) / (1 - STANCE)
        y = STRIDE / 2 - STRIDE * smooth(t)
        lift = .045 * math.sin(math.pi * t) ** 1.25
    return (side * .126, y, ANKLE_Z + lift)


def set_linear(action):
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    for key in fc.keyframe_points:
                        key.interpolation = "LINEAR"


def sample(arm, action, frame):
    arm.animation_data.action = action
    arm.animation_data.action_slot = action.slots[0]
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    result = {}
    for side in ("Left", "Right"):
        for part in ("UpLeg", "Leg", "Foot", "ToeBase", "Hand"):
            p = bone(arm, side + part)
            result[side + part] = tuple((arm.matrix_world @ p.matrix).translation)
    return result


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    arm = bpy.data.objects["HeroRig"]
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.frame_start, scene.frame_end = START, END
    original = bpy.data.actions["walk"]
    baseline = []
    baseline_rotations = []
    for f in range(START, END + 1):
        baseline.append(sample(arm, original, f))
        baseline_rotations.append({p.name: p.rotation_quaternion.copy() for p in arm.pose.bones})
    original.name = "walk-original-reference"
    original.use_fake_user = False
    walk = bpy.data.actions.new("walk")
    walk.use_fake_user = True
    slot = walk.slots.new("OBJECT", arm.name)
    arm.animation_data.action = walk
    arm.animation_data.action_slot = slot

    targets = {}
    for side, sign in (("Left", 1), ("Right", -1)):
        target = bpy.data.objects.new(side + "AnkleIK", None)
        bpy.context.collection.objects.link(target)
        targets[side] = target
        shin = bone(arm, side + "Leg")
        constraint = shin.constraints.new("IK")
        constraint.target = target
        constraint.chain_count = 2
        constraint.use_rotation = False
        # Pole direction follows the anatomical forward bend of the knee.
        pole = bpy.data.objects.new(side + "KneePole", None)
        bpy.context.collection.objects.link(pole)
        pole.location = (sign * .126, -.65, .38)
        constraint.pole_target = pole
        constraint.pole_angle = 0
        targets[side + "Pole"] = pole

    for f in range(START, END + 1):
        phase = (f - START) / (END - START)
        for side, offset in (("Left", 0), ("Right", .5)):
            targets[side].location = foot_position(phase + offset, 1 if side == "Left" else -1)
            targets[side].keyframe_insert("location", frame=f)
        arm.animation_data.action = walk
        arm.animation_data.action_slot = slot
        hips = bone(arm, "Hips")
        world_shift = Vector((.005 * math.sin(2 * math.pi * phase), 0,
                              -.028 + .004 * math.cos(4 * math.pi * phase)))
        hips.location = hips.bone.matrix_local.to_3x3().inverted() @ world_shift
        hips.keyframe_insert("location", frame=f, group=hips.name)
        for p in arm.pose.bones:
            if p.name.endswith(("UpLeg", "Leg", "Foot", "ToeBase", "Hips")):
                continue
            p.rotation_mode = "QUATERNION"
            rotation = baseline_rotations[f - START][p.name]
            if p.name.endswith("Spine"):
                rotation = world_axis_delta(p, (0, 0, 1), .025 * math.sin(2 * math.pi * phase)) @ rotation
            elif p.name.endswith("Spine2"):
                rotation = world_axis_delta(p, (0, 0, 1), -.035 * math.sin(2 * math.pi * phase)) @ rotation
            elif p.name.endswith("LeftArm"):
                rotation = world_axis_delta(p, (1, 0, 0), -.12 * math.sin(2 * math.pi * phase)) @ rotation
            elif p.name.endswith("RightArm"):
                rotation = world_axis_delta(p, (1, 0, 0), .12 * math.sin(2 * math.pi * phase)) @ rotation
            p.rotation_quaternion = rotation
            p.keyframe_insert("rotation_quaternion", frame=f, group=p.name)

    # Bake the IK into the two leg chains so the exported GLB needs no constraints.
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.nla.bake(frame_start=START, frame_end=END, step=1,
                     only_selected=False, visual_keying=True,
                     clear_constraints=True, use_current_action=True,
                     bake_types={"POSE"})
    for obj in targets.values():
        bpy.data.objects.remove(obj, do_unlink=True)
    for action in list(bpy.data.actions):
        if action.name.endswith("AnkleIKAction"):
            bpy.data.actions.remove(action)
    # Keep the feet close to level by cancelling inherited shin rotation.
    for f in range(START, END + 1):
        scene.frame_set(f)
        bpy.context.view_layer.update()
        for side in ("Left", "Right"):
            p = bone(arm, side + "Foot")
            p.rotation_mode = "QUATERNION"
            p.matrix = Matrix.Translation(p.matrix.translation) @ p.bone.matrix_local.to_quaternion().to_matrix().to_4x4()
            p.keyframe_insert("rotation_quaternion", frame=f, group=p.name)
    set_linear(walk)
    arm.animation_data.action = walk
    arm.animation_data.action_slot = walk.slots[0]
    candidate = [sample(arm, walk, f) for f in range(START, END + 1)]
    # The original action was renamed only for measurement; remove it from output.
    bpy.data.actions.remove(original)
    print("ACTIONS", [a.name for a in bpy.data.actions])
    assert {a.name for a in bpy.data.actions} == {"idle", "walk", "run", "swim", "hit", "throw", "jump"}

    def travel(rows, side, indexes):
        key = side + "Foot"
        return abs(rows[indexes[-1]][key][1] - rows[indexes[0]][key][1])

    def knee_flex(row, side):
        hip = Vector(row[side + "UpLeg"])
        knee = Vector(row[side + "Leg"])
        ankle = Vector(row[side + "Foot"])
        return 180 - math.degrees((hip - knee).angle(ankle - knee))

    stance_frames = list(range(0, round((END - START) * STANCE) + 1))
    duration = (END - START) / FPS
    summary = {
        "cycle_seconds": duration,
        "stance_fraction": STANCE,
        "left_foot_stance_travel": travel(candidate, "Left", stance_frames),
        "original_left_foot_same_interval": travel(baseline, "Left", stance_frames),
        "left_foot_stance_speed_at_1x": travel(candidate, "Left", stance_frames) / (len(stance_frames) - 1) * FPS,
        "left_foot_stance_speed_at_1_7x": travel(candidate, "Left", stance_frames) / (len(stance_frames) - 1) * FPS * 1.7,
        "foot_z_range": [min(row["LeftFoot"][2] for row in candidate), max(row["LeftFoot"][2] for row in candidate)],
        "knee_z_range": [min(row["LeftLeg"][2] for row in candidate), max(row["LeftLeg"][2] for row in candidate)],
        "knee_flex_degrees": {
            side: [round(min(knee_flex(row, side) for row in candidate), 1),
                   round(max(knee_flex(row, side) for row in candidate), 1)]
            for side in ("Left", "Right")
        },
        "original_knee_flex_degrees": {
            side: [round(min(knee_flex(row, side) for row in baseline), 1),
                   round(max(knee_flex(row, side) for row in baseline), 1)]
            for side in ("Left", "Right")
        },
        "stance_ankle_height_range": [
            min(candidate[f]["LeftFoot"][2] for f in stance_frames),
            max(candidate[f]["LeftFoot"][2] for f in stance_frames),
        ],
        "max_hand_displacement_from_original": max(
            (Vector(candidate[f][side + "Hand"]) - Vector(baseline[f][side + "Hand"])).length
            for f in range(len(candidate)) for side in ("Left", "Right")
        ),
    }
    print("WALK_METRICS", json.dumps(summary, sort_keys=True))
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "hero-walk-candidate.blend"))
    bpy.ops.export_scene.gltf(filepath=str(OUT / "hero-walk-candidate.glb"),
                              export_format="GLB", export_animations=True,
                              export_skins=True, export_all_influences=False)
    # A standalone skeletal clip can be loaded with Three.js and retargeted by
    # the shared bone names; it carries no mesh or texture payload.
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    other_actions = [action for action in bpy.data.actions if action != walk]
    for action in other_actions:
        bpy.data.actions.remove(action, do_unlink=True)
    bpy.ops.export_scene.gltf(filepath=str(OUT / "hero-walk-clip.glb"),
                              export_format="GLB", use_selection=True,
                              export_animations=True, export_skins=False)
    # Render only after saving/exporting; preview fixtures never enter the asset.
    camera_data = bpy.data.cameras.new("PreviewCamera")
    camera = bpy.data.objects.new("PreviewCamera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = (2.5, -3.8, 1.7)
    direction = Vector((0, 0, .88)) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 2.35
    scene.camera = camera
    light_data = bpy.data.lights.new("PreviewKey", "AREA")
    light = bpy.data.objects.new("PreviewKey", light_data)
    scene.collection.objects.link(light)
    light.location = (1.7, -2.0, 3.5)
    light_data.energy = 600
    light_data.shape = "DISK"
    light_data.size = 4
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.world = bpy.data.worlds.new("PreviewWorld")
    scene.world.color = (.12, .16, .19)
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, 0))
    ground = bpy.context.object
    ground.name = "PreviewGround"
    ground_mat = bpy.data.materials.new("PreviewGroundMaterial")
    ground_mat.diffuse_color = (.14, .18, .19, 1)
    ground.data.materials.append(ground_mat)
    candidate_objects = [o for o in bpy.data.objects if o.type in {"ARMATURE", "MESH"} and o != ground]
    with tempfile.TemporaryDirectory(prefix="hero-walk-") as temp:
        paths = []
        frames = (0, 3, 6, 9, 11, 14, 17, 20)
        for label in ("candidate", "original"):
            if label == "original":
                for obj in candidate_objects:
                    obj.hide_render = True
                previous = set(bpy.data.objects)
                bpy.ops.import_scene.gltf(filepath=str(SOURCE))
                imported = set(bpy.data.objects) - previous
                original_arm = next(o for o in imported if o.type == "ARMATURE")
                original_walk = next(a for a in bpy.data.actions if a.name.startswith("walk."))
                original_arm.animation_data.action = original_walk
                original_arm.animation_data.action_slot = original_walk.slots[0]
            for f in frames:
                scene.frame_set(f)
                path = Path(temp) / f"{label}-{f:02d}.png"
                scene.render.filepath = str(path)
                bpy.ops.render.render(write_still=True)
                paths.append(str(path))
        compose = """from PIL import Image, ImageDraw, ImageFont
import sys
images = [Image.open(p).convert('RGB') for p in sys.argv[2:]]
out = Image.new('RGB', (2048, 2160), '#252a30')
draw = ImageDraw.Draw(out)
font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 21)
order = list(range(4)) + list(range(8, 12)) + list(range(4, 8)) + list(range(12, 16))
for cell, i in enumerate(order):
    img = images[i]
    x, y = (cell % 4) * 512, (cell // 4) * 540
    out.paste(img, (x, y + 28))
    draw.text((x + 12, y + 3), ('KANDYDAT' if i < 8 else 'ORYGINAŁ') + '  ' + str((0,3,6,9,11,14,17,20)[i % 8]), fill='white', font=font)
out.save(sys.argv[1])
"""
        subprocess.run(["python3", "-c", compose, str(OUT / "hero-walk-preview.png"), *paths], check=True)


if __name__ == "__main__":
    main()
