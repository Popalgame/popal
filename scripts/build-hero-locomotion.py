"""Build measured in-place walk, jog and run clips on the shipped HeroRig.

Run: /Applications/Blender.app/Contents/MacOS/Blender -b --python scripts/build-hero-locomotion.py
The GLB contains only the original armature and three actions. Preview objects
are created after export and never enter the animation asset.
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
MODEL = ROOT / "site/assets/models/hero-locomotion.glb"
BLEND = ROOT / "docs/assets/hero-locomotion.blend"
PREVIEW = ROOT / "docs/assets/hero-locomotion-preview.png"
REPORT = ROOT / "docs/assets/hero-locomotion-report.json"
FPS = 96
PROFILES = {
    "walk": dict(frames=72, stride=.36, stance=.52, lift=.070, bob=.012, hip_drop=.025, arm=.10, pitch=.13, game_speed=1.8),
    "jog": dict(frames=50, stride=.52, stance=.20, lift=.125, bob=.027, hip_drop=.100, arm=.23, pitch=.17, game_speed=5.0),
    "run": dict(frames=40, stride=.55, stance=.165, lift=.160, bob=.041, hip_drop=.140, arm=.34, pitch=.22, game_speed=8.0),
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
        z = .099
        pitch = -profile["pitch"] * (1 - smooth(min(1, t * 4)))
        pitch += profile["pitch"] * smooth(max(0, (t - .73) / .27))
    else:
        t = (phase - stance) / (1 - stance)
        y = stride / 2 - stride * smooth(t)
        z = .099 + profile["lift"] * math.sin(math.pi * t) ** 1.3
        pitch = .10 * math.sin(2 * math.pi * t)
    return y, z, pitch


def knee_point(hip, ankle, upper, lower):
    """Exact two-bone sagittal solve, choosing the forward-bending knee."""
    dy, dz = ankle.y - hip.y, ankle.z - hip.z
    distance = math.hypot(dy, dz)
    if distance > upper + lower - .0001:
        raise ValueError(f"Unreachable ankle: {distance:.3f} > {upper + lower:.3f}")
    a = (upper * upper - lower * lower + distance * distance) / (2 * distance)
    height = math.sqrt(max(0.0, upper * upper - a * a))
    # With a downward leg the negative-Y perpendicular is the anatomical bend.
    ky = hip.y + a * dy / distance + height * dz / distance
    kz = hip.z + a * dz / distance - height * dy / distance
    return Vector((hip.x + (ankle.x - hip.x) * a / distance, ky, kz))


def orient_segment(pose_bone, head, tail):
    rest = pose_bone.bone
    rest_vector = rest.tail_local - rest.head_local
    direction = tail - head
    rotation = rest_vector.rotation_difference(direction) @ rest.matrix_local.to_quaternion()
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
    # Both legs remain within reach at heel strike. Two vertical pulses per cycle.
    vertical = -profile["hip_drop"] - profile["bob"] * math.cos(4 * math.pi * phase)
    hips.location = hips.bone.matrix_local.to_3x3().inverted() @ Vector((0, 0, vertical))
    bpy.context.view_layer.update()
    for side, offset in (("Left", 0), ("Right", .5)):
        up, shin = bone(arm, side + "UpLeg"), bone(arm, side + "Leg")
        foot, toe = bone(arm, side + "Foot"), bone(arm, side + "ToeBase")
        rest_hip = up.bone.head_local
        hip = Vector((rest_hip.x, 0, rest_hip.z + vertical))
        y, z, pitch = target(phase + offset, profile)
        ankle = Vector((shin.bone.head_local.x, y, z))
        upper = (up.bone.tail_local - up.bone.head_local).length
        lower = (shin.bone.tail_local - shin.bone.head_local).length
        knee = knee_point(hip, ankle, upper, lower)
        orient_segment(up, hip, knee)
        bpy.context.view_layer.update()
        orient_segment(shin, knee, ankle)
        bpy.context.view_layer.update()
        # Cancel inherited leg pitch, then apply a small heel-to-toe roll.
        foot.matrix = Matrix.Translation(ankle) @ (Quaternion((1, 0, 0), pitch) @ foot.bone.matrix_local.to_quaternion()).to_matrix().to_4x4()
        toe.rotation_quaternion.identity()
        if (phase + offset) % 1 < profile["stance"]:
            t = ((phase + offset) % 1) / profile["stance"]
            if t > .75:
                world_rotation(toe, (1, 0, 0), -.14 * smooth((t - .75) / .25))
    # Upper body uses the neutral source pose, with restrained counter motion.
    for side, sign in (("Left", 1), ("Right", -1)):
        p = bone(arm, side + "Arm")
        world_rotation(p, (1, 0, 0), sign * profile["arm"] * math.sin(2 * math.pi * phase))
        world_rotation(p, (0, 0, 1), sign * .015 * math.sin(2 * math.pi * phase))
    if profile["game_speed"] >= 5:
        world_rotation(bone(arm, "Spine"), (1, 0, 0), .045 if profile["game_speed"] < 8 else .07)
    world_rotation(bone(arm, "Spine"), (0, 0, 1), .025 * math.sin(2 * math.pi * phase))
    world_rotation(bone(arm, "Spine2"), (0, 0, 1), -.035 * math.sin(2 * math.pi * phase))
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
    flexes = []
    for row in rows:
        for side, sign in (("Left", 1), ("Right", -1)):
            hip, knee, ankle, toe = (Vector(p) for p in row[side])
            min_forward_knee = min(min_forward_knee, hip.y - knee.y)
            max_cross = max(max_cross, max(0, -sign * ankle.x))
            min_foot_z = min(min_foot_z, ankle.z, toe.z)
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
                minFootJointZ=min_foot_z, kneeFlexDegrees=[min(flexes), max(flexes)])


def set_linear(action):
    # Dense 96 fps keys are sampled as authored, without Bezier overshoot.
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for point in curve.keyframe_points:
                        point.interpolation = "LINEAR"


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    arm = bpy.data.objects["HeroRig"]
    scene = bpy.context.scene
    scene.render.fps = FPS
    # The authored source walk has a relaxed one-handed carry pose.
    source_pose = bpy.data.actions["walk"]
    arm.animation_data.action = source_pose
    arm.animation_data.action_slot = source_pose.slots[0]
    scene.frame_set(0)
    base = {p.name: p.rotation_quaternion.copy() for p in arm.pose.bones}
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    actions = {}
    metrics = {}
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
        print("PROFILE", name, json.dumps(metrics[name]))
    scene["locomotion"] = {"version": 1, "profiles": metrics}
    REPORT.write_text(json.dumps({"source": str(SOURCE.relative_to(ROOT)), "fps": FPS, "profiles": metrics}, indent=2) + "\n")
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.gltf(filepath=str(MODEL), export_format="GLB", use_selection=True,
                              export_animations=True, export_skins=False, export_extras=True)
    # Low-cost contact sheet with the original skinned mesh and two camera angles.
    for obj in bpy.data.objects:
        if obj.type == "MESH":
            obj.select_set(False)
    cam_data = bpy.data.cameras.new("PreviewCamera")
    camera = bpy.data.objects.new("PreviewCamera", cam_data)
    scene.collection.objects.link(camera)
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 2.05
    scene.camera = camera
    light_data = bpy.data.lights.new("PreviewLight", "AREA")
    light = bpy.data.objects.new("PreviewLight", light_data)
    scene.collection.objects.link(light)
    light.location = (1, -2, 4)
    light_data.energy = 900
    light_data.size = 4
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x, scene.render.resolution_y = 320, 320
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.world = bpy.data.worlds.new("PreviewWorld")
    scene.world.color = (.18, .20, .24)
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.012))
    ground = bpy.context.object
    ground.name = "PreviewGround"
    ground_mat = bpy.data.materials.new("PreviewGroundMaterial")
    ground_mat.diffuse_color = (.28, .31, .34, 1)
    ground.data.materials.append(ground_mat)
    with tempfile.TemporaryDirectory(prefix="hero-gaits-") as folder:
        images = []
        for name, profile in PROFILES.items():
            arm.animation_data.action = actions[name]
            arm.animation_data.action_slot = actions[name].slots[0]
            for view, location in (("front", (0, -3, 1.1)), ("side", (3, 0, 1.1))):
                camera.location = location
                camera.rotation_euler = (Vector((0, 0, .9)) - camera.location).to_track_quat("-Z", "Y").to_euler()
                for index in range(8):
                    scene.frame_set(round(index * profile["frames"] / 8))
                    path = Path(folder) / f"{name}-{view}-{index}.png"
                    scene.render.filepath = str(path)
                    bpy.ops.render.render(write_still=True)
                    images.append(str(path))
        compose = '''from PIL import Image, ImageDraw
import sys
items = [Image.open(p).convert("RGB") for p in sys.argv[2:]]
out = Image.new("RGB", (8*320, 6*348), "#20252c")
draw = ImageDraw.Draw(out)
for n, item in enumerate(items):
    x, y = (n % 8)*320, (n//8)*348
    out.paste(item, (x, y+28))
    draw.text((x+8,y+6), ["walk","jog","run"][n//16]+" / "+["front","side"][(n//8)%2]+" / "+str(n%8), fill="white")
out.save(sys.argv[1])'''
        subprocess.run(["python3", "-c", compose, str(PREVIEW), *images], check=True)


if __name__ == "__main__":
    main()
