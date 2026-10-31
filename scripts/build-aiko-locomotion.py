"""Build measured in-place walk, jog and run clips for Aiko's chibi rig.

Run: /Applications/Blender.app/Contents/MacOS/Blender -b --python scripts/build-aiko-locomotion.py
Imports site/assets/models/hero-aiko.glb read-only and exports
site/assets/models/hero-aiko-locomotion.glb with scene extras
("locomotion": {version: 1, profiles: {...}}), the same contract the runtime
validates in site/src/modules/imported-hero.js. Chibi legs are short, so strides
are smaller, stance longer and the hip drop deeper than the adult hero's.
"""

import json
import math
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "site/assets/models/hero-aiko.glb"
MOBILE = ROOT / "site/assets/models/hero-aiko-mobile.glb"
MODEL = ROOT / "site/assets/models/hero-aiko-locomotion.glb"
REPORT = ROOT / "docs/assets/hero-aiko-locomotion-report.json"
FPS = 96
# Rig metrics of hero-aiko.glb: thigh .25, shin .20, hip rest z .52, ankle rest z .07.
ANKLE_Z = .07
PROFILES = {
    "walk": dict(frames=72, stride=.32, stance=.56, lift=.058, bob=.010, hip_drop=.032, pitch=.13, game_speed=1.8,
                 pelvis_yaw=4.0, pelvis_roll=2.5, sway=.016, chest_yaw=4.0, chest_roll=1.0, lean=1.0,
                 arm_left=10.0, arm_right=22.0, elbow_left=17.0, elbow_right=0.0,
                 elbow_var_left=4.0, elbow_var_right=6.0, shoulder=.8, head_bob=.4, hand=-60.0, hand_sway=4.0, pelvis_pitch=1.2),
    "jog": dict(frames=50, stride=.36, stance=.26, lift=.090, bob=.020, hip_drop=.070, pitch=.17, game_speed=5.0,
                pelvis_yaw=6.0, pelvis_roll=3.5, sway=.022, chest_yaw=6.5, chest_roll=1.5, lean=5.0,
                arm_left=12.0, arm_right=35.0, elbow_left=30.0, elbow_right=40.0,
                elbow_var_left=6.0, elbow_var_right=12.0, shoulder=1.2, head_bob=.7, hand=-60.0, hand_sway=6.0, pelvis_pitch=1.8),
    "run": dict(frames=40, stride=.38, stance=.22, lift=.115, bob=.026, hip_drop=.075, pitch=.22, game_speed=8.0,
                pelvis_yaw=8.0, pelvis_roll=4.5, sway=.026, chest_yaw=9.0, chest_roll=2.0, lean=9.0,
                arm_left=15.0, arm_right=45.0, elbow_left=36.0, elbow_right=60.0,
                elbow_var_left=8.0, elbow_var_right=15.0, shoulder=1.6, head_bob=1.0, hand=-60.0, hand_sway=8.0, pelvis_pitch=2.2),
}


def bone(arm, name):
    return arm.pose.bones["mixamorig:" + name]


def smooth(t):
    return t * t * (3 - 2 * t)


def target(phase, profile):
    """Forward is -Y. At phase zero the left heel lands ahead of its hip."""
    phase %= 1.0
    stride, stance = profile["stride"], profile["stance"]
    if phase < stance:
        t = phase / stance
        y = -stride / 2 + stride * t
        z = ANKLE_Z
        pitch = -profile["pitch"] * (1 - smooth(min(1, t * 4)))
        pitch += profile["pitch"] * smooth(max(0, (t - .73) / .27))
    else:
        t = (phase - stance) / (1 - stance)
        y = stride / 2 - stride * smooth(t)
        z = ANKLE_Z + profile["lift"] * math.sin(math.pi * t) ** 1.3
        pitch = .10 * math.sin(2 * math.pi * t)
    return y, z, pitch


def knee_point(hip, ankle, upper, lower):
    axis = ankle - hip
    distance = axis.length
    if distance > upper + lower - .0001:
        raise ValueError(f"Unreachable ankle: {distance:.3f} > {upper + lower - .0001:.3f}")
    forward = Vector((0, -1, 0))
    normal = forward - axis * (forward.dot(axis) / (distance * distance))
    if normal.length < 1e-6:
        normal = Vector((0, 0, 1))
    normal.normalize()
    a = (upper * upper - lower * lower + distance * distance) / (2 * distance)
    height = math.sqrt(max(0.0, upper * upper - a * a))
    return hip + axis * (a / distance) + normal * height


def orient_segment(pose_bone, head, tail):
    rest_vector = pose_bone.bone.tail_local - pose_bone.bone.head_local
    direction = tail - head
    rotation = rest_vector.rotation_difference(direction) @ pose_bone.bone.matrix_local.to_quaternion()
    pose_bone.matrix = Matrix.Translation(head) @ rotation.to_matrix().to_4x4()


