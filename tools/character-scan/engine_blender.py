"""Polpal Studio local character engine — Blender side.

Builds a game-ready hero from a character recipe (character_recipe.py):
parts -> proportions -> rig (22 mixamorig bones) -> rigid weights -> seven
clips -> GLB export -> reimport check. After every visual stage it writes a
partial GLB and a line to events.jsonl so the Studio preview can follow.

Run (headless, nothing from the reference pack is executed):
  Blender --background --factory-startup --python engine_blender.py -- RECIPE.json OUT_DIR

Shapes and clips derive from scripts/build-aiko.py (the current in-game Aiko);
with the default recipe the result matches that model's layout.
"""
import hashlib
import json
import math
import sys
import time
from pathlib import Path

import bpy
from mathutils import Quaternion, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import character_recipe as recipe_lib  # noqa: E402

T = recipe_lib.TEMPLATE
H = recipe_lib.GAME_HEIGHT

# Template skeleton (build coordinates, character faces -Y, +X is character's left).
BONES = [
    ("Hips", None, (0, 0, .52), (0, 0, .58)), ("Spine", "Hips", (0, 0, .58), (0, 0, .68)),
    ("Spine1", "Spine", (0, 0, .68), (0, 0, .78)), ("Spine2", "Spine1", (0, 0, .78), (0, 0, .90)),
    ("Neck", "Spine2", (0, 0, .90), (0, 0, .97)), ("Head", "Neck", (0, 0, .97), (0, 0, 1.72)),
    ("LeftShoulder", "Spine2", (.10, 0, .87), (.16, 0, .87)), ("LeftArm", "LeftShoulder", (.16, 0, .87), (.27, 0, .85)),
    ("LeftForeArm", "LeftArm", (.27, 0, .85), (.37, 0, .82)), ("LeftHand", "LeftForeArm", (.37, 0, .82), (.44, 0, .79)),
    ("RightShoulder", "Spine2", (-.10, 0, .87), (-.16, 0, .87)), ("RightArm", "RightShoulder", (-.16, 0, .87), (-.27, 0, .85)),
    ("RightForeArm", "RightArm", (-.27, 0, .85), (-.37, 0, .82)), ("RightHand", "RightForeArm", (-.37, 0, .82), (-.44, 0, .79)),
    ("LeftUpLeg", "Hips", (.10, 0, .52), (.10, 0, .27)), ("LeftLeg", "LeftUpLeg", (.10, 0, .27), (.10, 0, .07)),
    ("LeftFoot", "LeftLeg", (.10, 0, .07), (.10, -.09, .04)), ("LeftToeBase", "LeftFoot", (.10, -.09, .04), (.10, -.15, .04)),
    ("RightUpLeg", "Hips", (-.10, 0, .52), (-.10, 0, .27)), ("RightLeg", "RightUpLeg", (-.10, 0, .27), (-.10, 0, .07)),
    ("RightFoot", "RightLeg", (-.10, 0, .07), (-.10, -.09, .04)), ("RightToeBase", "RightFoot", (-.10, -.09, .04), (-.10, -.15, .04)),
]
ARM_BONES = {f"{s}{b}" for s in ("Left", "Right") for b in ("Arm", "ForeArm", "Hand")}


def linear(rgb):
    return tuple(c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in rgb)


class Warp:
    """Maps template coordinates to the recipe's proportions (before height normalisation)."""

    def __init__(self, p):
        self.z_from = [0, T['crotch'], T['shoulder'], T['chin'], T['top']]
        self.z_to = [0, p['crotch_height']*H, p['shoulder_height']*H, (1-p['head_ratio'])*H, H]
        self.torso = p['torso_width']*H/T['torso_width']
        self.shoulder_x = T['shoulder_x']*self.torso
        self.arm = (p['arm_span']*H/2-self.shoulder_x)/(T['hand_x']-T['shoulder_x'])
        self.set_head_top(T['top'])

    def set_head_top(self, top):
        """Template height of the highest head-bound geometry (hair included)."""
        self.head_top = top
        self.head = (self.z_to[4]-self.z_to[3])/(top-T['chin'])

    def z(self, value):
        f, t = self.z_from, self.z_to
        if value <= f[0]:
            return value
        for i in range(len(f)-1):
            if value <= f[i+1] or i == len(f)-2:
                return t[i]+(value-f[i])*(t[i+1]-t[i])/(f[i+1]-f[i])

    def z_inv(self, value):
        """Target height (m) back to template height, inverse of z()."""
        f, t = self.z_from, self.z_to
        for i in range(len(t)-1):
            if value <= t[i+1] or i == len(t)-2:
                return f[i]+(value-t[i])*(f[i+1]-f[i])/(t[i+1]-t[i])

    def point(self, co, bone):
        x, y, z = co
        if bone == "Head":
            return Vector((x*self.head, y*self.head, self.z_to[3]+(z-T['chin'])*self.head))
        if bone in ARM_BONES:
            sign = 1 if x >= 0 else -1
            reach = abs(x)-T['shoulder_x']
            return Vector((sign*(self.shoulder_x+reach*self.arm), y, self.z(z)))
        return Vector((x*self.torso, y, self.z(z)))


