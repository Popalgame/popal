# Спільна бібліотека для 3D-моделей попалів (Blender 5.2, bpy). Зразок — Пухоклуб (models/pals/candidates/pukhoklub/build_puff.py).
# Координати «як у грі»: (x, вгору, вперед), лапи на y=0, морда в +z. У Blender: (x, -вперед, вгору); експорт glTF повертає назад.
# Модель = одна сітка зі скелетом. Кольори тіла — у кольорах вершин (градієнт верх→низ, як у грі) × затінення (AO);
# окремі матеріали — лише для очей, світних і металевих деталей.
import bpy, bmesh, math, os, random, json
from mathutils import Vector, Matrix, noise
from mathutils.bvhtree import BVHTree

LIB = os.path.dirname(os.path.abspath(__file__))
S = math.sin; C = math.cos; TAU = 2 * math.pi

def V(x, y, z): return Vector((x, -z, y))
def code(co): return (co.x, co.z, -co.y)
def rotX(a): return Matrix.Rotation(a, 4, 'X')
def rotY(a): return Matrix.Rotation(a, 4, 'Y')   # Blender Y = код −вперед → поворот у площині x/вгору (нахил убік)
def rotZ(a): return Matrix.Rotation(a, 4, 'Z')   # Blender Z = код «вгору» → поворот навколо вертикалі
def about(piv, M): p = V(*piv) if not isinstance(piv, Vector) else piv; return Matrix.Translation(p) @ M @ Matrix.Translation(-p)
def hexrgb(h): return [((h >> s) & 255) / 255 for s in (16, 8, 0)]
def lin(c): return [(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4) for v in c]
def lerp(a, b, t): return [a[i] + (b[i] - a[i]) * t for i in range(3)]