def world_rotation(pose_bone, axis, angle):
    rest = pose_bone.bone.matrix_local.to_3x3()
    delta = (rest.inverted() @ Quaternion(Vector(axis), angle).to_matrix() @ rest).to_quaternion()
    pose_bone.rotation_quaternion = delta @ pose_bone.rotation_quaternion


def pose(arm, phase, profile, base):
    for p in arm.pose.bones:
        p.rotation_mode = "QUATERNION"
        p.location = (0, 0, 0)
        p.rotation_quaternion = base[p.name].copy()
        p.scale = (1, 1, 1)
    hips = bone(arm, "Hips")
    cycle = 2 * math.pi * phase
    pelvis_yaw = -math.radians(profile["pelvis_yaw"]) * math.cos(cycle)
    pelvis_roll = -math.radians(profile["pelvis_roll"]) * math.sin(cycle)
    world_rotation(hips, (0, 0, 1), pelvis_yaw)
    world_rotation(hips, (0, 1, 0), pelvis_roll)
    world_rotation(hips, (1, 0, 0), math.radians(profile["pelvis_pitch"]) * math.cos(2 * cycle))
    vertical = -profile["hip_drop"] - profile["bob"] * math.cos(2 * cycle)
    sway = profile["sway"] * math.sin(cycle)
    hips.location = hips.bone.matrix_local.to_3x3().inverted() @ Vector((sway, 0, vertical))
    bpy.context.view_layer.update()
    hips_pose = hips.matrix.copy()
    hips_rest_inv = hips.bone.matrix_local.inverted()
    for side, offset in (("Left", 0), ("Right", .5)):
        up, shin = bone(arm, side + "UpLeg"), bone(arm, side + "Leg")
        foot, toe = bone(arm, side + "Foot"), bone(arm, side + "ToeBase")
        hip = hips_pose @ (hips_rest_inv @ up.bone.head_local)
        y, z, pitch = target(phase + offset, profile)
        ankle = Vector((shin.bone.head_local.x, y, z))
        upper = (up.bone.tail_local - up.bone.head_local).length
        lower = (shin.bone.tail_local - shin.bone.head_local).length
        # Chibi legs are short: clamp the ankle target to 98% of full leg reach so
        # the knee nearly straightens instead of the IK target becoming unreachable.
        reach = .98 * (upper + lower)
        direction = ankle - hip
        if direction.length > reach:
            ankle = hip + direction.normalized() * reach
        knee = knee_point(hip, ankle, upper, lower)
        orient_segment(up, hip, knee)
        bpy.context.view_layer.update()
        orient_segment(shin, knee, ankle)
        bpy.context.view_layer.update()
        foot.matrix = Matrix.Translation(ankle) @ (Quaternion((1, 0, 0), pitch) @ foot.bone.matrix_local.to_quaternion()).to_matrix().to_4x4()
        toe.rotation_quaternion.identity()
        if (phase + offset) % 1 < profile["stance"]:
            t = ((phase + offset) % 1) / profile["stance"]
            if t > .75:
                world_rotation(toe, (1, 0, 0), -.14 * smooth((t - .75) / .25))
    spine = (("Spine", .35), ("Spine1", .35), ("Spine2", .30))
    chest_yaw = math.radians(profile["chest_yaw"]) * math.cos(cycle + .15)
    chest_roll = math.radians(profile["chest_roll"]) * math.sin(cycle + .1)
    lean = math.radians(profile["lean"])
    for name, weight in spine:
        world_rotation(bone(arm, name), (0, 0, 1), (chest_yaw - pelvis_yaw) * weight)
        world_rotation(bone(arm, name), (0, 1, 0), (chest_roll - pelvis_roll) * weight)
        world_rotation(bone(arm, name), (1, 0, 0), lean * weight)
    nod = -0.8 * lean + math.radians(profile["head_bob"]) * math.cos(2 * cycle)
    for name, weight in (("Neck", .35), ("Head", .65)):
        world_rotation(bone(arm, name), (0, 0, 1), -chest_yaw * weight)
        world_rotation(bone(arm, name), (0, 1, 0), -chest_roll * weight)
        world_rotation(bone(arm, name), (1, 0, 0), nod * weight)
    for side, sign in (("Left", 1), ("Right", -1)):
        p = bone(arm, side + "Arm")
        p.rotation_quaternion = Quaternion((1, 0, 0), math.radians(-70 if sign > 0 else -68))
        world_rotation(p, (1, 0, 0), sign * math.radians(profile["arm_left" if sign > 0 else "arm_right"]) * math.cos(cycle - .35))
        world_rotation(p, (0, 0, 1), sign * .02 * math.sin(cycle - .35))
        fore = bone(arm, side + "ForeArm")
        swing = .5 - sign * .5 * math.cos(cycle - .35)
        extra = profile["elbow_left" if sign > 0 else "elbow_right"] + profile["elbow_var_left" if sign > 0 else "elbow_var_right"] * swing
        fore.rotation_quaternion = fore.rotation_quaternion @ Quaternion((0, 0, 1), math.radians(extra) * (-1 if sign > 0 else 1))
        if sign < 0:
            # Aiko carries the hammer in the RIGHT hand; dangle the wrist.
            hand = bone(arm, side + "Hand")
            trail = profile["hand"] + profile["hand_sway"] * math.sin(cycle - 1.0)
            hand.rotation_quaternion = Quaternion((1, 0, 0), math.radians(trail)) @ hand.rotation_quaternion
        world_rotation(bone(arm, side + "Shoulder"), (0, 0, 1), sign * math.radians(profile["shoulder"]) * math.cos(cycle))
    bpy.context.view_layer.update()