class Builder:
    def __init__(self, recipe, out):
        self.r = recipe
        self.out = out
        self.warp = Warp(recipe['proportions'])
        self.parts = []
        self.events = out/'events.jsonl'
        self.started = time.time()
        q = recipe['quality']
        self.seg, self.rings = (24, 16) if q == 'desktop' else (12, 8)
        self.mats = {}
        hair = recipe['parts']['hair']['style']
        v = recipe['proportions']['hair_volume']
        # Highest hair point in template units: ponytail knot rise or the fringe roots.
        self.warp.set_head_top(1.83+.10+.06*v if hair == 'ponytail_high' else 1.86+.02*v)

    # ------------------------------------------------------------ bookkeeping
    def event(self, stage, status='done', **extra):
        line = {'stage': stage, 'status': status, 't': round(time.time()-self.started, 2), **extra}
        with self.events.open('a') as handle:
            handle.write(json.dumps(line)+'\n')

    def stage(self, name):
        """Export the parts built so far as a static GLB for the preview."""
        (self.out/'stages').mkdir(exist_ok=True)
        path = self.out/'stages'/f'{len(list((self.out/"stages").glob("*.glb"))):02d}-{name}.glb'
        bpy.ops.object.select_all(action='DESELECT')
        for obj in self.parts:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = self.parts[-1]
        bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                                  export_animations=False, export_skins=False, export_apply=True)
        tris = sum(len(p.vertices)-2 for o in self.parts for p in o.data.polygons)
        self.event(name, glb=str(path.relative_to(self.out)), parts=len(self.parts), triangles=tris)

    # ------------------------------------------------------------ materials and primitives
    def mat(self, key, slot, roughness=.6, metallic=0.0, emission_slot=None, strength=0.0):
        if key in self.mats:
            return self.mats[key]
        m = bpy.data.materials.new(f"{self.r['name']}_{key}")
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get("Principled BSDF")
        # Palette hex is sRGB; Principled Base Color expects linear values.
        rgb = linear(recipe_lib.hex_to_rgb(self.r['palette'][slot])) if slot else (.006, .006, .006)
        bsdf.inputs["Base Color"].default_value = (*rgb, 1)
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if emission_slot:
            glow = linear(recipe_lib.hex_to_rgb(self.r['palette'][emission_slot]))
            bsdf.inputs["Emission Color" if "Emission Color" in bsdf.inputs else "Emission"].default_value = (*glow, 1)
            bsdf.inputs["Emission Strength"].default_value = strength
        self.mats[key] = m
        return m

    def finish(self, obj, name, mat, bone, smooth=True):
        obj.name = name
        if smooth:
            for poly in obj.data.polygons:
                poly.use_smooth = True
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        for v in obj.data.vertices:
            v.co = self.warp.point(v.co, bone)
        for m in (mat if isinstance(mat, list) else [mat]):
            obj.data.materials.append(m)
        group = obj.vertex_groups.new(name="mixamorig:"+bone)
        group.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
        self.parts.append(obj)
        return obj

    def box(self, name, dims, loc, mat, bone, rot=(0, 0, 0)):
        bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
        obj = bpy.context.object
        obj.scale = dims
        return self.finish(obj, name, mat, bone, smooth=False)

    def sphere(self, name, radius, loc, mat, bone, scale=(1, 1, 1), seg=None, rings=None):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=seg or self.seg, ring_count=rings or self.rings, radius=radius, location=loc)
        obj = bpy.context.object
        obj.scale = scale
        return self.finish(obj, name, mat, bone)

    def segment(self, name, a, b, radius, mat, bone, vertices=12):
        a, b = Vector(a), Vector(b)
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=(b-a).length, location=(a+b)/2)
        obj = bpy.context.object
        obj.rotation_mode = 'QUATERNION'
        obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference((b-a).normalized())
        return self.finish(obj, name, mat, bone)

    # ------------------------------------------------------------ shape helpers
    def tube(self, name, points, radii, mat, bone, sides=None, split=None, tip_mat=None):
        """Tapered tube along points (a hair strand, lash, brow...). Optional two-tone split."""
        import bmesh
        sides = sides or (6 if self.r['quality'] == 'desktop' else 4)
        pts = [Vector(p) for p in points]
        mesh = bpy.data.meshes.new(name)
        bm = bmesh.new()
        rings, normal = [], None
        for i, p in enumerate(pts):
            t = (pts[min(i+1, len(pts)-1)]-pts[max(i-1, 0)]).normalized()
            if normal is None:
                normal = t.orthogonal().normalized()
            normal = (normal-t*normal.dot(t)).normalized()  # parallel transport
            side = t.cross(normal)
            ring = [bm.verts.new(p+(normal*math.cos(a)+side*math.sin(a))*radii[i])
                    for a in (2*math.pi*k/sides for k in range(sides))]
            rings.append(ring)
        cut = None if split is None else max(1, min(len(pts)-1, round(split*(len(pts)-1))))
        for i in range(len(rings)-1):
            for k in range(sides):
                f = bm.faces.new((rings[i][k], rings[i][(k+1) % sides], rings[i+1][(k+1) % sides], rings[i+1][k]))
                f.material_index = 1 if cut is not None and i >= cut else 0
        start = bm.faces.new(list(reversed(rings[0])))
        start.material_index = 0
        end = bm.faces.new(rings[-1])
        end.material_index = 1 if cut is not None else 0
        bm.to_mesh(mesh)
        bm.free()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        return self.finish(obj, name, [mat, tip_mat] if cut is not None else mat, bone)

    def rounded(self, name, dims, loc, mat, bone, bevel=.03, rot=(0, 0, 0)):
        bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
        obj = bpy.context.object
        obj.scale = dims
        bpy.ops.object.transform_apply(scale=True)
        mod = obj.modifiers.new('round', 'BEVEL')
        mod.width = min(bevel, min(dims)/2.05)
        mod.segments = 2 if self.r['quality'] == 'desktop' else 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
        return self.finish(obj, name, mat, bone)

    def ellipsoid(self, name, centre, radii, mat, bone, axis=None, seg=16, rings=10):
        """Ellipsoid with radii (x, y, z); `axis` turns its local -Y towards that direction."""
        bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=1, location=centre)
        obj = bpy.context.object
        obj.scale = radii
        if axis is not None:
            obj.rotation_mode = 'QUATERNION'
            obj.rotation_quaternion = Vector((0, -1, 0)).rotation_difference(Vector(axis).normalized())
        return self.finish(obj, name, mat, bone)

    def capsule(self, name, a, b, radius, mat, bone, seg=10, rings=7):
        """Puffy segment: ellipsoid stretched between two points."""
        a, b = Vector(a), Vector(b)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=1, location=(a+b)/2)
        obj = bpy.context.object
        obj.scale = (radius, radius, (b-a).length/2+radius*.35)
        obj.rotation_mode = 'QUATERNION'
        obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference((b-a).normalized())
        return self.finish(obj, name, mat, bone)

    # ------------------------------------------------------------ head geometry
    HEAD_C = Vector((0, 0, 1.50))

    def head_surface(self, x, z, lift=0.0):
        """Point on the front of the head ellipsoid and its outward normal (template coordinates)."""
        a, b, c = .30*self.head_sx, .30*.93, .30
        dz = z-self.HEAD_C.z
        inside = max(.02, 1-(x/a)**2-(dz/c)**2)
        y = -b*math.sqrt(inside)
        normal = Vector((x/a**2, y/b**2, dz/c**2)).normalized()
        return Vector((x, y, z))+normal*lift, normal

    # ------------------------------------------------------------ parts
    def body(self):
        f, u = self.r['face'], recipe_lib.FACE_UNIT
        # Wide anime eyes need a wider face front than the template sphere.
        outer = (f['eye_spacing']+f['eye_width'])*u/2
        self.head_sx = max(1.0, (outer+.06)/.30)
        skin = self.mat('skin', 'skin', .55)
        self.sphere("Head", .30, tuple(self.HEAD_C), skin, "Head", scale=(self.head_sx, .93, 1.0))
        self.segment("Neck", (0, 0, .93), (0, 0, 1.07), .07, skin, "Neck", 10)
        for side, s in (("Left", 1), ("Right", -1)):
            self.ellipsoid(f"{side}Hand", (s*.44, 0, .79), (.075, .065, .08), skin, f"{side}Hand")
        self.stage('body')

    def face(self):
        f, u = self.r['face'], recipe_lib.FACE_UNIT
        white = self.mat('eye_white', None, .25)
        white.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (1, 1, 1, 1)
        iris, pupil = self.mat('eyes', 'eyes', .2), self.mat('pupil', None, .2)
        lash, brow, mouth = self.mat('lash', None, .5), self.mat('brows', 'brows', .7), self.mat('mouth', 'mouth', .6)
        skin = self.mat('skin', 'skin', .55)
        ez, W, Hh = 1.52, f['eye_width']*u, f['eye_height']*u
        for s in (-1, 1):
            ex = s*f['eye_spacing']*u/2
            p, n = self.head_surface(ex, ez)
            self.ellipsoid(f"Sclera{s}", p+n*.002, (W/2, .012, Hh/2), white, "Head", axis=n, seg=16, rings=10)
            irx, irz = W/2*f['iris_ratio'], Hh/2*min(.98, f['iris_ratio']*1.12)
            ip = p+n*.008+Vector((-s*W*.04, 0, -Hh*.02))
            self.ellipsoid(f"Iris{s}", ip, (irx, .012, irz), iris, "Head", axis=n, seg=16, rings=10)
            self.ellipsoid(f"Pupil{s}", ip+n*.006, (irx*.42, .008, irz*.5), pupil, "Head", axis=n, seg=12, rings=8)
            self.ellipsoid(f"GlintBig{s}", ip+n*.011+Vector((s*irx*.35, 0, irz*.38)), (irx*.28,) * 3, white, "Head", seg=10, rings=6)
            self.ellipsoid(f"GlintSmall{s}", ip+n*.011+Vector((-s*irx*.35, 0, -irz*.42)), (irx*.12,) * 3, white, "Head", seg=8, rings=5)
            arc = []
            for k in range(8):
                t = -1+2*k/7  # inner (-1) to outer (+1) corner
                q, qn = self.head_surface(ex+s*t*W/2*1.04, ez+Hh/2*(.98-.28*t*t)+.004)
                arc.append(q+qn*.012)
            q, qn = self.head_surface(ex+s*W/2*1.22, ez+Hh*.42)
            arc.append(q+qn*.01)  # outer flick
            self.tube(f"Lash{s}", arc, [.007, .011, .014, .015, .015, .014, .013, .010, .002], lash, "Head", sides=6)
            bz = ez+f['brow_height']*u
            brow_pts = []
            for k in range(5):
                t = -1+2*k/4
                q, qn = self.head_surface(ex+s*t*W*.42, bz+.018*(1-t*t)-.006*t)
                brow_pts.append(q+qn*.008)
            self.tube(f"Brow{s}", brow_pts, [.004, .008, .009, .007, .002], brow, "Head", sides=6)
        mz = ez-f['mouth_drop']*u
        mouth_pts = []
        for k in range(5):
            t = -1+2*k/4
            q, qn = self.head_surface(t*.032, mz+.006*t*t)
            mouth_pts.append(q+qn*.006)
        self.tube("Mouth", mouth_pts, [.002, .005, .006, .005, .002], mouth, "Head", sides=6)
        q, qn = self.head_surface(0, (ez+mz)/2-.01)
        self.ellipsoid("Nose", q, (.012, .008, .01), skin, "Head", seg=8, rings=6)
        self.stage('face')

    def hair(self):
        import bmesh
        v = self.r['proportions']['hair_volume']
        hair, tips = self.mat('hair_root', 'hair_root', .4), self.mat('hair_tip', 'hair_tip', .4)
        # Cap over the skull with an opening for the face (deleted, not hidden).
        bpy.ops.mesh.primitive_uv_sphere_add(segments=self.seg, ring_count=self.rings, radius=.325,
                                             location=(0, .015, 1.53))
        cap = bpy.context.object
        cap.scale = (self.head_sx*1.04*v**.3, .97*v**.3, .96*v**.3)
        bpy.ops.object.transform_apply(location=True, scale=True)
        bm = bmesh.new()
        bm.from_mesh(cap.data)
        gone = [x for x in bm.verts if (x.co.y < -.06 and x.co.z < 1.70) or x.co.z < 1.28]
        bmesh.ops.delete(bm, geom=gone, context='VERTS')
        bm.to_mesh(cap.data)
        bm.free()
        self.finish(cap, "HairCap", hair, "Head")
        r = .058*v
        # Fringe: overlapping spiky strands over the forehead, longer at the sides.
        count = 15
        for i in range(count):
            x = (-1+2*i/(count-1))*.29*self.head_sx
            drop = 1.665-abs(x)*.6+(.025 if i % 2 else -.01)
            root = Vector((x*.5, -.10, 1.85))
            mid, mn = self.head_surface(x*.95, 1.74, .045)
            tip, tn = self.head_surface(x*1.04+(.02 if i % 3 == 0 else -.012), drop, .035)
            self.tube(f"Fringe{i}", [root, mid, (mid+tip)/2+mn*.012, tip], [r, r*.95, r*.6, .004], hair, "Head",
                      split=.88, tip_mat=tips)
        # Side locks framing the face down past the cheeks.
        for s in (-1, 1):
            for j, (dx, end) in enumerate(((0, 1.24), (.045, 1.30), (.09, 1.36))):
                a = Vector((s*(.25+dx)*self.head_sx, -.08+dx, 1.74))
                b = Vector((s*(.33+dx)*self.head_sx, -.07+dx, 1.52))
                c = Vector((s*(.32+dx*.6)*self.head_sx, -.10+dx, end))
                self.tube(f"SideLock{s}{j}", [a, b, (b+c)/2, c], [r*1.2, r*1.1, r*.75, .004], hair, "Head",
                          split=.58, tip_mat=tips)
        # Back: a solid mass under layered strands, so no scalp shows between them.
        self.ellipsoid("HairBackMass", (0, .10, 1.52), (.33*self.head_sx*v**.3, .27*v**.3, .30*v**.3), hair, "Head")
        for i in range(9):
            x = (-1+2*i/8)*.27*self.head_sx
            self.tube(f"BackHair{i}", [(x*.8, .20, 1.80), (x*1.1, .33, 1.52), (x*1.15, .27, 1.26)],
                      [r*1.4, r*1.2, .005], hair, "Head", split=.62, tip_mat=tips)
        if self.r['parts']['hair']['style'] == 'ponytail_high':
            knot = Vector((0, .12, 1.83))
            self.ellipsoid("PonyKnot", knot, (.09*v, .085*v, .075*v), hair, "Head")
            for i in range(14):
                a = 2*math.pi*i/14
                k = .85+.3*((i*7) % 5)/4  # varied length
                spread = Vector((math.cos(a)*.14, math.sin(a)*.06, math.sin(a)*.03))*v
                up = knot+Vector((0, .05, .09*v))+spread*.7
                out = knot+Vector((0, .26*k, .05))+spread*1.5
                end = knot+Vector((0, .36*k, -.30*k))+spread*2.0
                self.tube(f"Pony{i}", [knot+spread*.25, up, out, (out+end)/2+Vector((0, .03, 0)), end],
                          [r*1.3, r*1.25, r*1.0, r*.6, .004], hair, "Head", split=.5, tip_mat=tips)
        else:
            self.ellipsoid("NapeTips", (0, .16, 1.32), (.22*v, .1*v, .08*v), tips, "Head")
        self.stage('hair')

    def tz(self, key):
        """Recipe boundary (fraction of height) as a template height."""
        return self.warp.z_inv(self.r['proportions'][key]*H)

    def leg_piece(self, side, sign, top, bottom, mat, name, radius=(.095, .072)):
        """Leg cylinder between two template heights, split at the knee between bones."""
        knee = .27
        if top-bottom < .005:
            return
        if top > knee:
            self.segment(f"{side}{name}Thigh", (sign*.10, 0, top), (sign*.10, 0, max(bottom, knee)), radius[0], mat, f"{side}UpLeg")
        if bottom < knee:
            self.segment(f"{side}{name}Shin", (sign*.10, 0, min(top, knee)), (sign*.10, 0, bottom), radius[1], mat, f"{side}Leg")

    def clothing(self):
        parts = self.r['parts']
        skin, jacket = self.mat('skin', 'skin', .55), self.mat('jacket', 'jacket', .8)
        jacket_hem, top_hem, waist = self.tz('jacket_hem'), self.tz('top_hem'), self.tz('waist')
        self.rounded("Midriff", (.38, .25, .84-(waist-.02)), (0, 0, (.84+waist-.02)/2), skin, "Spine1", bevel=.06)
        if parts['undershirt']['style'] == 'crop_top' and top_hem < jacket_hem-.005:
            self.rounded("CropTop", (.41, .27, jacket_hem+.06-top_hem), (0, 0, (jacket_hem+.06+top_hem)/2),
                         self.mat('top', 'top', .7), "Spine1", bevel=.05)
        if parts['top']['style'] == 'puffer_jacket_cropped':
            # Open front: two panels and a back, the crop top shows in between.
            lo, hi = jacket_hem, .96
            for side, s in (("Left", 1), ("Right", -1)):
                self.rounded(f"Jacket{side}Lower", (.19, .31, .80-lo), (s*.14, -.005, (.80+lo)/2), jacket, "Spine1", bevel=.07)
                self.rounded(f"Jacket{side}Upper", (.20, .33, hi-.72), (s*.145, -.005, (hi+.72)/2), jacket, "Spine2", bevel=.08)
            self.rounded("JacketBack", (.46, .14, hi-lo), (0, .09, (hi+lo)/2), jacket, "Spine1", bevel=.06)
            rows = max(2, int((.92-lo)/.075)+1)
            for i in range(rows):
                z = lo+.02+(.90-lo-.02)*i/(rows-1)
                bone = "Spine2" if z > .8 else "Spine1"
                for side, s in (("Left", 1), ("Right", -1)):
                    self.rounded(f"Puff{side}{i}", (.21, .35, .065), (s*.145, -.004, z), jacket, bone, bevel=.03)
                self.rounded(f"PuffBack{i}", (.24, .15, .065), (0, .10, z), jacket, bone, bevel=.03)
            for side, s in (("Left", 1), ("Right", -1)):  # puffy sleeves in segments
                sh, el, wr = Vector((s*.16, 0, .87)), Vector((s*.27, 0, .85)), Vector((s*.37, 0, .82))
                self.capsule(f"{side}Puff0", sh, sh.lerp(el, .5), .088, jacket, f"{side}Arm")
                self.capsule(f"{side}Puff1", sh.lerp(el, .5), el, .09, jacket, f"{side}Arm")
                self.capsule(f"{side}Puff2", el, el.lerp(wr, .55), .082, jacket, f"{side}ForeArm")
                self.capsule(f"{side}Puff3", el.lerp(wr, .55), wr, .075, jacket, f"{side}ForeArm")
                self.segment(f"{side}Cuff", wr-(wr-el).normalized()*.01, wr+(wr-el).normalized()*.025, .058,
                             self.mat('cuff', 'jacket', .9), f"{side}ForeArm")
        else:  # tshirt: fitted torso, short sleeves, bare forearms
            self.rounded("Shirt", (.42, .28, .96-jacket_hem), (0, 0, (.96+jacket_hem)/2), jacket, "Spine1", bevel=.06)
            for side, s in (("Left", 1), ("Right", -1)):
                self.segment(f"{side}Sleeve", (s*.16, 0, .87), (s*.24, 0, .855), .085, jacket, f"{side}Arm")
                self.segment(f"{side}UpperArm", (s*.24, 0, .855), (s*.27, 0, .85), .06, skin, f"{side}Arm")
                self.segment(f"{side}ForeArm", (s*.27, 0, .85), (s*.37, 0, .82), .055, skin, f"{side}ForeArm")
        if parts['top'].get('collar') == 'fur':
            fur = self.mat('fur', 'fur', 1.0)
            bpy.ops.mesh.primitive_torus_add(major_radius=.18, minor_radius=.06, major_segments=self.seg, minor_segments=10,
                                             location=(0, 0, .965), rotation=(math.pi/2, 0, 0))
            self.finish(bpy.context.object, "FurCollar", fur, "Spine2")
            for i in range(10):  # tufts
                a = 2*math.pi*i/10
                self.ellipsoid(f"FurTuft{i}", (math.cos(a)*.20, math.sin(a)*.20, .975+.02*math.sin(3*a)), (.05, .05, .045),
                               fur, "Spine2", seg=8, rings=5)
        shorts = self.mat('shorts', 'shorts', .7)
        self.rounded("Shorts", (.44, .28, waist-.44), (0, 0, (waist+.44)/2), shorts, "Hips", bevel=.05)
        if parts['bottom']['style'] == 'shorts_cargo':
            straps = self.mat('straps', 'straps', .6)
            self.rounded("Belt", (.45, .29, .035), (0, 0, waist-.015), straps, "Hips", bevel=.012)
            self.rounded("Buckle", (.06, .02, .045), (0, -.15, waist-.015), self.mat('metal', None, .3, .8), "Hips", bevel=.008)
            for s in (-1, 1):
                self.rounded(f"CargoPocket{s}", (.045, .14, .10), (s*.235, 0, (waist+.44)/2-.02), shorts, "Hips", bevel=.015)
        boot_top = max(.03, self.tz('boot_top'))
        pants = parts['bottom']['style'] == 'pants'
        shorts_hem = boot_top if pants else min(.50, self.tz('shorts_hem'))
        socks_on = parts['legwear']['style'] == 'socks_knee' and not pants
        sock_top = self.tz('sock_top') if socks_on else boot_top
        boots = self.mat('boots', 'boots', .6, .1)
        sole = self.mat('sole', 'straps', .8)
        socks = self.mat('socks', 'socks', .9)
        for side, s in (("Left", 1), ("Right", -1)):
            if not pants:  # short shorts legs: a wider cuff around the thigh top
                self.segment(f"{side}ShortsLeg", (s*.10, 0, .50), (s*.10, 0, max(shorts_hem, .44)), .12, shorts, f"{side}UpLeg", 14)
            self.leg_piece(side, s, .50, shorts_hem, shorts, "Shorts")
            self.leg_piece(side, s, shorts_hem, max(sock_top, boot_top), skin, "Skin")
            self.leg_piece(side, s, sock_top, boot_top, socks, "Sock", radius=(.098, .078))
            if socks_on and sock_top > boot_top+.02:
                knee = .27
                bone = f"{side}UpLeg" if sock_top > knee else f"{side}Leg"
                self.segment(f"{side}SockCuff", (s*.10, 0, sock_top+.012), (s*.10, 0, sock_top-.018), .085, socks, bone, 14)
            if parts['footwear']['style'] == 'boots':
                self.rounded(f"{side}Boot", (.16, .22, boot_top), (s*.10, -.01, boot_top/2+.012), boots, f"{side}Foot", bevel=.035)
                self.rounded(f"{side}BootCuff", (.175, .20, .03), (s*.10, -.005, boot_top+.004), boots, f"{side}Foot", bevel=.012)
                self.rounded(f"{side}Toe", (.15, .13, min(.085, boot_top)), (s*.10, -.15, min(.085, boot_top)/2+.012), boots,
                             f"{side}ToeBase", bevel=.035)
                self.rounded(f"{side}Sole", (.17, .33, .026), (s*.10, -.06, .013), sole, f"{side}Foot", bevel=.008)
                for k, z in enumerate((boot_top*.4, boot_top*.75)):
                    self.rounded(f"{side}Buckle{k}", (.012, .07, .018), (s*.182, -.02, z), sole, f"{side}Foot", bevel=.004)
            else:
                self.rounded(f"{side}Shoe", (.13, .24, .07), (s*.10, -.04, .035), boots, f"{side}Foot", bevel=.025)
                self.rounded(f"{side}Toe", (.12, .09, .06), (s*.10, -.15, .03), boots, f"{side}ToeBase", bevel=.025)
        self.stage('clothing')

    def pal_sphere(self, name, centre, radius, bone):
        """Two-tone capture sphere: primary top, secondary bottom, dark band and a button."""
        import bmesh
        top = self.mat('sphere_primary', 'sphere_primary', .3, .2, emission_slot='sphere_primary', strength=.25)
        bottom = self.mat('sphere_secondary', 'sphere_secondary', .3, .1)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=radius, location=centre)
        obj = bpy.context.object
        bpy.ops.object.transform_apply(location=True)
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        for f in bm.faces:
            f.material_index = 0 if f.calc_center_median().z >= centre[2] else 1
        bm.to_mesh(obj.data)
        bm.free()
        self.finish(obj, name, [top, bottom], bone)
        c = Vector(centre)
        self.segment(name+"Band", c+Vector((0, 0, .006)), c-Vector((0, 0, .006)), radius*1.02, self.mat('lash', None, .5), bone, 16)
        self.ellipsoid(name+"Button", c+Vector((0, -radius*.98, 0)), (radius*.32, radius*.12, radius*.32), bottom, bone, seg=10, rings=6)

    def accessories(self):
        parts, hand = self.r['parts'], self.r['game']['weapon_hand']
        if parts['back']['style'] == 'backpack':
            pack = self.mat('backpack', 'backpack', .6)
            self.rounded("Backpack", (.30, .14, .34), (0, .21, .80), pack, "Spine2", bevel=.04)
            self.rounded("BackpackFlap", (.32, .155, .12), (0, .215, .95), pack, "Spine2", bevel=.03)
            for s in (-1, 1):
                self.rounded(f"Strap{s}", (.05, .03, .42), (s*.13, -.17, .82), pack, "Spine2", bevel=.01, rot=(0, s*.12, 0))
            spots = [(-.20, .14, .66), (.20, .14, .66), (0, .30, .62), (-.18, .27, .74), (.18, .27, .74), (0, .30, .80)]
            for i in range(parts['back']['spheres']):
                self.pal_sphere(f"PalSphere{i}", spots[i], .048, "Spine2")
        if parts['weapon']['style'] == 'hammer':
            hx = -.44 if hand == 'right' else .44
            bone = "RightHand" if hand == 'right' else "LeftHand"
            wood = self.mat('hammer_wood', 'hammer_wood', .7)
            glow = self.mat('rune', 'rune_glow', .4, emission_slot='rune_glow', strength=3.0 if parts['weapon'].get('glow') else 0)
            self.segment("HammerShaft", (hx, 0, .62), (hx, 0, .98), .024, wood, bone, 10)
            self.rounded("HammerHead", (.18, .12, .14), (hx, 0, 1.03), wood, bone, bevel=.02)
            for side in (-1, 1):
                self.rounded(f"HammerRunes{side}", (.12, .006, .08), (hx, side*.062, 1.03), glow, bone, bevel=.002)
            self.rounded("HammerBand", (.185, .125, .025), (hx, 0, 1.03), self.mat('sole', 'straps', .8), bone, bevel=.006)
        self.stage('accessories')

    # ------------------------------------------------------------ height, rig, clips
    def normalise(self):
        """Uniform scale so the finished hero is exactly the contract height."""
        zs = [(o.matrix_world @ v.co).z for o in self.parts for v in o.data.vertices]
        low, top = min(zs), max(zs)
        self.scale = H/(top-low)
        self.lift = -low
        for o in self.parts:
            for v in o.data.vertices:
                v.co = Vector((v.co.x*self.scale, v.co.y*self.scale, (v.co.z+self.lift)*self.scale))
        self.event('normalise', scale=round(self.scale, 4))

    def bone_point(self, co, bone):
        p = self.warp.point(co, bone)
        return Vector((p.x*self.scale, p.y*self.scale, (p.z+self.lift)*self.scale))

    def armature(self):
        data = bpy.data.armatures.new(self.r['name']+"Rig")
        arm = bpy.data.objects.new(data.name, data)
        bpy.context.collection.objects.link(arm)
        bpy.ops.object.select_all(action='DESELECT')
        arm.select_set(True)
        bpy.context.view_layer.objects.active = arm
        bpy.ops.object.mode_set(mode='EDIT')
        for name, _, head, tail in BONES:
            bone = data.edit_bones.new("mixamorig:"+name)
            bone.head = self.bone_point(head, name)
            bone.tail = self.bone_point(tail, name)
        for name, parent, _, _ in BONES:
            if parent:
                data.edit_bones["mixamorig:"+name].parent = data.edit_bones["mixamorig:"+parent]
        bpy.ops.object.mode_set(mode='OBJECT')
        bpy.ops.object.select_all(action='DESELECT')
        for obj in self.parts:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = self.parts[0]
        bpy.ops.object.join()
        mesh = bpy.context.object
        mesh.name = self.r['name']
        mesh.parent = arm
        mesh.modifiers.new("Armature", "ARMATURE").object = arm
        self.arm, self.mesh = arm, mesh
        self.event('rig', bones=len(data.bones))

    def clips(self):
        arm, hand = self.arm, self.r['game']['weapon_hand']

        def mirror(spec):
            """Swap sides and mirror rotations across the X plane (left-handed weapon)."""
            out = {}
            for name, value in spec.items():
                key = name.replace("Right", "#").replace("Left", "Right").replace("#", "Left")
                rotations = (value,) if isinstance(value[0][0], (int, float)) else value
                out[key] = tuple(((a[0], a[1], a[2]), angle if a[0] else -angle) for a, angle in rotations)
            return out

        def act(name, frames):
            if hand == 'left':
                frames = [(f, mirror(s)) for f, s in frames]
            a = bpy.data.actions.new(name)
            a.use_fake_user = True
            slot = a.slots.new("OBJECT", arm.name)
            arm.animation_data_create()
            arm.animation_data.action = a
            arm.animation_data.action_slot = slot
            for frame, rotations in frames:
                for bone in arm.pose.bones:
                    short = bone.name.split(":")[-1]
                    bone.rotation_mode = 'QUATERNION'
                    spec = rotations.get(short, ((1, 0, 0), 0))
                    spec = (spec,) if isinstance(spec[0][0], (int, float)) else spec
                    rest = arm.data.bones[bone.name].matrix_local.to_3x3()
                    world = Quaternion()
                    for axis, angle in spec:
                        world = Quaternion(Vector(axis), angle) @ world
                    bone.rotation_quaternion = (rest.inverted() @ world.to_matrix() @ rest).to_quaternion()
                    bone.keyframe_insert("rotation_quaternion", frame=frame, group=bone.name)
            for layer in a.layers:
                for strip in layer.strips:
                    for bag in strip.channelbags:
                        for fc in bag.fcurves:
                            for key in fc.keyframe_points:
                                key.interpolation = 'LINEAR'
        idle = {"LeftArm": ((0, 1, 0), .55), "RightArm": ((0, 1, 0), -.55), "LeftForeArm": ((0, 1, 0), .20),
                "RightForeArm": ((0, 1, 0), -.20), "LeftHand": ((0, 1, 0), -.35), "RightHand": ((1, 0, 0), -.25)}

        def gait(phase, amp, arms=.6):
            s = math.sin(phase)
            return {"LeftUpLeg": ((1, 0, 0), amp*s), "RightUpLeg": ((1, 0, 0), -amp*s),
                    "LeftLeg": ((1, 0, 0), max(0, -s)*amp*.8), "RightLeg": ((1, 0, 0), max(0, s)*amp*.8),
                    "LeftArm": (((0, 1, 0), .55), ((1, 0, 0), -amp*s*arms)), "RightArm": (((0, 1, 0), -.55), ((1, 0, 0), amp*s*arms)),
                    "LeftForeArm": ((0, 1, 0), .20), "RightForeArm": ((0, 1, 0), -.20),
                    "LeftHand": ((0, 1, 0), -.35), "RightHand": ((1, 0, 0), -.25)}
        act("idle", [(1, idle), (16, {**idle, "Spine2": ((1, 0, 0), .02), "Head": ((1, 0, 0), .03)}), (31, idle)])
        act("walk", [(1+i*6, gait(i*math.pi/2, .34)) for i in range(5)])
        act("run", [(1+i*4, gait(i*math.pi/2, .60, .9)) for i in range(5)])
        swim = {"Hips": ((1, 0, 0), 1.25), "LeftArm": ((0, 0, 1), -.9), "RightArm": ((0, 0, 1), .9)}
        act("swim", [(1, swim), (8, {**swim, "LeftArm": ((0, 0, 1), -.55), "RightArm": ((0, 0, 1), .55),
                                     "LeftUpLeg": ((1, 0, 0), .2), "RightUpLeg": ((1, 0, 0), -.2)}),
                     (16, {**swim, "LeftArm": ((0, 0, 1), -1.2), "RightArm": ((0, 0, 1), 1.2)}), (24, swim)])
        act("hit", [(1, idle), (4, {**idle, "Spine2": ((0, 0, 1), -.12),
                                    "RightArm": (((0, 1, 0), -.55), ((1, 0, 0), -.9), ((0, 0, 1), .35)),
                                    "RightForeArm": ((0, 1, 0), -.45)}),
                    (8, {**idle, "Spine2": ((0, 0, 1), .14), "RightArm": (((0, 1, 0), -.55), ((1, 0, 0), .85), ((0, 0, 1), -.30)),
                         "RightForeArm": ((1, 0, 0), .5), "RightHand": ((1, 0, 0), -.25)}), (15, idle)])
        act("throw", [(1, idle), (8, {**idle, "Spine2": ((0, 0, 1), -.16), "RightArm": (((0, 1, 0), -.55), ((1, 0, 0), -1.0)),
                                      "RightForeArm": ((0, 1, 0), -.40), "RightHand": ((1, 0, 0), -.25)}),
                      (13, {**idle, "Spine2": ((0, 0, 1), .20), "RightArm": (((0, 1, 0), -.55), ((1, 0, 0), .55)),
                            "RightHand": ((1, 0, 0), .35)}), (23, idle)])
        act("jump", [(1, {**idle, "LeftUpLeg": ((1, 0, 0), -.35), "RightUpLeg": ((1, 0, 0), -.35)}),
                     (9, {**idle, "LeftArm": ((0, 1, 0), .9), "RightArm": ((0, 1, 0), -.9),
                          "LeftUpLeg": ((1, 0, 0), .28), "RightUpLeg": ((1, 0, 0), .28)}), (19, idle)])
        arm.animation_data.action = None
        self.event('animation', clips=list(recipe_lib.CLIPS))

    # ------------------------------------------------------------ checks and export
    def validate(self):
        mesh, arm = self.mesh, self.arm
        problems = []
        if len(arm.data.bones) != 22:
            problems.append(f'{len(arm.data.bones)} bones')
        if not set(recipe_lib.CLIPS) <= set(bpy.data.actions.keys()):
            problems.append('missing clips')
        bad = 0
        for v in mesh.data.vertices:
            total = sum(g.weight for g in v.groups if mesh.vertex_groups[g.group].name in arm.data.bones)
            influences = sum(1 for g in v.groups if g.weight > 0)
            if not .995 <= total <= 1.005 or influences > 4:
                bad += 1
        if bad:
            problems.append(f'{bad} vertices with invalid weights')
        zs = [(mesh.matrix_world @ v.co).z for v in mesh.data.vertices]
        if abs(min(zs)) > .01 or abs(max(zs)-min(zs)-H) > .01:
            problems.append(f'height {min(zs):.3f}..{max(zs):.3f}')
        tris = sum(len(p.vertices)-2 for p in mesh.data.polygons)
        if problems:
            self.event('validate', 'failed', problems=problems)
            raise ValueError('; '.join(problems))
        self.event('validate', triangles=tris, height=round(max(zs)-min(zs), 4))
        return tris

    def export(self, tris):
        blend, glb = self.out/'character.blend', self.out/'character.glb'
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(blend))
        bpy.ops.object.select_all(action='DESELECT')
        self.arm.select_set(True)
        self.mesh.select_set(True)
        bpy.context.view_layer.objects.active = self.arm
        bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', use_selection=True, use_active_scene=True,
                                  export_animations=True, export_skins=True, export_all_influences=False,
                                  export_animation_mode='ACTIONS')
        self.event('export', glb='character.glb', bytes=glb.stat().st_size)
        # Reimport into an empty scene: one rig, one skinned mesh, all clips.
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(glb))
        arms = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
        meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and arms and o.find_armature() == arms[0]]
        clips = set(bpy.data.actions.keys())
        ok = len(arms) == 1 and len(meshes) == 1 and set(recipe_lib.CLIPS) <= clips and len(arms[0].data.bones) == 22
        report = {'schema': 'polpal.engine-build/1', 'status': 'built' if ok else 'failed',
                  'blender_version': bpy.app.version_string, 'recipe_sha256': self.recipe_sha,
                  'glb': 'character.glb', 'glb_sha256': hashlib.sha256(glb.read_bytes()).hexdigest(),
                  'blend': 'character.blend', 'triangles': tris, 'bones': len(arms[0].data.bones) if arms else 0,
                  'clips': sorted(clips & set(recipe_lib.CLIPS)), 'height': H, 'scale_applied': round(self.scale, 4),
                  'reimport': {'armatures': len(arms), 'skinned_meshes': len(meshes)},
                  'likeness_approved': False, 'game_integration': False,
                  'scope': 'Parametric primitive build from the recipe; appearance needs review against the references.'}
        (self.out/'build-report.json').write_text(json.dumps(report, indent=2)+'\n')
        self.event('reimport', 'done' if ok else 'failed', **report['reimport'])
        if not ok:
            raise ValueError('Reimported GLB does not match the game contract')
        return report

    def run(self, recipe_path):
        self.recipe_sha = hashlib.sha256(Path(recipe_path).read_bytes()).hexdigest()
        self.event('start', recipe_sha256=self.recipe_sha, blender=bpy.app.version_string)
        self.body()
        self.face()
        self.hair()
        self.clothing()
        self.accessories()
        self.normalise()
        self.armature()
        self.clips()
        tris = self.validate()
        report = self.export(tris)
        self.event('done', glb='character.glb', triangles=tris)
        return report


def main():
    args = sys.argv[sys.argv.index('--')+1:]
    recipe_path, out = Path(args[0]), Path(args[1])
    recipe = recipe_lib.load(recipe_path)
    out.mkdir(parents=True, exist_ok=True)
    if (out/'character.glb').exists():
        raise FileExistsError(out/'character.glb')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    builder = Builder(recipe, out)
    try:
        builder.run(recipe_path)
    except Exception as error:
        builder.event('error', 'failed', message=str(error)[:400])
        raise


if __name__ == '__main__':
    main()
