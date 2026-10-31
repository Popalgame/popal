"""Build Aiko — the chibi Pal Tamer girl from PALWORLD_HEROES_MEGA_PACK — as a
skinned, animated GLB hero for the Popal runtime.

Run with Blender:
  /Applications/Blender.app/Contents/MacOS/Blender -b --python scripts/build-aiko.py -- --quality desktop
  /Applications/Blender.app/Contents/MacOS/Blender -b --python scripts/build-aiko.py -- --quality mobile

Output contract (matches site/src/modules/imported-hero.js):
  - one armature with exactly 22 bones named mixamorig:* (Mixamo-style names)
  - one skinned mesh, every vertex weighted 1.0 to its part bone (rigid chibi parts)
  - seven clips: idle, walk, run, swim, hit, throw, jump
  - hit and throw animate the RIGHT hand (Aiko's hammer hand)
  - character faces glTF +Z (Blender -Y), feet at Y=0, nominal height 1.8
"""

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector


ROOT = Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------- rig: 22 mixamorig bones, chibi proportions (head ~1/3 of 1.8 height)
# Blender axes: character faces -Y, +X is the character's left.
BONES = [
    # name, parent, head, tail
    ("mixamorig:Hips", None, (0, 0, .52), (0, 0, .58)),
    ("mixamorig:Spine", "Hips", (0, 0, .58), (0, 0, .68)),
    ("mixamorig:Spine1", "Spine", (0, 0, .68), (0, 0, .78)),
    ("mixamorig:Spine2", "Spine1", (0, 0, .78), (0, 0, .90)),
    ("mixamorig:Neck", "Spine2", (0, 0, .90), (0, 0, .97)),
    ("mixamorig:Head", "Neck", (0, 0, .97), (0, 0, 1.72)),
    ("mixamorig:LeftShoulder", "Spine2", (.10, 0, .87), (.16, 0, .87)),
    ("mixamorig:LeftArm", "LeftShoulder", (.16, 0, .87), (.27, 0, .85)),
    ("mixamorig:LeftForeArm", "LeftArm", (.27, 0, .85), (.37, 0, .82)),
    ("mixamorig:LeftHand", "LeftForeArm", (.37, 0, .82), (.44, 0, .79)),
    ("mixamorig:RightShoulder", "Spine2", (-.10, 0, .87), (-.16, 0, .87)),
    ("mixamorig:RightArm", "RightShoulder", (-.16, 0, .87), (-.27, 0, .85)),
    ("mixamorig:RightForeArm", "RightArm", (-.27, 0, .85), (-.37, 0, .82)),
    ("mixamorig:RightHand", "RightForeArm", (-.37, 0, .82), (-.44, 0, .79)),
    ("mixamorig:LeftUpLeg", "Hips", (.10, 0, .52), (.10, 0, .27)),
    ("mixamorig:LeftLeg", "LeftUpLeg", (.10, 0, .27), (.10, 0, .07)),
    ("mixamorig:LeftFoot", "LeftLeg", (.10, 0, .07), (.10, -.09, .04)),
    ("mixamorig:LeftToeBase", "LeftFoot", (.10, -.09, .04), (.10, -.15, .04)),
    ("mixamorig:RightUpLeg", "Hips", (-.10, 0, .52), (-.10, 0, .27)),
    ("mixamorig:RightLeg", "RightUpLeg", (-.10, 0, .27), (-.10, 0, .07)),
    ("mixamorig:RightFoot", "RightLeg", (-.10, 0, .07), (-.10, -.09, .04)),
    ("mixamorig:RightToeBase", "RightFoot", (-.10, -.09, .04), (-.10, -.15, .04)),
]

# ---------------------------------------------------------------- palette from docs OPIS_BOHATERKI.md (MEGA PACK)
SKIN = (1.0, 0.933, 0.867)        # #FFEEDD
HAIR_PINK = (0.969, 0.659, 0.722)   # #F7A8B8
HAIR_TIP = (0.494, 0.839, 0.875)    # #7ED6DF
EYE_TEAL = (0.176, 0.710, 0.690)    # #2DB5B0
BROW = (0.910, 0.541, 0.627)        # #E88AA0
MOUTH = (0.788, 0.416, 0.416)
JACKET = (0.180, 0.612, 0.651)      # #2E9CA6
FUR = (0.961, 0.961, 0.941)         # #F5F5F0
CROP = (1.0, 1.0, 1.0)
SHORTS = (0.545, 0.435, 0.278)      # #8B6F47
SOCKS = (0.847, 0.773, 0.647)       # #D8C5A5
BOOTS = (0.420, 0.310, 0.227)       # #6B4F3A
PACK = (0.361, 0.251, 0.200)        # #5C4033
SPHERE_BLUE = (0.227, 0.553, 0.871) # #3A8DDE
HAMMER_WOOD = (0.545, 0.353, 0.169) # #8B5A2B
RUNE_PINK = (1.0, 0.431, 0.780)     # #FF6EC7
WHITE = (1.0, 1.0, 1.0)
BLACK = (0.07, 0.07, 0.07)


