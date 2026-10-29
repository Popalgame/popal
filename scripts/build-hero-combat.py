"""Author a left-hand sword slash and right-hand throw on the shipped rig.

Run: /Applications/Blender.app/Contents/MacOS/Blender -b --python scripts/build-hero-combat.py
The exported GLB holds the original 22-bone skeleton and two rotation-only clips.
"""

import json
import math
import subprocess
import tempfile
from pathlib import Path

import bpy
from mathutils import Quaternion, Vector


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "site/assets/models/hero-rigged.glb"
MOBILE = ROOT / "site/assets/models/hero-mobile.glb"
MODEL = ROOT / "site/assets/models/hero-combat.glb"
BLEND = ROOT / "docs/assets/hero-combat.blend"
PREVIEW = ROOT / "docs/assets/hero-combat-preview.png"
REPORT = ROOT / "docs/assets/hero-combat-report.json"
FPS = 96
END = 72

# Anatomical/world axes in Blender: +X is character left, -Y is forward.
# Each pose adds a restrained torso turn to a raised shoulder, bent elbow and
# wrist-led diagonal cut. Angles are radians about world X, Y and Z, in order.
POSES = [
    (0, {}),
    (9, {"Spine": (0, 0, -.035), "Spine2": (0, 0, -.10),
         "LeftShoulder": (0, -.08, .04), "LeftArm": (0, .16, .23),
         "LeftForeArm": (0, -.10, .10), "LeftHand": (0, -.12, 0)}),
    (20, {"Spine": (0, 0, -.075), "Spine2": (0, 0, -.18),
          "LeftShoulder": (0, -.15, -.09), "LeftArm": (0, -.75, -.55),
          "LeftForeArm": (0, -.48, -.16), "LeftHand": (0, -.40, -.10)}),
    (28, {"Spine": (0, 0, .015), "Spine2": (0, 0, .10),
          "LeftShoulder": (0, -.08, -.20), "LeftArm": (0, -1.12, -.95),
          "LeftForeArm": (0, -.58, -.34), "LeftHand": (0, -.55, -.18)}),
    (37, {"Spine": (0, 0, .07), "Spine2": (0, 0, .16),
          "LeftShoulder": (0, .02, -.16), "LeftArm": (0, -.06, -1.16),
          "LeftForeArm": (0, -.20, -.38), "LeftHand": (0, .25, -.14)}),
    (49, {"Spine": (0, 0, .035), "Spine2": (0, 0, .08),
          "LeftShoulder": (0, 0, -.05), "LeftArm": (0, .08, -.34),
          "LeftForeArm": (0, -.08, -.10), "LeftHand": (0, .08, 0)}),
    (72, {}),
]
THROW_POSES = [
    (0, {}),
    (12, {"Spine": (0, 0, .035), "Spine2": (0, 0, .11),
          "RightShoulder": (0, -.08, -.05), "RightArm": (0, -.52, -.48),
          "RightForeArm": (0, -.34, -.18), "RightHand": (0, -.16, 0)}),
    (23, {"Spine": (0, 0, .07), "Spine2": (0, 0, .17),
          "RightShoulder": (0, -.14, -.10), "RightArm": (0, -.75, -.72),
          "RightForeArm": (0, -.56, -.22), "RightHand": (0, -.32, 0)}),
    (31, {"Spine": (0, 0, -.04), "Spine2": (0, 0, -.12),
          "RightShoulder": (0, -.08, .10), "RightArm": (0, -.25, .58),
          "RightForeArm": (0, .08, .16), "RightHand": (0, .18, 0)}),
    (44, {"Spine": (0, 0, -.03), "Spine2": (0, 0, -.06),
          "RightArm": (0, .05, .22), "RightForeArm": (0, .04, .08)}),
    (72, {}),
]


def smooth(t):
    return t * t * (3 - 2 * t)


def local_world_rotation(pose_bone, axis, angle):
    rest = pose_bone.bone.matrix_local.to_3x3()
    return (rest.inverted() @ Quaternion(Vector(axis), angle).to_matrix() @ rest).to_quaternion()