def measure(arm, profile, action):
    arm.animation_data.action = action
    arm.animation_data.action_slot = action.slots[0]
    rows = []
    for frame in range(profile["frames"]):
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        row = {}
        for side in ("Left", "Right"):
            row[side] = [tuple((arm.matrix_world @ bone(arm, side + name).matrix).translation)
                         for name in ("UpLeg", "Leg", "Foot", "ToeBase")]
        rows.append(row)
    min_forward_knee = 1e9
    max_cross = 0
    max_length_error = 0
    min_foot_z = 1e9
    min_toe_z = 1e9
    flexes = []
    for row in rows:
        for side, sign in (("Left", 1), ("Right", -1)):
            hip, knee, ankle, toe = (Vector(p) for p in row[side])
            min_forward_knee = min(min_forward_knee, hip.y - knee.y)
            max_cross = max(max_cross, max(0, -sign * ankle.x))
            min_foot_z = min(min_foot_z, ankle.z)
            min_toe_z = min(min_toe_z, toe.z)
            expected_upper = (bone(arm, side + "UpLeg").bone.tail_local - bone(arm, side + "UpLeg").bone.head_local).length
            expected_lower = (bone(arm, side + "Leg").bone.tail_local - bone(arm, side + "Leg").bone.head_local).length
            max_length_error = max(max_length_error, abs((knee - hip).length - expected_upper), abs((ankle - knee).length - expected_lower))
            flexes.append(180 - math.degrees((hip - knee).angle(ankle - knee)))
    cycle = profile["frames"] / FPS
    speed = profile["stride"] / (cycle * profile["stance"])
    return dict(cycleSeconds=cycle, strideMeters=speed * cycle, footExcursionMeters=profile["stride"],
                speed=speed, nominalSpeed=speed, gameTargetSpeed=profile["game_speed"],
                stance=profile["stance"], minForwardKnee=min_forward_knee,
                maxLaneCross=max_cross, maxBoneLengthError=max_length_error,
                minFootJointZ=min_foot_z, minToeJointZ=min_toe_z,
                kneeFlexDegrees=[min(flexes), max(flexes)])


def set_linear(action):
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for point in curve.keyframe_points:
                        point.interpolation = "LINEAR"


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    arm = bpy.data.objects["AikoRig"]
    scene = bpy.context.scene
    scene.render.fps = FPS
    source_pose = bpy.data.actions["walk"]
    arm.animation_data.action = source_pose
    arm.animation_data.action_slot = source_pose.slots[0]
    scene.frame_set(0)
    base = {p.name: p.rotation_quaternion.copy() for p in arm.pose.bones}
    for a in list(bpy.data.actions):
        bpy.data.actions.remove(a)
    actions, metrics = {}, {}
    for name, profile in PROFILES.items():
        action = bpy.data.actions.new(name)
        action.use_fake_user = True
        slot = action.slots.new("OBJECT", arm.name)
        actions[name] = action
        arm.animation_data.action = action
        arm.animation_data.action_slot = slot
        for frame in range(profile["frames"] + 1):
            phase = frame / profile["frames"]
            pose(arm, phase, profile, base)
            for p in arm.pose.bones:
                p.keyframe_insert("location", frame=frame, group=p.name)
                p.keyframe_insert("rotation_quaternion", frame=frame, group=p.name)
        set_linear(action)
        metrics[name] = measure(arm, profile, action)
        assert metrics[name]["maxLaneCross"] < 1e-4
        assert metrics[name]["maxBoneLengthError"] < .003
        assert metrics[name]["minForwardKnee"] > -.15
        assert metrics[name]["minFootJointZ"] > ANKLE_Z - .005, f"{name} ankle dips below rest ground: {metrics[name]['minFootJointZ']}"
        assert metrics[name]["minToeJointZ"] > .005, f"{name} toe clips the floor: {metrics[name]['minToeJointZ']}"
        print("PROFILE", name, json.dumps(metrics[name]))
    scene["locomotion"] = {"version": 1, "profiles": metrics}
    REPORT.write_text(json.dumps({"source": str(SOURCE.relative_to(ROOT)), "fps": FPS, "profiles": metrics}, indent=2) + "\n")
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.gltf(filepath=str(MODEL), export_format="GLB", use_selection=True,
                              export_animations=True, export_skins=False, export_extras=True)
    print("Wrote", MODEL)


if __name__ == "__main__":
    main()