def arguments():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--quality", choices=("desktop", "mobile"), default="desktop")
    p.add_argument("--glb", type=Path, default=None)
    p.add_argument("--blend", type=Path, default=None)
    p.add_argument("--preview", type=Path, default=None)
    args = p.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    suffix = "" if args.quality == "desktop" else "-mobile"
    args.glb = args.glb or ROOT / f"site/assets/models/hero-aiko{suffix}.glb"
    args.blend = args.blend or ROOT / f"docs/assets/hero-aiko{suffix}.blend"
    args.preview = args.preview or ROOT / f"docs/assets/hero-aiko{suffix}-preview.png"
    return args


# ---------------------------------------------------------------- material helpers
def material(name, color, roughness=.6, metallic=0.0, emission=None, emission_strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission is not None:
        key = "Emission Color" if "Emission Color" in bsdf.inputs else "Emission"
        bsdf.inputs[key].default_value = (*emission, 1)
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


def assign(obj, mat, bone_name):
    obj.data.materials.append(mat)
    group = obj.vertex_groups.new(name=bone_name)
    group.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
    return obj


def smooth(obj):
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def box(name, dims, loc, mat, bone, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (dims[0], dims[1], dims[2])
    bpy.ops.object.transform_apply(scale=True)
    return assign(obj, mat, bone)


def sphere(name, radius, loc, mat, bone, scale=(1, 1, 1), seg=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return assign(smooth(obj), mat, bone)


def cylinder(name, radius, depth, loc, mat, bone, rot=(0, 0, 0), vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    return assign(smooth(obj), mat, bone)


def segment_cylinder(name, a, b, radius, mat, bone, vertices=12):
    """Cylinder between two world points."""
    a, b = Vector(a), Vector(b)
    direction = b - a
    mid = (a + b) / 2
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=direction.length, location=mid)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(direction.normalized())
    bpy.ops.object.transform_apply(rotation=True)
    return assign(smooth(obj), mat, bone)


# ---------------------------------------------------------------- build the mesh parts
def build_aiko(quality):
    seg, rings = (24, 16) if quality == "desktop" else (12, 8)
    mats = {
        "skin": material("Aiko_Skin", SKIN, roughness=.55),
        "hair": material("Aiko_Hair_Pink", HAIR_PINK, roughness=.4),
        "tips": material("Aiko_Hair_Tips", HAIR_TIP, roughness=.4),
        "eye": material("Aiko_Eye_Teal", EYE_TEAL, roughness=.25),
        "brow": material("Aiko_Brow", BROW, roughness=.7),
        "mouth": material("Aiko_Mouth", MOUTH, roughness=.6),
        "jacket": material("Aiko_Jacket_Teal", JACKET, roughness=.8),
        "fur": material("Aiko_Fur_White", FUR, roughness=1.0),
        "crop": material("Aiko_Crop_White", CROP, roughness=.7),
        "shorts": material("Aiko_Shorts_Brown", SHORTS, roughness=.7),
        "socks": material("Aiko_Socks_Beige", SOCKS, roughness=.9),
        "boots": material("Aiko_Boots_Brown", BOOTS, roughness=.6, metallic=.1),
        "pack": material("Aiko_Backpack_Leather", PACK, roughness=.6),
        "sphere": material("Aiko_PalSphere_Blue", SPHERE_BLUE, roughness=.3, metallic=.2, emission=SPHERE_BLUE, emission_strength=.35),
        "hammer": material("Aiko_Hammer_Wood", HAMMER_WOOD, roughness=.7),
        "rune": material("Aiko_Rune_Pink", (0.1, 0.05, 0.1), roughness=.4, emission=RUNE_PINK, emission_strength=2.5),
        "white": material("Aiko_Eye_White", WHITE, roughness=.2),
        "black": material("Aiko_Pupil", BLACK, roughness=.2),
    }
    parts = []
    H, S, SP, SP1, SP2, N = "mixamorig:Head", "mixamorig:Spine", "mixamorig:Spine1", "mixamorig:Spine2", "mixamorig:Neck", "mixamorig:Hips"

    # head + face (face looks -Y)
    parts.append(sphere("Head", .30, (0, 0, 1.50), mats["skin"], H, scale=(1.0, .93, 1.0), seg=seg, rings=rings))
    parts.append(cylinder("Neck", .07, .14, (0, 0, 1.00), mats["skin"], N, vertices=10))
    for s in (-1, 1):  # eyes: white, teal iris, black pupil, highlight
        parts.append(sphere(f"EyeW{s}", .058, (s * .115, -.245, 1.52), mats["white"], H, scale=(1, .45, 1.25), seg=seg, rings=rings))
        parts.append(sphere(f"Iris{s}", .037, (s * .115, -.283, 1.52), mats["eye"], H, scale=(1, .4, 1.2), seg=seg, rings=rings))
        parts.append(sphere(f"Pupil{s}", .016, (s * .115, -.305, 1.52), mats["black"], H, seg=seg // 2, rings=rings // 2))
        parts.append(sphere(f"Glint{s}", .009, (s * .128, -.312, 1.545), mats["white"], H, seg=8, rings=6))
        parts.append(box(f"Brow{s}", (.095, .02, .022), (s * .115, -.258, 1.635), mats["brow"], H, rot=(0, 0, -s * .15)))
    parts.append(box("Mouth", (.07, .015, .02), (0, -.272, 1.375), mats["mouth"], H))

    # hair: cap over the skull + high ponytail with teal tips (all rigid to Head)
    parts.append(sphere("HairCap", .325, (0, .01, 1.57), mats["hair"], H, scale=(1.0, .95, .88), seg=seg, rings=rings))
    parts.append(sphere("HairBack", .30, (0, .06, 1.50), mats["hair"], H, scale=(.98, .9, .9), seg=seg, rings=rings))
    parts.append(segment_cylinder("Ponytail", (0, .10, 1.66), (0, .30, 1.80), .062, mats["hair"], H, vertices=10))
    parts.append(sphere("PonyKnot", .075, (0, .115, 1.70), mats["hair"], H, seg=seg, rings=rings))
    parts.append(segment_cylinder("PonyTip", (0, .30, 1.80), (0, .40, 1.70), .05, mats["tips"], H, vertices=10))
    parts.append(sphere("TipBall", .068, (0, .405, 1.685), mats["tips"], H, seg=seg, rings=rings))
    parts.append(sphere("Fringe", .30, (0, -.09, 1.62), mats["hair"], H, scale=(1.05, .75, .72), seg=seg, rings=rings))

    # torso: crop top peeking out under the jacket, jacket lower/upper, fur collar
    parts.append(box("CropTop", (.26, .38, .12), (0, -.02, .70), mats["crop"], SP1))
    parts.append(box("JacketLower", (.46, .30, .24), (0, 0, .68), mats["jacket"], SP1))
    parts.append(box("JacketUpper", (.48, .32, .24), (0, 0, .84), mats["jacket"], SP2))
    bpy.ops.mesh.primitive_torus_add(major_radius=.17, minor_radius=.045, major_segments=seg, minor_segments=8,
                                     location=(0, 0, .965), rotation=(math.pi / 2, 0, 0))
    collar = bpy.context.object
    collar.name = "FurCollar"
    parts.append(assign(smooth(collar), mats["fur"], SP2))
    # puffy segments: two horizontal seams on the jacket
    for z in (.76, .90):
        parts.append(box(f"Puff{z}", (.485, .325, .035), (0, 0, z), mats["jacket"], SP2 if z > .8 else SP1))
    # zipper
    parts.append(box("Zipper", (.02, .345, .012), (0, -.168, .76), mats["black"], SP1))

    # arms (short chibi arms, jacket sleeves) + skin hands
    for side, sign in (("Left", 1), ("Right", -1)):
        am, fa, hd = f"mixamorig:{side}Arm", f"mixamorig:{side}ForeArm", f"mixamorig:{side}Hand"
        parts.append(segment_cylinder(f"{side}UpperArm", (sign * .16, 0, .87), (sign * .27, 0, .85), .082, mats["jacket"], am))
        parts.append(segment_cylinder(f"{side}ForeArm", (sign * .27, 0, .85), (sign * .37, 0, .82), .066, mats["jacket"], fa))
        parts.append(sphere(f"{side}Hand", .072, (sign * .44, 0, .79), mats["skin"], hd, seg=seg, rings=rings))

    # shorts + legs + socks + boots
    parts.append(box("Shorts", (.44, .28, .20), (0, 0, .52), mats["shorts"], "mixamorig:Hips"))
    for side, sign in (("Left", 1), ("Right", -1)):
        ul, lg, ft, tb = f"mixamorig:{side}UpLeg", f"mixamorig:{side}Leg", f"mixamorig:{side}Foot", f"mixamorig:{side}ToeBase"
        parts.append(segment_cylinder(f"{side}Thigh", (sign * .10, 0, .50), (sign * .10, 0, .28), .095, mats["shorts"], ul))
        parts.append(segment_cylinder(f"{side}Shin", (sign * .10, 0, .26), (sign * .10, 0, .08), .072, mats["socks"], lg))
        parts.append(box(f"{side}Boot", (.15, .27, .10), (sign * .10, -.03, .05), mats["boots"], ft))
        parts.append(box(f"{side}Toe", (.14, .10, .08), (sign * .10, -.155, .05), mats["boots"], tb))

    # backpack on the back (+Y) with pal spheres clipped at the side, rigid to Spine2
    parts.append(box("Backpack", (.30, .14, .34), (0, .21, .80), mats["pack"], SP2))
    parts.append(box("BackpackFlap", (.32, .15, .12), (0, .215, .95), mats["pack"], SP2))
    for sign in (-1, 1):
        parts.append(box(f"Strap{sign}", (.05, .03, .42), (sign * .13, -.155, .82), mats["pack"], SP2, rot=(0, sign * .12, 0)))
        parts.append(sphere(f"PalSphere{sign}", .045, (sign * .19, .12, .68), mats["sphere"], SP2, seg=seg // 2, rings=rings // 2))
    parts.append(sphere("PalSphereC", .045, (0, .27, .62), mats["sphere"], SP2, seg=seg // 2, rings=rings // 2))

    # hammer rigid in the RIGHT hand: haft along +Z from the fist, glowing pink head
    hx = -.44
    parts.append(segment_cylinder("HammerShaft", (hx, 0, .62), (hx, 0, .98), .024, mats["hammer"], "mixamorig:RightHand", vertices=10))
    parts.append(box("HammerHead", (.17, .11, .13), (hx, 0, 1.02), mats["rune"], "mixamorig:RightHand"))
    parts.append(box("HammerBand", (.175, .115, .03), (hx, 0, 1.02), mats["hammer"], "mixamorig:RightHand"))

    return parts


def build_armature():
    arm_data = bpy.data.armatures.new("AikoRig")
    arm = bpy.data.objects.new("AikoRig", arm_data)
    bpy.context.collection.objects.link(arm)
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for name, _, head, tail in BONES:
        bone = arm_data.edit_bones.new(name)
        bone.head = Vector(head)
        bone.tail = Vector(tail)
    for name, parent, _, _ in BONES:
        if parent:
            arm_data.edit_bones[name].parent = arm_data.edit_bones["mixamorig:" + parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    arm.show_in_front = True
    return arm


def join_and_bind(parts, arm):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    mesh = bpy.context.object
    mesh.name = "Aiko"
    mesh.parent = arm
    mod = mesh.modifiers.new("Armature", "ARMATURE")
    mod.object = arm
    return mesh


# ---------------------------------------------------------------- built-in clips (same helper style as prepare-hero.py)
def vector_rotation(arm, bone_name, specification):
    bone = arm.data.bones[bone_name]
    rest = bone.matrix_local.to_3x3()
    rotations = (specification,) if isinstance(specification[0][0], (int, float)) else specification
    world = Quaternion()
    for axis, angle in rotations:
        world = Quaternion(Vector(axis), angle) @ world
    local = rest.inverted() @ world.to_matrix() @ rest
    return local.to_quaternion()


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


# A-pose-ish arms; the hammer hangs in the right fist.
IDLE = {"LeftArm": ((0, 1, 0), .55), "RightArm": ((0, 1, 0), -.55),
        "LeftForeArm": ((0, 1, 0), .20), "RightForeArm": ((0, 1, 0), -.20),
        "LeftHand": ((0, 1, 0), -.35), "RightHand": ((1, 0, 0), -.25)}


def gait(phase, amp, arms=.6):
    s = math.sin(phase)
    return {
        "LeftUpLeg": ((1, 0, 0), amp * s),
        "RightUpLeg": ((1, 0, 0), -amp * s),
        "LeftLeg": ((1, 0, 0), max(0, -s) * amp * .8),
        "RightLeg": ((1, 0, 0), max(0, s) * amp * .8),
        "LeftArm": (((0, 1, 0), .55), ((1, 0, 0), -amp * s * arms)),
        "RightArm": (((0, 1, 0), -.55), ((1, 0, 0), amp * s * arms)),
        "LeftForeArm": ((0, 1, 0), .20),
        "RightForeArm": ((0, 1, 0), -.20),
        "LeftHand": ((0, 1, 0), -.35),
        "RightHand": ((1, 0, 0), -.25),
    }


def add_animations(arm):
    action(arm, "idle", [(1, IDLE), (16, {**IDLE, "Spine2": ((1, 0, 0), .02), "Head": ((1, 0, 0), .03)}),
                         (31, IDLE)])
    action(arm, "walk", [(1 + i * 6, gait(i * math.pi / 2, .34)) for i in range(5)])
    action(arm, "run", [(1 + i * 4, gait(i * math.pi / 2, .60, .9)) for i in range(5)])
    swim_base = {"Hips": ((1, 0, 0), 1.25),
                 "LeftArm": ((0, 0, 1), -.9), "RightArm": ((0, 0, 1), .9)}
    action(arm, "swim", [(1, swim_base), (8, {**swim_base,
                                              "LeftArm": ((0, 0, 1), -.55), "RightArm": ((0, 0, 1), .55),
                                              "LeftUpLeg": ((1, 0, 0), .2), "RightUpLeg": ((1, 0, 0), -.2)}),
                         (16, {**swim_base, "LeftArm": ((0, 0, 1), -1.2), "RightArm": ((0, 0, 1), 1.2)}),
                         (24, swim_base)])
    # hit: two-handed-feel hammer overhead chop with the RIGHT hand
    action(arm, "hit", [(1, IDLE),
                        (4, {**IDLE, "Spine2": ((0, 0, 1), -.12),
                             "RightArm": (((0, 1, 0), -.55), ((1, 0, 0), -.9), ((0, 0, 1), .35)),
                             "RightForeArm": ((0, 1, 0), -.45)}),
                        (8, {**IDLE, "Spine2": ((0, 0, 1), .14),
                             "RightArm": (((0, 1, 0), -.55), ((1, 0, 0), .85), ((0, 0, 1), -.30)),
                             "RightForeArm": ((1, 0, 0), .5), "RightHand": ((1, 0, 0), -.25)}),
                        (15, IDLE)])
    # throw: right-hand pal-sphere toss
    action(arm, "throw", [(1, IDLE),
                          (8, {**IDLE, "Spine2": ((0, 0, 1), -.16),
                               "RightArm": (((0, 1, 0), -.55), ((1, 0, 0), -1.0)),
                               "RightForeArm": ((0, 1, 0), -.40), "RightHand": ((1, 0, 0), -.25)}),
                          (13, {**IDLE, "Spine2": ((0, 0, 1), .20),
                                "RightArm": (((0, 1, 0), -.55), ((1, 0, 0), .55)),
                                "RightHand": ((1, 0, 0), .35)}),
                          (23, IDLE)])
    action(arm, "jump", [(1, {**IDLE, "LeftUpLeg": ((1, 0, 0), -.35), "RightUpLeg": ((1, 0, 0), -.35)}),
                         (9, {**IDLE, "LeftArm": ((0, 1, 0), .9), "RightArm": ((0, 1, 0), -.9),
                              "LeftUpLeg": ((1, 0, 0), .28), "RightUpLeg": ((1, 0, 0), .28)}),
                         (19, IDLE)])
    arm.animation_data.action = None


# ---------------------------------------------------------------- validation + preview
def validate(mesh, arm):
    if len(arm.data.bones) != 22:
        raise ValueError(f"Expected 22 bones, got {len(arm.data.bones)}")
    expected = {"idle", "walk", "run", "swim", "hit", "throw", "jump"}
    if not expected <= set(bpy.data.actions.keys()):
        raise ValueError("Missing animation clips")
    for v in mesh.data.vertices:
        total = sum(g.weight for g in v.groups if mesh.vertex_groups[g.group].name in arm.data.bones)
        if not .995 <= total <= 1.005:
            raise ValueError(f"Unnormalized weight at vertex {v.index}: {total}")
    tris = sum(len(p.vertices) - 2 for p in mesh.data.polygons)
    low = min((mesh.matrix_world @ v.co).z for v in mesh.data.vertices)
    top = max((mesh.matrix_world @ v.co).z for v in mesh.data.vertices)
    print(f"Validated Aiko: {tris} triangles, {len(arm.data.bones)} bones, "
          f"{len(expected)} clips, z-range {low:.3f}..{top:.3f}")
    if abs(low) > .03 or abs((top - low) - 1.8) > .06:
        raise ValueError(f"Bad normalized height: {low:.3f}..{top:.3f}")


def render_preview(path, arm):
    scene = bpy.context.scene
    cam_data = bpy.data.cameras.new("AikoPreviewCamera")
    camera = bpy.data.objects.new("AikoPreviewCamera", cam_data)
    scene.collection.objects.link(camera)
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 2.1
    scene.camera = camera
    light_data = bpy.data.lights.new("AikoPreviewLight", "AREA")
    light = bpy.data.objects.new("AikoPreviewLight", light_data)
    scene.collection.objects.link(light)
    light.location = (1.5, -2.5, 4)
    light_data.energy = 900
    light_data.size = 4
    light2_data = bpy.data.lights.new("AikoFill", "AREA")
    light2 = bpy.data.objects.new("AikoFill", light2_data)
    scene.collection.objects.link(light2)
    light2.location = (-2, -1, 3)
    light2_data.energy = 500
    light2_data.size = 3
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x, scene.render.resolution_y = 360, 480
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.world = bpy.data.worlds.new("AikoPreviewWorld")
    scene.world.color = (.16, .18, .22)
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.012))
    ground = bpy.context.object
    ground.name = "PreviewGround"
    gm = material("PreviewGroundMat", (.25, .28, .31), roughness=1.0)
    ground.data.materials.append(gm)
    hits = bpy.data.actions["hit"]
    arm.animation_data.action = hits
    arm.animation_data.action_slot = hits.slots[0]
    frames = [0, 5, 8, 12]
    images = []
    import tempfile
    with tempfile.TemporaryDirectory(prefix="aiko-") as folder:
        for view, loc in (("front", (0, -3.2, 1.0)), ("side", (3.2, 0, 1.0)), ("back", (0, 3.2, 1.0))):
            camera.location = loc
            camera.rotation_euler = (Vector((0, 0, .9)) - camera.location).to_track_quat("-Z", "Y").to_euler()
            for frame in frames:
                scene.frame_set(frame)
                p = Path(folder) / f"{view}-{frame}.png"
                scene.render.filepath = str(p)
                bpy.ops.render.render(write_still=True)
                images.append((view, frame, str(p)))
        import subprocess
        compose = '''from PIL import Image, ImageDraw
import sys
items=[Image.open(a.split("|")[2]).convert("RGB") for a in sys.argv[2:]]
labels=[a.split("|")[0]+"/f"+a.split("|")[1] for a in sys.argv[2:]]
out=Image.new("RGB",(3*360,4*508),"#20252c")
d=ImageDraw.Draw(out)
for n,img in enumerate(items):
    out.paste(img,((n%3)*360,(n//3)*508+28)); d.text(((n%3)*360+8,(n//3)*508+6),labels[n],fill="white")
out.save(sys.argv[1])'''
        subprocess.run(["python3", "-c", compose, str(path), *[f"{v}|{f}|{p}" for v, f, p in images]], check=True)
    print("Preview written to", path)


def main():
    args = arguments()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    arm = build_armature()
    parts = build_aiko(args.quality)
    mesh = join_and_bind(parts, arm)
    add_animations(arm)
    validate(mesh, arm)
    render_preview(args.preview, arm)
    for path in (args.glb, args.blend):
        path.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(args.blend.resolve()))
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.gltf(filepath=str(args.glb.resolve()), export_format="GLB",
                              use_selection=True, export_animations=True, export_skins=True,
                              export_extras=True, export_image_format="AUTO")
    # verify reimport like prepare-hero does
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(args.glb.resolve()))
    arms = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
    if len(arms) != 1:
        raise ValueError(f"Reimported GLB has {len(arms)} armatures")
    bound = [o for o in bpy.context.scene.objects if o.type == "MESH" and o.find_armature() == arms[0]]
    if len(bound) != 1:
        raise ValueError("Reimported GLB should bind exactly one mesh")
    if not {"idle", "walk", "run", "swim", "hit", "throw", "jump"} <= set(bpy.data.actions.keys()):
        raise ValueError("Reimported GLB missing clips")
    print("Reimport OK:", args.glb)
    print("Wrote", args.glb, "and", args.blend)


if __name__ == "__main__":
    main()