def binding(mesh, bone):
    group = mesh.vertex_groups.get(bone)
    if group is None:
        return {"vertices": 0, "fullWeightVertices": 0, "weightSum": 0}
    count = rigid = 0
    total = 0.0
    for vertex in mesh.data.vertices:
        for item in vertex.groups:
            if item.group == group.index:
                count += 1
                total += item.weight
                rigid += item.weight > .999
    return {"vertices": count, "fullWeightVertices": rigid, "weightSum": round(total, 3)}


def mobile_binding():
    expression = ("import bpy,json; bpy.ops.import_scene.gltf(filepath=" + repr(str(MOBILE)) + "); "
                  "print('MOBILE_BINDING',json.dumps([{'mesh':o.name,'vertices':len(o.data.vertices),"
                  "'leftHand':sum(1 for v in o.data.vertices for g in v.groups "
                  "if o.vertex_groups[g.group].name=='mixamorig:LeftHand' and g.weight>.999)} "
                  "for o in bpy.data.objects if o.type=='MESH' and len(o.data.vertices)>100]))")
    result = subprocess.run([bpy.app.binary_path, "-b", "--python-expr", expression],
                            capture_output=True, text=True, check=True)
    line = next(line for line in result.stdout.splitlines() if line.startswith("MOBILE_BINDING "))
    return json.loads(line.removeprefix("MOBILE_BINDING "))


def pose(arm, frame, base, base_locations, base_scales, poses):
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
        p.location = base_locations[p.name]
        p.scale = base_scales[p.name]
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
    hand = arm.pose.bones["mixamorig:LeftHand"]
    right = arm.pose.bones["mixamorig:RightHand"]
    head = arm.pose.bones["mixamorig:Head"]
    rows = []
    for frame in range(END + 1):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        position = lambda p: arm.matrix_world @ p.matrix.translation
        h = position(hand)
        tip = arm.matrix_world @ hand.matrix @ Vector((.30, 0, 0))
        rows.append({"frame": frame, "hand": list(h), "swordProxyTip": list(tip),
                     "rightHand": list(position(right)), "headDistance": (h - position(head)).length})
    arc = sum((Vector(rows[i]["swordProxyTip"]) - Vector(rows[i - 1]["swordProxyTip"])).length
              for i in range(1, len(rows)))
    hand_arc = sum((Vector(rows[i]["hand"]) - Vector(rows[i - 1]["hand"])).length
                   for i in range(1, len(rows)))
    return {"leftHandPathMeters": round(hand_arc, 4), "swordProxyTipPathMeters": round(arc, 4),
            "leftHandExcursionMeters": round(max((Vector(row["hand"]) - Vector(rows[0]["hand"])).length for row in rows), 4),
            "rightHandExcursionMeters": round(max((Vector(row["rightHand"]) - Vector(rows[0]["rightHand"])).length for row in rows), 4),
            "minimumLeftHandToHeadMeters": round(min(row["headDistance"] for row in rows), 4),
            "samples": [{key: value for key, value in rows[frame].items() if key != "rightHand"}
                        for frame in (0, 9, 20, 28, 37, 49, 72)]}