class Pal:
    def __init__(self, key, form=1, ks=1.0, fps=30):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        self.sc = bpy.context.scene; self.sc.render.fps = fps
        self.key, self.form, self.KS = key, form, ks
        self.parts = []      # (obj, weights | callable(code_co)->weights, grad | None)
        self.bones = []      # (name, head, tail, parent, connect)
        self.M = {}
        self.lids = []       # (bone, eye_center, yaw)
        self.mat('Fur', 0xffffff, .82, vc=True)
        self.mat('Ink', 0x2b2236, .3); self.mat('EyeDark', 0x2a1f26, .2); self.mat('Shine', 0xffffff, .1, emis=.6)
        self.mat('Blush', 0xf49a9e, .8); self.mat('Nose', 0x3a2a32, .32)
        self.glass('Cornea')

    # ---------- матеріали ----------
    def mat(self, name, hexc, rough=.8, emis=0, metal=0, vc=False, alpha=1.0, emis_hex=None):
        if name in self.M: return self.M[name]
        m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
        c = lin(hexrgb(hexc)); b.inputs['Base Color'].default_value = (*c, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
        if emis:
            e = lin(hexrgb(emis_hex if emis_hex is not None else hexc)); b.inputs['Emission Color'].default_value = (*e, 1); b.inputs['Emission Strength'].default_value = emis
        if alpha < 1:
            b.inputs['Alpha'].default_value = alpha
            try: m.surface_render_method = 'BLENDED'
            except Exception: m.blend_method = 'BLEND'
        if vc:
            a = m.node_tree.nodes.new('ShaderNodeVertexColor'); a.layer_name = 'Col'; m.node_tree.links.new(a.outputs['Color'], b.inputs['Base Color'])
        self.M[name] = m; return m
    def glass(self, name): return self.mat(name, 0xffffff, .04, alpha=.16)
    def irismat(self, hexc):
        """Текстура райдужки під колір: волокна, світліше біля зіниці, темне кільце-лімб, кругла зіниця."""
        name = 'Iris_%06x' % hexc
        if name in self.M: return name
        Wd = 128; img = bpy.data.images.new(name, Wd, Wd, alpha=False); base = hexrgb(hexc)
        inner = [min(1, v * 1.35 + .12) for v in base]; outer = [v * .55 for v in base]
        rnd = random.Random(hexc); nz = [rnd.random() for _ in range(360)]
        px = [0.0] * (Wd * Wd * 4)
        for y in range(Wd):
            for x in range(Wd):
                dx, dy = (x + .5) / Wd * 2 - 1, (y + .5) / Wd * 2 - 1; r = math.hypot(dx, dy); a = math.atan2(dy, dx)
                if r > 1: col = [.1, .07, .07]
                else:
                    i = int((a + math.pi) / TAU * 359); f = (nz[i] * .6 + nz[(i + 3) % 360] * .4 - .5) * .22 + S(a * 60 + r * 14) * .04
                    t = min(1, max(0, (r - .3) / .62)); col = lerp(inner, base, min(1, t * 1.6)) if t < .6 else lerp(base, outer, (t - .6) / .4)
                    col = [max(0, min(1, v + f)) for v in col]
                    if r > .84: col = lerp(col, [.09, .06, .06], ((r - .84) / .16) ** .8)
                    if r < .27: col = [.05, .035, .045]
                    elif r < .33: col = lerp([.05, .035, .045], col, (r - .27) / .06)
                k = (y * Wd + x) * 4; px[k:k + 4] = [*lin(col), 1]
        img.pixels = px; img.pack()
        m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = img; nt.links.new(t.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = .3
        self.M[name] = m; return name

    # ---------- частини ----------
    def _link(self, me, name, mat, w, grad=None):
        o = bpy.data.objects.new(name, me); self.sc.collection.objects.link(o); o.data.materials.append(self.M[mat])
        for p in me.polygons: p.use_smooth = True
        self.parts.append((o, w, grad)); return o
    def ell(self, name, c, r, w, grad=None, mat='Fur', seg=20, rings=14, rot=None, fluff=0, ffreq=11, piv=None):
        """Еліпсоїд. grad=(колір_верх, колір_низ) — кольори вершин як у грі; rot — Matrix навколо центру (або piv)."""
        me = bpy.data.meshes.new(name); bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1)
        bmesh.ops.transform(bm, matrix=Matrix.Diagonal((r[0], r[2], r[1], 1)), verts=bm.verts)
        if rot is not None: bmesh.ops.transform(bm, matrix=rot, verts=bm.verts)
        bmesh.ops.translate(bm, vec=V(*c), verts=bm.verts)
        bm.to_mesh(me); bm.free()
        o = self._link(me, name, mat, w, grad if grad is not None else (None if mat != 'Fur' else (0xffffff, 0xffffff)))
        if fluff: self.fluff(o, ffreq, fluff, len(self.parts))
        return o
    def tube(self, name, pts, th, w, mat='Fur', grad=None, taper=.7, res=2, caps=True):
        cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
        for i, (p, q) in enumerate(zip(sp.points, pts)): p.co = (*V(*q), 1); p.radius = 1 - taper * i / max(1, len(pts) - 1)
        cu.bevel_depth = th; cu.bevel_resolution = res; cu.use_fill_caps = caps
        o = bpy.data.objects.new(name, cu); self.sc.collection.objects.link(o)
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
        bpy.ops.object.convert(target='MESH'); o = bpy.context.view_layer.objects.active
        o.data.materials.append(self.M[mat])
        for p in o.data.polygons: p.use_smooth = True
        self.parts.append((o, w, grad if grad is not None else (None if mat != 'Fur' else (0xffffff, 0xffffff)))); return o
    def cone(self, name, base, tip, r, w, mat='Fur', grad=None, seg=10, r2=0.0):
        """Конус/шип від base до tip (радіус основи r, вершини r2)."""
        b, t = Vector(V(*base)), Vector(V(*tip)); d = t - b; L = d.length
        me = bpy.data.meshes.new(name); bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=True, segments=seg, radius1=r, radius2=max(r2, .0005), depth=L)
        bmesh.ops.translate(bm, vec=Vector((0, 0, L / 2)), verts=bm.verts)
        q = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
        bmesh.ops.transform(bm, matrix=Matrix.Translation(b) @ q, verts=bm.verts); bm.to_mesh(me); bm.free()
        o = self._link(me, name, mat, w, grad if grad is not None else (None if mat != 'Fur' else (0xffffff, 0xffffff)))
        for p in o.data.polygons: p.use_smooth = False
        return o
    def gem(self, name, c, r, h, w, mat, rot=None):
        me = bpy.data.meshes.new(name); bm = bmesh.new()
        vs = [bm.verts.new(v) for v in ((r, 0, 0), (-r, 0, 0), (0, r, 0), (0, -r, 0), (0, 0, h), (0, 0, -h))]
        for f in ((0, 2, 4), (2, 1, 4), (1, 3, 4), (3, 0, 4), (2, 0, 5), (1, 2, 5), (3, 1, 5), (0, 3, 5)): bm.faces.new([vs[i] for i in f])
        if rot is not None: bmesh.ops.transform(bm, matrix=rot, verts=bm.verts)
        bmesh.ops.translate(bm, vec=V(*c), verts=bm.verts); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
        o = self._link(me, name, mat, w)
        for p in o.data.polygons: p.use_smooth = False
        return o
    def slab(self, name, pts2, plane, d, w, mat='Fur', grad=None, smooth=True):
        """Плоска фігура (вухо, крило, плавник): pts2 — контур (u, v); plane(u, v) -> код-координати; товщина d."""
        me = bpy.data.meshes.new(name); bm = bmesh.new()
        vs = [bm.verts.new(V(*plane(u, v))) for u, v in pts2]; f = bm.faces.new(vs)
        n = f.normal.copy(); r = bmesh.ops.extrude_face_region(bm, geom=[f])
        bmesh.ops.translate(bm, vec=n * d, verts=[e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)])
        bmesh.ops.translate(bm, vec=-n * d / 2, verts=bm.verts); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me); bm.free()
        o = self._link(me, name, mat, w, grad if grad is not None else (None if mat != 'Fur' else (0xffffff, 0xffffff)))
        if not smooth:
            for p in o.data.polygons: p.use_smooth = False
        return o
    def zig(self, name, a, b, n, amp, th, w, mat):
        a, b = Vector(a), Vector(b); d = b - a; side = Vector((-d.z, 0, d.x)).normalized() * amp if abs(d.x) + abs(d.z) > 1e-4 else Vector((amp, 0, 0))
        pts = [tuple(a + d * (i / n) + (side * (1 if i % 2 else -1) if 0 < i < n else Vector())) for i in range(n + 1)]
        return self.tube(name, pts, th, w, mat=mat, taper=.3, res=1)
    def fluff(self, o, freq, amp, seed=0):
        off = Vector((seed * 13.1, seed * 7.7, seed * 3.3))
        for v in o.data.vertices:
            d = noise.voronoi(v.co * freq + off, distance_metric='DISTANCE')[0]
            h = max(0.0, 1 - (d[0] / .9) ** 2) ** .6; v.co += v.normal * (h - .45) * amp
    def blob_union(self, name, blobs, w, grad, voxel=.022, fluff=0, ffreq=9, dec=.06):
        """Кілька еліпсоїдів → одна суцільна гладка сітка (voxel remesh) з необов'язковими клубками й прорідженням."""
        objs = []
        for i, (c, r) in enumerate(blobs):
            o = self.ell('%s_b%d' % (name, i), c, r, None, seg=28, rings=18); self.parts.pop(); objs.append(o)
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs: o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]; bpy.ops.object.join(); o = bpy.context.view_layer.objects.active; o.name = name
        m = o.modifiers.new('R', 'REMESH'); m.mode = 'VOXEL'; m.voxel_size = voxel; bpy.ops.object.modifier_apply(modifier='R')
        if fluff: self.fluff(o, ffreq, fluff, 1)
        m = o.modifiers.new('S', 'SMOOTH'); m.factor = .5; m.iterations = 3; bpy.ops.object.modifier_apply(modifier='S')
        m = o.modifiers.new('D', 'DECIMATE'); m.ratio = dec; bpy.ops.object.modifier_apply(modifier='D')
        for p in o.data.polygons: p.use_smooth = True
        self.parts.append((o, w, grad)); return o

    # ---------- обличчя ----------
    def eyes(self, HC, hr, ex, ey, er, iris, head='Head', yaw=.42, lid_mat='Fur', lid_grad=(0xffffff, 0xffffff)):
        """«Справжні» очі (як у Пухоклуба): темне яблуко, райдужка-текстура, прозора рогівка, відблиск, верхня повіка на кістці.
        HC — центр голови, hr=(rx, ry, rz) — радіуси голови; ex, ey — зсув ока від центру; er — радіус ока."""
        im = self.irismat(iris)
        for s in (-1, 1):
            x = s * ex; zs = hr[2] * math.sqrt(max(.04, 1 - (x / hr[0]) ** 2 - (ey / hr[1]) ** 2))
            EC = (HC[0] + x, HC[1] + ey, HC[2] + zs - er * .66); ERX, ERY = er, er * 1.1
            ry = rotZ(s * yaw)  # поворот ока назовні навколо вертикалі (Blender Z = код «вгору»)
            Mx = about(EC, ry)
            o = self.ell('EyeBall', EC, (ERX, ERY, er * .8), {head: 1}, mat='EyeDark', seg=16, rings=12)
            for v in o.data.vertices: v.co = Mx @ v.co
            me = bpy.data.meshes.new('Iris'); bm = bmesh.new(); bmesh.ops.create_circle(bm, cap_ends=True, cap_tris=True, segments=24, radius=1)
            uvl = bm.loops.layers.uv.new('UVMap')
            for f in bm.faces:
                for l in f.loops: l[uvl].uv = (l.vert.co.x * .5 + .5, l.vert.co.y * .5 + .5)
            for v in bm.verts:
                d = v.co.length; v.co = V(EC[0] + v.co.x * ERX * .86, EC[1] + v.co.y * ERY * .86, EC[2] + er * .77 + (1 - d * d) * .006)
            bm.to_mesh(me); bm.free(); o = self._link(me, 'Iris', im, {head: 1})
            for v in o.data.vertices: v.co = Mx @ v.co
            o = self.ell('Cornea', (EC[0], EC[1], EC[2] + er * .2), (ERX * .92, ERY * .92, er * .72), {head: 1}, mat='Cornea', seg=16, rings=12)
            for v in o.data.vertices: v.co = Mx @ v.co
            o = self.ell('EyeShine', (EC[0] - s * er * .28, EC[1] + er * .44, EC[2] + er * .92), (er * .22, er * .26, er * .1), {head: 1}, mat='Shine', seg=8, rings=6)
            for v in o.data.vertices: v.co = Mx @ v.co
            lid = 'Lid' + ('L' if s < 0 else 'R')
            o = self.ell('Lid', EC, (ERX * 1.14, ERY * 1.14, er * 1.15), {lid: 1}, grad=lid_grad, mat=lid_mat, seg=20, rings=14)
            bm = bmesh.new(); bm.from_mesh(o.data)
            bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < V(*EC).z - ERY * .8], context='VERTS'); bm.to_mesh(o.data); bm.free()
            up = about(EC, rotX(-1.62))
            for v in o.data.vertices: v.co = Mx @ (up @ v.co)
            self.lids.append((lid, EC, s * yaw, head))
    def mouth_w(self, HC, y, z, w=.035, th=.008, head='Head'):
        for s in (-1, 1):
            pts = [(HC[0] + s * w + C(a) * w, HC[1] + y + S(a) * w, HC[2] + z) for a in [math.pi + math.pi * i / 10 for i in range(11)]]
            self.tube('Mouth', pts, th, {head: 1}, mat='Ink', taper=0, res=2)

    # ---------- скелет ----------
    def bone(self, name, head, tail, parent=None, connect=False): self.bones.append((name, head, tail, parent, connect))
    def quad_rig(self, hips, chest, neck, head_top, legs, tail=None, ears=None):
        """Стандартний скелет чотирилапого (назви кісток однакові для всіх). legs: {'LF': (x, y_hip, z), ...}."""
        self.bone('Root', (0, 0, 0), (0, 0, .3))
        self.bone('Base', hips, chest, 'Root')
        self.bone('Chest', chest, (chest[0], chest[1] + .06, chest[2] + .3), 'Base', True)
        self.bone('Neck', neck, (neck[0], neck[1] + .12, neck[2] + .14), 'Chest')
        self.bone('Head', (neck[0], neck[1] + .12, neck[2] + .14), head_top, 'Neck', True)
        for k, (x, y, z) in legs.items():
            par = 'Chest' if k[1] == 'F' else 'Base'; knee = y * .5
            self.bone('Leg' + k, (x, y, z), (x, knee, z), par); self.bone('Leg' + k + '2', (x, knee, z), (x, .02, z + .02), 'Leg' + k, True)
        if tail:
            prev = 'Base'
            for i in range(len(tail) - 1):
                n = 'Tail' + ('' if i == 0 else str(i + 1)); self.bone(n, tail[i], tail[i + 1], prev, i > 0); prev = n
        if ears:
            for nm, (h, t) in ears.items(): self.bone(nm, h, t, 'Head')

    # ---------- збирання ----------
    def build(self, ao_dist=.32, ao_k=.68, noao=('EyeDark', 'Cornea', 'Shine', 'Ink')):
        for nm, ec, yaw, head in self.lids:
            self.bone(nm, ec, (ec[0] + S(yaw) * .12, ec[1], ec[2] + C(yaw) * .12), head)
        sc = self.sc
        arm_data = bpy.data.armatures.new(self.key + 'Rig'); arm = bpy.data.objects.new(self.key + '_Rig', arm_data); sc.collection.objects.link(arm)
        bpy.context.view_layer.objects.active = arm; arm.select_set(True); bpy.ops.object.mode_set(mode='EDIT'); E = arm_data.edit_bones
        for n, h, t, p, cn in self.bones:
            b = E.new(n); b.head = V(*h) * self.KS; b.tail = V(*t) * self.KS; b.roll = 0
            if p: b.parent = E[p]; b.use_connect = cn
        bpy.ops.object.mode_set(mode='OBJECT')
        names = [b.name for b in arm_data.bones]
        # ваги + кольори частин (до об'єднання: кожна частина має свої межі для градієнта)
        for o, w, grad in self.parts:
            for b in names: o.vertex_groups.new(name=b)
            ys = [v.co.z for v in o.data.vertices] or [0]; y0, y1 = min(ys), max(ys)
            col = o.data.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
            for v in o.data.vertices:
                ww = w(code(v.co)) if callable(w) else (w or {})
                tot = sum(ww.values()) or 1
                for b, x in ww.items():
                    if x > 1e-4: o.vertex_groups[b].add([v.index], x / tot, 'REPLACE')
                if grad:
                    t = (v.co.z - y0) / max(1e-5, y1 - y0); c = lerp(hexrgb(grad[1]), hexrgb(grad[0]), t ** .9)
                else: c = [1, 1, 1]
                col.data[v.index].color = (*lin(c), 1)
        bpy.ops.object.select_all(action='DESELECT')
        for o, _, _ in self.parts: o.select_set(True)
        bpy.context.view_layer.objects.active = self.parts[0][0]; bpy.ops.object.join()
        mesh = bpy.context.view_layer.objects.active; mesh.name = self.key
        for v in mesh.data.vertices: v.co = v.co * self.KS
        # затінення (AO) у кольорах вершин
        me = mesh.data; bvh = BVHTree.FromPolygons([v.co.copy() for v in me.vertices], [tuple(p.vertices) for p in me.polygons])
        DIRS = []
        for i in range(18):
            u, w_ = (i + .5) / 18, (i * .618034) % 1; r_ = math.sqrt(u); a_ = TAU * w_
            DIRS.append(Vector((r_ * C(a_), r_ * S(a_), math.sqrt(max(0, 1 - u)))))
        vm = {}
        for p in me.polygons:
            for vi in p.vertices: vm.setdefault(vi, set()).add(me.materials[p.material_index].name)
        AOD = ao_dist * self.KS; col = me.color_attributes['Col']
        for v in me.vertices:
            mats = vm.get(v.index, set())
            if mats and all(m in noao or m.startswith('Iris') for m in mats): continue
            n = v.normal; t = n.orthogonal().normalized(); b = n.cross(t); o = v.co + n * .006; occ = 0.0
            for d in DIRS:
                dd = (t * d.x + b * d.y + n * d.z).normalized(); hit, _, _, dist = bvh.ray_cast(o, dd, AOD)
                if hit is not None: occ += (1 - dist / AOD) ** .7
            a = 1 - ao_k * min(1, occ / len(DIRS) * 1.8); c = col.data[v.index].color
            col.data[v.index].color = (c[0] * a ** .85, c[1] * a ** .95, c[2] * a ** 1.1, 1)
        me.color_attributes.active_color = col
        mesh.parent = arm; md = mesh.modifiers.new('Armature', 'ARMATURE'); md.object = arm
        bpy.context.view_layer.objects.active = mesh; bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
        bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
        bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
        bpy.ops.object.mode_set(mode='OBJECT')
        self.arm, self.mesh = arm, mesh
        bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='POSE')
        for p in arm.pose.bones: p.rotation_mode = 'XYZ'
        self.ad = arm.animation_data_create(); self.PB = arm.pose.bones
        return self

    # ---------- кліпи ----------
    def clip(self, name, frames, keys):
        """keys: {bone: {'rot': [(f, (x,y,z))], 'loc': [...], 'scl': [...]}}; кістки, яких немає, пропускаються."""
        PB, ad = self.PB, self.ad
        act = bpy.data.actions.new(name); ad.action = act
        for p in PB: p.rotation_euler = (0, 0, 0); p.location = (0, 0, 0); p.scale = (1, 1, 1)
        for b, ch in keys.items():
            if b not in PB: continue
            p = PB[b]
            for kind, path in (('rot', 'rotation_euler'), ('loc', 'location'), ('scl', 'scale')):
                for f, val in ch.get(kind, []):
                    setattr(p, path, val); p.keyframe_insert(path, frame=f)
            p.rotation_euler = (0, 0, 0); p.location = (0, 0, 0); p.scale = (1, 1, 1)
        tr = ad.nla_tracks.new(); tr.name = name; st = tr.strips.new(name, 1, act); st.name = name; ad.action = None
        return act
    def export(self, out, fname):
        bpy.ops.object.mode_set(mode='OBJECT')
        for p in self.PB: p.rotation_euler = (0, 0, 0); p.location = (0, 0, 0); p.scale = (1, 1, 1)
        os.makedirs(out, exist_ok=True)
        bpy.ops.file.pack_all(); bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, fname + '.blend'))
        bpy.ops.object.select_all(action='DESELECT'); self.arm.select_set(True); self.mesh.select_set(True); bpy.context.view_layer.objects.active = self.arm
        glb = os.path.join(out, fname + '.glb')
        bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, use_active_scene=True, export_skins=True, export_all_influences=False,
                                  export_animations=True, export_animation_mode='NLA_TRACKS', export_apply=False, export_yup=True)
        tris = sum(len(p.vertices) - 2 for p in self.mesh.data.polygons)
        print('BUILT', glb, 'tris', tris, 'bones', len(self.arm.data.bones), 'mats', len(self.mesh.data.materials))
        return glb, tris

def attacks(key):
    return json.load(open(os.path.join(LIB, 'attacks.json')))[key]
