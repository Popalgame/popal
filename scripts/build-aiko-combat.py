"""Author a right-hand hammer chop and right-hand throw for Aiko's chibi rig.

Run: /Applications/Blender.app/Contents/MacOS/Blender -b --python scripts/build-aiko-combat.py
Exports site/assets/models/hero-aiko-combat.glb holding the 22-bone skeleton and
two rotation+location clips: hammer_hit (right hand, overhead chop) and
throw_right. Starts and ends at the rest pose, matching the runtime validation in
imported-hero.js (same track set as the model's idle clip).
"""

import json
import math
from pathlib import Path

import bpy
from mathutils import Quaternion, Vector


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "site/assets/models/hero-aiko.glb"
MODEL = ROOT / "site/assets/models/hero-aiko-combat.glb"
BLEND = ROOT / "docs/assets/hero-aiko-combat.blend"
REPORT = ROOT / "docs/assets/hero-aiko-combat-report.json"
FPS = 96
END = 72

# World-axis poses in Blender (+X = character left, -Y = forward), XYZ euler radians.
# hammer_hit: wind-up with both shoulders back, overhead two-handed-feel chop with
# the RIGHT arm, follow-through down-left, return to rest.
HAMMER_POSES = [
    (0, {}),
    (9, {"Spine": (0, 0, .04), "Spine2": (0, 0, .10),
         "RightShoulder": (0, .08, -.04), "RightArm": (0, -.16, -.23),
         "RightForeArm": (0, -.10, -.10), "RightHand": (0, -.12, 0),
         "LeftArm": (0, .10, -.15)}),
    (20, {"Spine": (0, 0, .075), "Spine2": (0, 0, .18),
          "RightShoulder": (0, .15, .09), "RightArm": (0, -.75, .55),
          "RightForeArm": (0, -.48, .16), "RightHand": (0, -.40, .10)}),
    (28, {"Spine": (0, .06, -.015), "Spine2": (0, .12, -.10),
          "RightShoulder": (0, .08, .20), "RightArm": (0, -1.12, 1.35),
          "RightForeArm": (0, -.58, .34), "RightHand": (0, -.55, .18)}),
    (37, {"Spine": (0, -.05, -.07), "Spine2": (0, -.10, -.16),
          "RightShoulder": (0, -.02, .16), "RightArm": (0, -.06, 1.16),
          "RightForeArm": (0, -.20, .38), "RightHand": (0, .25, .14)}),
    (49, {"Spine": (0, 0, -.035), "Spine2": (0, 0, -.08),
          "RightArm": (0, .08, .34), "RightForeArm": (0, -.08, .10), "RightHand": (0, .08, 0)}),
    (72, {}),
]
# throw_right: step-back wind, right arm whips forward to release the pal sphere.
THROW_POSES = [
    (0, {}),
    (12, {"Spine": (0, 0, -.035), "Spine2": (0, 0, -.11),
          "RightShoulder": (0, .08, .05), "RightArm": (0, .52, .48),
          "RightForeArm": (0, .34, .18), "RightHand": (0, .16, 0)}),
    (23, {"Spine": (0, 0, -.07), "Spine2": (0, 0, -.17),
          "RightShoulder": (0, .14, .10), "RightArm": (0, .75, .72),
          "RightForeArm": (0, .56, .22), "RightHand": (0, .32, 0)}),
    (31, {"Spine": (0, .04, .04), "Spine2": (0, .08, .12),
          "RightShoulder": (0, .08, -.10), "RightArm": (0, 1.15, -.58),
          "RightForeArm": (0, -.08, -.16), "RightHand": (0, -.18, 0)}),
    (44, {"Spine": (0, .03, .03), "Spine2": (0, .06, .06),
          "RightArm": (0, -.05, -.22), "RightForeArm": (0, -.04, -.08)}),
    (72, {}),
]


def smooth(t):
    return t * t * (3 - 2 * t)


def local_world_rotation(pose_bone, axis, angle):
    rest = pose_bone.bone.matrix_local.to_3x3()
    return (rest.inverted() @ Quaternion(Vector(axis), angle).to_matrix() @ rest).to_quaternion()