def render_preview(arm, action):
    scene = bpy.context.scene
    camera_data = bpy.data.cameras.new("CombatPreviewCamera")
    camera = bpy.data.objects.new("CombatPreviewCamera", camera_data)
    scene.collection.objects.link(camera)
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 2.1
    scene.camera = camera
    light_data = bpy.data.lights.new("CombatPreviewLight", "AREA")
    light = bpy.data.objects.new("CombatPreviewLight", light_data)
    scene.collection.objects.link(light)
    light.location = (1, -2, 4)
    light_data.energy = 900
    light_data.size = 4
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = scene.render.resolution_y = 280
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    world = bpy.data.worlds.new("CombatPreviewWorld")
    world.color = (.18, .20, .24)
    scene.world = world
    arm.animation_data.action = action
    arm.animation_data.action_slot = action.slots[0]
    with tempfile.TemporaryDirectory(prefix="hero-combat-") as folder:
        images = []
        for view, location in (("front", (0, -3, 1.1)), ("side", (3, 0, 1.1))):
            camera.location = location
            camera.rotation_euler = (Vector((0, 0, .9)) - camera.location).to_track_quat("-Z", "Y").to_euler()
            for frame in (0, 9, 18, 25, 31, 37, 49, 63):
                scene.frame_set(frame)
                path = Path(folder) / f"{view}-{frame}.png"
                scene.render.filepath = str(path)
                bpy.ops.render.render(write_still=True)
                images.append(str(path))
        compose = '''from PIL import Image, ImageDraw
import sys
images = [Image.open(path).convert("RGB") for path in sys.argv[2:]]
out = Image.new("RGB", (8*280, 2*308), "#20252c")
draw = ImageDraw.Draw(out)
for i, image in enumerate(images):
    x, y = (i%8)*280, (i//8)*308
    out.paste(image, (x, y+28))
    draw.text((x+8,y+7), ("front" if i<8 else "side")+" / "+str((0,9,18,25,31,37,49,63)[i%8]), fill="white")
out.save(sys.argv[1])'''
        subprocess.run(["python3", "-c", compose, str(PREVIEW), *images], check=True)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    arm = bpy.data.objects["HeroRig"]
    mesh = next(o for o in bpy.data.objects if o.type == "MESH" and len(o.data.vertices) > 1000)
    bindings = {"full": binding(mesh, "mixamorig:LeftHand"), "mobile": mobile_binding()}
    scene = bpy.context.scene
    scene.render.fps = FPS
    idle = bpy.data.actions["idle"]
    arm.animation_data.action = idle
    arm.animation_data.action_slot = idle.slots[0]
    # Blender imports the glTF idle first sample at frame 0.
    scene.frame_set(0)
    base = {p.name: p.rotation_quaternion.copy() for p in arm.pose.bones}
    base_locations = {p.name: p.location.copy() for p in arm.pose.bones}
    base_scales = {p.name: p.scale.copy() for p in arm.pose.bones}
    for old in list(bpy.data.actions):
        bpy.data.actions.remove(old)
    clips = {}
    for name, poses in (("sword_hit", POSES), ("throw_right", THROW_POSES)):
        action = bpy.data.actions.new(name)
        action.use_fake_user = True
        slot = action.slots.new("OBJECT", arm.name)
        arm.animation_data.action = action
        arm.animation_data.action_slot = slot
        for frame in range(END + 1):
            pose(arm, frame, base, base_locations, base_scales, poses)
            for p in arm.pose.bones:
                p.keyframe_insert("location", frame=frame, group=p.name)
                p.keyframe_insert("rotation_quaternion", frame=frame, group=p.name)
                p.keyframe_insert("scale", frame=frame, group=p.name)
        set_linear(action)
        clips[name] = {"action": action, "poses": poses, "motion": report_motion(arm)}
    motion = clips["sword_hit"]["motion"]
    assert len(arm.pose.bones) == 22
    assert bindings["full"]["fullWeightVertices"] > 100
    assert sum(item["leftHand"] for item in bindings["mobile"]) > 50
    assert motion["leftHandExcursionMeters"] > .2
    assert motion["rightHandExcursionMeters"] < .15
    assert motion["minimumLeftHandToHeadMeters"] > .15
    assert clips["throw_right"]["motion"]["rightHandExcursionMeters"] > .15
    report = {"source": str(SOURCE.relative_to(ROOT)), "fps": FPS,
              "clips": {name: {"frames": END, "durationSeconds": END / FPS,
                                "keyPoses": [frame for frame, _ in item["poses"]],
                                "bones": len(arm.pose.bones), "tracks": len(arm.pose.bones) * 3,
                                "rotationTracks": len(arm.pose.bones),
                                "motion": item["motion"]} for name, item in clips.items()},
              "binding": bindings}
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.gltf(filepath=str(MODEL), export_format="GLB", use_selection=True,
                              export_animations=True, export_skins=False, export_extras=True)
    render_preview(arm, clips["sword_hit"]["action"])
    print("COMBAT_REPORT", json.dumps(report))


if __name__ == "__main__":
    main()