def pose(arm, frame, base, poses):
    before = max(i for i, (at, _) in enumerate(poses) if at <= frame)
    after = min(before + 1, len(poses) - 1)
    lo, first = poses[before]
    hi, second = poses[after]
    t = smooth((frame - lo) / (hi - lo)) if hi != lo else 0
    for p in arm.pose.bones:
        short = p.name.split(":")[-1]
        a = first.get(short, (0, 0, 0))
        b = second.get(short, (0, 0, 0))
        angles = [a[i] + (b[i] - a[i]) * t for i in range(3)]
        p.rotation_mode = "QUATERNION"
        q = base[p.name].copy()
        for axis, angle in zip(((1, 0, 0), (0, 1, 0), (0, 0, 1)), angles):
            q = local_world_rotation(p, axis, angle) @ q
        p.rotation_quaternion = q
        p.location = (0, 0, 0)
        p.scale = (1, 1, 1)
    bpy.context.view_layer.update()


def set_linear(action):
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for point in curve.keyframe_points:
                        point.interpolation = "LINEAR"


def report_motion(arm):
    scene = bpy.context.scene
    hand = arm.pose.bones["mixamorig:RightHand"]
    left = arm.pose.bones["mixamorig:LeftHand"]
    head = arm.pose.bones["mixamorig:Head"]
    rows = []
    for frame in range(END + 1):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        position = lambda p: arm.matrix_world @ p.matrix.translation
        h = position(hand)
        rows.append({"frame": frame, "hand": list(h), "leftHand": list(position(left)),
                     "headDistance": (h - position(head)).length})
    hand_arc = sum((Vector(rows[i]["hand"]) - Vector(rows[i - 1]["hand"])).length for i in range(1, len(rows)))
    left_arc = sum((Vector(rows[i]["leftHand"]) - Vector(rows[i - 1]["leftHand"])).length for i in range(1, len(rows)))
    return {"rightHandPathMeters": round(hand_arc, 4),
            "rightHandExcursionMeters": round(max((Vector(r["hand"]) - Vector(rows[0]["hand"])).length for r in rows), 4),
            "leftHandExcursionMeters": round(max((Vector(r["leftHand"]) - Vector(rows[0]["leftHand"])).length for r in rows), 4),
            "minimumRightHandToHeadMeters": round(min(r["headDistance"] for r in rows), 4)}


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    arm = bpy.data.objects["AikoRig"]
    scene = bpy.context.scene
    scene.render.fps = FPS
    idle = bpy.data.actions["idle"]
    arm.animation_data.action = idle
    arm.animation_data.action_slot = idle.slots[0]
    scene.frame_set(0)
    base = {p.name: p.rotation_quaternion.copy() for p in arm.pose.bones}
    for old in list(bpy.data.actions):
        bpy.data.actions.remove(old)
    clips = {}
    for name, poses in (("hammer_hit", HAMMER_POSES), ("throw_right", THROW_POSES)):
        action = bpy.data.actions.new(name)
        action.use_fake_user = True
        slot = action.slots.new("OBJECT", arm.name)
        arm.animation_data.action = action
        arm.animation_data.action_slot = slot
        for frame in range(END + 1):
            pose(arm, frame, base, poses)
            for p in arm.pose.bones:
                p.keyframe_insert("location", frame=frame, group=p.name)
                p.keyframe_insert("rotation_quaternion", frame=frame, group=p.name)
                p.keyframe_insert("scale", frame=frame, group=p.name)
        set_linear(action)
        clips[name] = {"action": action, "poses": poses, "motion": report_motion(arm)}
    hit = clips["hammer_hit"]["motion"]
    assert len(arm.pose.bones) == 22
    assert hit["rightHandExcursionMeters"] > .2, "hammer hand must swing"
    assert hit["minimumRightHandToHeadMeters"] > .12, "hammer must not pass through the head"
    assert clips["throw_right"]["motion"]["rightHandExcursionMeters"] > .15
    report = {"source": str(SOURCE.relative_to(ROOT)), "fps": FPS,
              "clips": {name: {"frames": END, "durationSeconds": END / FPS,
                               "keyPoses": [f for f, _ in item["poses"]],
                               "bones": len(arm.pose.bones), "tracks": len(arm.pose.bones) * 3,
                               "motion": item["motion"]} for name, item in clips.items()}}
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.gltf(filepath=str(MODEL), export_format="GLB", use_selection=True,
                              export_animations=True, export_skins=False, export_extras=True)
    print("COMBAT_REPORT", json.dumps(report))
    print("Wrote", MODEL)


if __name__ == "__main__":
    main()
