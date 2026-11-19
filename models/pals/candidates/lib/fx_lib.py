# Ефекти атак попалів — окремий GLB на попала, кліпи atk_1..atk_9 (порядок як у pal-growth.js: 1 — стандартна, 2–5 — слот 2, 6–9 — слот 3).
# Ефект = жорсткі сітки на своїх кістках; поява/зникнення — масштаб кістки (0 = сховано). Тривалість кліпу = тривалість руху тіла (body_clips.DUR).
# Початок координат — лапи попала, морда в +z. Ціль: дальні атаки — 2,6 м попереду, ближні — 1,7 м. У грі корінь ефекту ставиться до цілі/попала.
import bpy, bmesh, math, os, random, sys, colorsys
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pal_lib import V, hexrgb, lin, TAU, S, C
from body_clips import DUR, kind_of

ELEMS = [  # (стихія, слова в назві атаки)
    ('electric', ('блискав', 'гром', 'розряд', 'іскр', 'грозов')), ('ice', ('крижан', 'град', 'мороз', 'ожеледь', 'хуртовин', 'нуль', 'лід')),
    ('fire', ('вогн', 'лав', 'плазм', 'пекельн', 'жарин', 'полум', 'сонячн', 'фенікс', 'палаюч', 'вулкан', 'тлію', 'зоряний', 'сліпуч', 'вінець')),
    ('smoke', ('дим', 'попел')), ('water', ('вод', 'хвил', 'вир', 'цунамі', 'прилив', 'струмін', 'глибин', 'акул')),
    ('grass', ('бамбук', 'лист', 'коріння', 'гай', 'панда')), ('crystal', ('кристал', 'самоцвіт')),
    ('shadow', ('тін', 'безодн', 'сутін', 'міраж', 'примар', 'прокля', 'чорне')), ('earth', ('кам', 'земл', 'обвал', 'гірськ')),
    ('pollen', ('пилк', 'квітк', 'метелик', 'веселк', 'сонн')), ('coral', ('корал', 'мушл', 'перл', 'клешн', 'риф')),
    ('air', ('буревій', 'крил', 'вихор', 'смерч', 'шквал', 'перо', 'пер ')), ('wool', ('пух', 'хмар', 'колиск'))]
PAL_ELEM = {'bambuzl': 'grass', 'grumrok': 'crystal', 'ignis': 'fire', 'mirazhbr': 'shadow', 'pukhoklub': 'wool', 'krylosha': 'pollen', 'mororyh': 'ice',
            'hrozovyk': 'electric', 'khvylezub': 'water', 'sontseklyv': 'fire', 'popeliukh': 'fire', 'koralovyk': 'coral', 'zemleryi': 'earth'}
def elem_of(pal, a):
    n = a['n'].lower()
    for e, words in ELEMS:
        if any(w in n for w in words): return e
    return PAL_ELEM.get(pal, 'wool')
# поведінка частинок у вибуху по площі: rise — з-під землі вгору, fall — згори, orbit — кружляють
AOE_MODE = {'fire': 'rise', 'crystal': 'rise', 'grass': 'rise', 'water': 'rise', 'smoke': 'rise', 'earth': 'fall', 'ice': 'fall', 'coral': 'fall',
            'shadow': 'orbit', 'pollen': 'orbit', 'air': 'orbit', 'wool': 'orbit', 'electric': 'bolts'}
GLOW = {'fire': 0xffb347, 'ice': 0x7fd8ff, 'electric': 0xfff27a, 'water': 0x7fdcff, 'grass': 0xb6f27c, 'crystal': 0x9ff0ff, 'earth': 0xe8c38a,
        'shadow': 0xb48cff, 'pollen': 0xffe68a, 'coral': 0xffb3c8, 'air': 0xeaf6ff, 'wool': 0xffffff, 'smoke': 0xffa860}

def vivid(col):
    """Надто світлий колір (лід, пилок, біле) — насиченіший і темніший, щоб ефект читався і на світлій землі."""
    r, g, b = [((col >> s) & 255) / 255 for s in (16, 8, 0)]; h, s_, v = colorsys.rgb_to_hsv(r, g, b)
    if .3 * r + .59 * g + .11 * b < .62: return col
    s_ = min(1, s_ * 1.6 + .25); v = min(v, .9); r, g, b = colorsys.hsv_to_rgb(h, s_, v)
    return (int(r * 255) << 16) | (int(g * 255) << 8) | int(b * 255)

class Fx:
    def __init__(self, pal):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        self.sc = bpy.context.scene; self.sc.render.fps = 30; self.pal = pal
        self.parts = []; self.bones = {}; self.M = {}; self.clips = {}; self.step = set()
    def mat(self, key, hexc, emis=0, alpha=1.0, rough=.5):
        name = '%s_%06x_%s_%s' % (key, hexc, emis, alpha)
        if name in self.M: return name
        m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']; c = lin(hexrgb(hexc))
        b.inputs['Base Color'].default_value = (*c, 1); b.inputs['Roughness'].default_value = rough
        if emis: b.inputs['Emission Color'].default_value = (*c, 1); b.inputs['Emission Strength'].default_value = emis
        if alpha < 1:
            b.inputs['Alpha'].default_value = alpha
            try: m.surface_render_method = 'BLENDED'
            except Exception: m.blend_method = 'BLEND'
        self.M[name] = m; return name
    def bone(self, name, c): self.bones.setdefault(name, c); return name
    def _link(self, me, name, mat, bone, smooth=True):
        o = bpy.data.objects.new(name, me); self.sc.collection.objects.link(o); o.data.materials.append(self.M[mat])
        for p in me.polygons: p.use_smooth = smooth
        self.parts.append((o, bone)); return o
    # ---------- примітиви ----------
    def ell(self, name, c, r, mat, bone, seg=10, rings=7):
        me = bpy.data.meshes.new(name); bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1)
        bmesh.ops.transform(bm, matrix=Matrix.Diagonal((r[0], r[2], r[1], 1)), verts=bm.verts); bmesh.ops.translate(bm, vec=V(*c), verts=bm.verts)
        bm.to_mesh(me); bm.free(); return self._link(me, name, mat, bone)
    def cone(self, name, base, tip, r, mat, bone, seg=8):
        b, t = Vector(V(*base)), Vector(V(*tip)); d = t - b; L = d.length
        me = bpy.data.meshes.new(name); bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=True, segments=seg, radius1=r, radius2=.0005, depth=L)
        bmesh.ops.translate(bm, vec=Vector((0, 0, L / 2)), verts=bm.verts)
        q = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
        bmesh.ops.transform(bm, matrix=Matrix.Translation(b) @ q, verts=bm.verts); bm.to_mesh(me); bm.free(); return self._link(me, name, mat, bone, False)
    def gem(self, name, c, r, h, mat, bone, tilt=0.0):
        me = bpy.data.meshes.new(name); bm = bmesh.new()
        vs = [bm.verts.new(v) for v in ((r, 0, 0), (-r, 0, 0), (0, r, 0), (0, -r, 0), (0, 0, h), (0, 0, -h))]
        for f in ((0, 2, 4), (2, 1, 4), (1, 3, 4), (3, 0, 4), (2, 0, 5), (1, 2, 5), (3, 1, 5), (0, 3, 5)): bm.faces.new([vs[i] for i in f])
        if tilt: bmesh.ops.transform(bm, matrix=Matrix.Rotation(tilt, 4, 'X'), verts=bm.verts)
        bmesh.ops.translate(bm, vec=V(*c), verts=bm.verts); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
        return self._link(me, name, mat, bone, False)
    def rock(self, name, c, r, mat, bone, seed=0):
        me = bpy.data.meshes.new(name); bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r); rnd = random.Random(seed)
        for v in bm.verts: v.co *= .75 + rnd.random() * .5
        bmesh.ops.translate(bm, vec=V(*c), verts=bm.verts); bm.to_mesh(me); bm.free(); return self._link(me, name, mat, bone, False)
    def tube(self, name, pts, th, mat, bone, taper=.6, res=1):
        cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
        for i, (p, q) in enumerate(zip(sp.points, pts)): p.co = (*V(*q), 1); p.radius = 1 - taper * i / max(1, len(pts) - 1)
        cu.bevel_depth = th; cu.bevel_resolution = res; cu.use_fill_caps = True
        o = bpy.data.objects.new(name, cu); self.sc.collection.objects.link(o)
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
        bpy.ops.object.convert(target='MESH'); o = bpy.context.view_layer.objects.active; o.data.materials.append(self.M[mat])
        for p in o.data.polygons: p.use_smooth = True
        self.parts.append((o, bone)); return o
    def ring(self, name, c, R, th, mat, bone, seg=32, axis='y'):
        """Тор: axis='y' — лежить на землі, 'z' — стоїть, дивиться вперед."""
        me = bpy.data.meshes.new(name); bm = bmesh.new(); rs = 6; rows = []
        for i in range(seg):
            a = i / seg * TAU; row = []
            for j in range(rs):
                b = j / rs * TAU; r = R + C(b) * th; h = S(b) * th * .6
                p = (c[0] + C(a) * r, c[1] + h, c[2] + S(a) * r) if axis == 'y' else (c[0] + C(a) * r, c[1] + S(a) * r, c[2] + h)
                row.append(bm.verts.new(V(*p)))
            rows.append(row)
        for i in range(seg):
            for j in range(rs): bm.faces.new((rows[i][j], rows[(i + 1) % seg][j], rows[(i + 1) % seg][(j + 1) % rs], rows[i][(j + 1) % rs]))
        bm.normal_update(); bm.to_mesh(me); bm.free(); return self._link(me, name, mat, bone)
    def bolt(self, name, top, bot, mat, glow, bone, seed, th=.06):
        rnd = random.Random(seed); n = 7; pts = []
        for i in range(n + 1):
            t = i / n; j = 0 if i in (0, n) else 1
            pts.append((top[0] + (bot[0] - top[0]) * t + j * rnd.uniform(-.2, .2), top[1] + (bot[1] - top[1]) * t, top[2] + (bot[2] - top[2]) * t + j * rnd.uniform(-.2, .2)))
        self.tube(name, pts, th, mat, bone, .5); self.tube(name + 'G', pts, th * 2.3, glow, bone, .45)
    def heart(self, name, c, s, mat, bone):
        me = bpy.data.meshes.new(name); bm = bmesh.new(); pts = []
        for i in range(20):
            t = i / 20 * TAU; x = 16 * S(t) ** 3; y = 13 * C(t) - 5 * C(2 * t) - 2 * C(3 * t) - C(4 * t)
            pts.append(bm.verts.new(V(c[0] + x / 17 * s, c[1] + y / 17 * s, c[2])))
        f = bm.faces.new(pts); r = bmesh.ops.extrude_face_region(bm, geom=[f])
        bmesh.ops.translate(bm, vec=V(0, 0, -.1 * s), verts=[e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free(); return self._link(me, name, mat, bone, False)
    def leaf(self, name, c, s, mat, bone, yaw=0.0):
        me = bpy.data.meshes.new(name); bm = bmesh.new(); pts = []
        for i in range(12):
            t = i / 12 * TAU; u, v = S(t) * .35, C(t)
            x, y = u * C(yaw), v; pts.append(bm.verts.new(V(c[0] + x * s, c[1] + y * s, c[2] + u * S(yaw) * s)))
        f = bm.faces.new(pts); r = bmesh.ops.extrude_face_region(bm, geom=[f]); n = f.normal.copy()
        bmesh.ops.translate(bm, vec=n * .02, verts=[e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free(); return self._link(me, name, mat, bone, False)
    def fluffy(self, name, c, r, mat, bone, n=4, seed=0):
        rnd = random.Random(seed); self.ell(name, c, (r, r * .85, r), mat, bone)
        for i in range(n):
            a = i / n * TAU + rnd.random() * .5; rr = r * (.55 + rnd.random() * .25)
            self.ell(name, (c[0] + C(a) * r * .75, c[1] + rnd.uniform(-.2, .35) * r, c[2] + S(a) * r * .75), (rr, rr * .9, rr), mat, bone, 8, 6)
    # ---------- частинка стихії ----------
    def particle(self, el, name, c, s, col, bone, seed=0):
        main = self.mat('p', col, 1.2 if el in ('fire', 'electric', 'crystal', 'pollen', 'shadow', 'ice') else .2)
        glow = self.mat('g', GLOW.get(el, col), 1.8, .35)
        if el == 'fire':
            self.cone(name, (c[0], c[1] - s * .4, c[2]), (c[0], c[1] + s * .9, c[2]), s * .45, self.mat('p', 0xff7a2a, 2.0), bone)
            self.cone(name, (c[0], c[1] - s * .35, c[2]), (c[0], c[1] + s * .45, c[2]), s * .28, self.mat('p', 0xffe066, 2.5), bone)
        elif el in ('ice', 'crystal'):
            self.gem(name, c, s * .45, s * 1.0, self.mat('p', col if el == 'crystal' else 0x5cc4f4, 1.2, .9, .15), bone, tilt=random.Random(seed).uniform(-.5, .5))
            self.gem(name + 'G', c, s * .6, s * 1.2, glow, bone)
        elif el == 'electric':
            self.bolt(name, (c[0], c[1] + s * .8, c[2]), (c[0] + s * .2, c[1] - s * .8, c[2]), self.mat('p', 0xfffbe0, 3.5), self.mat('g', col, 2.2, .5), bone, seed, th=s * .1)
        elif el == 'water':
            self.ell(name, c, (s * .35, s * .5, s * .35), self.mat('p', col, .6, .85, .1), bone)
        elif el == 'grass':
            self.leaf(name, c, s, self.mat('p', 0x7ccf4a, .4), bone, yaw=seed * 1.3)
        elif el == 'earth':
            self.rock(name, c, s * .5, self.mat('p', 0x9a7a5a, 0, 1, .95), bone, seed)
        elif el == 'shadow':
            self.ell(name, c, (s * .4, s * .4, s * .4), self.mat('p', 0x2a1a40, .6), bone); self.ell(name + 'G', c, (s * .6, s * .6, s * .6), glow, bone)
        elif el == 'pollen':
            self.ell(name, c, (s * .25, s * .25, s * .25), self.mat('p', 0xffe14a, 1.5), bone, 8, 6); self.ell(name + 'G', c, (s * .45, s * .45, s * .45), glow, bone, 8, 6)
        elif el == 'coral':
            self.ell(name, c, (s * .4, s * .25, s * .35), self.mat('p', 0xffc0d0, .3), bone); self.ell(name + 'P', (c[0], c[1] + s * .1, c[2]), (s * .16, s * .16, s * .16), self.mat('p', 0xfff8f0, .6, 1, .1), bone, 8, 6)
        elif el == 'smoke':
            self.fluffy(name, c, s * .45, self.mat('p', 0x6a6470, .1, .8, 1), bone, 3, seed)
        elif el == 'air':
            self.ring(name, c, s * .45, s * .05, self.mat('p', 0xeaf6ff, .8, .7), bone, 20, 'z')
        else:
            self.fluffy(name, c, s * .45, self.mat('p', 0xf6f0e4, .15), bone, 3, seed)

    # ---------- кліпи ----------
    def clip(self, name, frames, keys):
        self.clips[name] = (frames, keys)
    # ключі: (кадр, зсув (x, вгору, вперед) або None, масштаб або None[, оберт])
    def build_attack(self, idx, a):
        el = elem_of(self.pal, a); kind = kind_of(a); F = DUR[kind]; col = vivid(int(a['c'][1:], 16))
        if el in ('wool',) and col == 0xfff4fa: col = 0xf6f0e4
        P = 'A%d_' % idx; k = {}; rnd = random.Random(idx * 17 + len(self.pal))
        MOUTH = (0, 1.0, .95); TG = (0, 0, 2.6); TM = (0, 0, 1.7)
        ringm = self.mat('r', col if el not in ('wool',) else GLOW[el], 2.2, .75)
        def burst(c, f0, n=5, s=.18, spread=.9, tag='B'):
            for i in range(n):
                an = i / n * TAU; b = self.bone(P + tag + str(i), c); self.particle(el, b, c, s, col, b, i)
                k[b] = [(1, (0, 0, 0), 0), (f0, (0, 0, 0), 0), (f0 + 1, (0, 0, 0), 1), (f0 + 6, (C(an) * spread, .45, S(an) * spread), 1), (f0 + 11, (C(an) * spread * 1.4, 0, S(an) * spread * 1.4), 0)]
        def gring(c, f0, f1, R=.7, scale=1.8, tag='R', axis='y'):
            b = self.bone(P + tag, c); self.ring(b, c, R, .05, ringm, b, 36, axis)
            k[b] = [(1, None, 0), (f0, None, 0), (f0 + 1, None, .3), (f1, None, scale), (f1 + 1, None, 0)]
        if kind in ('shot', 'multi'):
            n = 1 if kind == 'shot' else max(3, min(5, a.get('cnt') or 3))
            for i in range(n):
                f0 = 11 if kind == 'shot' else 9 + 9 * i
                dx = 0 if n == 1 else (i - (n - 1) / 2) * .45
                b = self.bone(P + 'Proj%d' % i, MOUTH); s = .42 if kind == 'shot' else .3
                self.particle(el, b, MOUTH, s, col, b, i); self.ell(b + 'Gl', MOUTH, (s * .7, s * .7, s * .7), self.mat('g', GLOW.get(el, col), 1.6, .3), b, 10, 7)
                k[b] = [(1, (0, 0, 0), 0), (f0 - 1, (0, 0, 0), 0), (f0, (0, 0, 0), 1, (0, 0, 0)), (f0 + 5, (dx * .5, .35, .8), 1, (0, 3, 0)), (f0 + 11, (dx, -.2, 1.65), 1, (0, 6, 0)), (f0 + 12, (dx, -.2, 1.65), 0)]
                gring((TG[0] + dx, .03, TG[2]), f0 + 11, f0 + 18, .45, 1.6, 'R%d' % i)
            burst((TG[0], .5, TG[2]), (11 if kind == 'shot' else 9 + 9 * (n - 1)) + 11, 5)
        elif kind == 'beam':
            b = self.bone(P + 'Beam', MOUTH); L = 1.75
            if el == 'electric':
                for j in range(2):
                    bb = self.bone(P + 'Beam%d' % j, MOUTH); self.bolt(bb, MOUTH, (MOUTH[0], .5, MOUTH[2] + L), self.mat('p', 0xfffbe0, 4.0), self.mat('g', col, 2.4, .5), bb, 40 + j, .09)
                    k[bb] = [(1, None, 0)] + [(10 + 3 * i, None, 1 if (i + j) % 2 == 0 else 0) for i in range(11)] + [(44, None, 0)]
                    self.step.add(bb)
            else:
                pts = [(MOUTH[0], MOUTH[1] - .5 * t * t, MOUTH[2] + L * t) for t in (0, .5, 1)]
                self.tube(b, pts, .09, self.mat('p', col, 2.0, .9), b, 0, 2); self.tube(b + 'G', pts, .2, self.mat('g', GLOW.get(el, col), 1.6, .3), b, 0, 2)
                k[b] = [(1, None, 0), (9, None, 0), (12, None, 1)] + [(14 + 3 * i, None, 1.12 if i % 2 else .92) for i in range(9)] + [(42, None, 1), (45, None, 0)]
            gring((0, .03, TG[2] - .2), 12, 40, .5, 1.4)
            for i in range(4):
                c = (rnd.uniform(-.3, .3), .2, TG[2] - .2 + rnd.uniform(-.3, .3)); bb = self.bone(P + 'Hit%d' % i, c); self.particle(el, bb, c, .2, col, bb, i)
                f0 = 14 + 6 * i; k[bb] = [(1, (0, 0, 0), 0), (f0, (0, 0, 0), 0), (f0 + 1, (0, 0, 0), 1), (f0 + 8, (0, .6, 0), 0)]
        elif kind in ('melee', 'dash'):
            T = (0, .9, 2.25) if kind == 'dash' else (0, .85, 1.65); f0 = 13 if kind == 'dash' else 10
            sl = self.mat('p', col, 2.6, .9); core = self.mat('p', 0xffffff, 2.0)
            for i in range(3):
                b = self.bone(P + 'Slash%d' % i, T); y0 = T[1] + .25 - .25 * i
                pts = [(T[0] + C(an) * .5, y0 + S(an) * .28, T[2] + .1) for an in [math.pi * (.15 + .7 * j / 8) for j in range(9)]]
                self.tube(b, pts, .06, sl, b, .9); self.tube(b + 'C', pts, .025, core, b, .9)
                k[b] = [(1, None, 0), (f0 + i, None, 0), (f0 + i + 1, None, 1.15), (f0 + i + 5, None, 1), (f0 + i + 8, None, 0)]
            burst(T, f0 + 2, 4, .16, .6)
            if kind == 'dash':
                for i in range(3):
                    c = (-.35 + .35 * i, .12, -.5); b = self.bone(P + 'Dust%d' % i, c); self.particle('smoke' if el not in ('wool',) else 'wool', b, c, .35, col, b, i)
                    k[b] = [(1, (0, 0, 0), 0), (5, (0, 0, 0), 0), (8, (0, .1, -.15), 1.1), (14, (0, .25, -.3), 0)]
        elif kind == 'aoe':
            R = a.get('R') or 3.0; mode = AOE_MODE.get(el, 'orbit'); gring((TG[0], .03, TG[2]), 14, 40, min(1.2, R * .32), 1.5)
            if mode == 'bolts':
                SC = (TG[0], 3.0, TG[2]); b = self.bone(P + 'Cloud', SC); self.fluffy(b, SC, .5, self.mat('p', 0x56688f, 0, 1, .95), b, 6, idx)
                k[b] = [(1, (0, 0, 0), 0), (6, (0, .3, 0), 0), (12, (0, 0, 0), 1), (44, (0, .05, 0), 1), (52, (0, .2, 0), 0)]
                for j, ((dx, dz), (a0, a1)) in enumerate(zip(((-.25, .1), (.3, -.15), (0, .3)), ((16, 21), (23, 28), (30, 37)))):
                    bb = self.bone(P + 'Bolt%d' % j, (TG[0] + dx * 1.6, 1.4, TG[2] + dz * 1.6))
                    self.bolt(bb, (SC[0] + dx, SC[1] - .35, SC[2] + dz), (TG[0] + dx * 1.6, 0, TG[2] + dz * 1.6), self.mat('p', 0xfffbe0, 4.0), self.mat('g', col, 2.4, .45), bb, 30 + j, .08)
                    k[bb] = [(1, None, 0), (a0, None, 1), (a0 + 2, None, 0), (a0 + 3, None, 1), (a1, None, 0)]; self.step.add(bb)
                burst((TG[0], .2, TG[2]), 16, 6, .14, 1.0)
            else:
                n = 7
                for i in range(n):
                    an = i / n * TAU + .3; rr = .25 + .45 * ((i * 7) % 5) / 4
                    c = (TG[0] + C(an) * rr, 0 if mode == 'rise' else (2.8 if mode == 'fall' else 1.0), TG[2] + S(an) * rr)
                    b = self.bone(P + 'P%d' % i, c); self.particle(el, b, c, .45 if mode != 'orbit' else .3, col, b, i); f0 = 14 + 3 * i
                    if mode == 'rise': k[b] = [(1, (0, -.3, 0), 0), (f0, (0, -.3, 0), 0), (f0 + 3, (0, .25, 0), 1.2), (f0 + 10, (0, .6, 0), 1), (f0 + 16, (0, .9, 0), 0)]
                    elif mode == 'fall': k[b] = [(1, (0, 0, 0), 0), (f0, (0, 0, 0), 0), (f0 + 1, (0, 0, 0), 1, (0, 0, 0)), (f0 + 9, (0, -2.6, 0), 1, (1.2, 0, .6)), (f0 + 10, (0, -2.6, 0), 1.3), (f0 + 13, (0, -2.6, 0), 0)]
                    else:
                        kk = [(1, (0, 0, 0), 0), (f0, (0, 0, 0), 0), (f0 + 2, (0, 0, 0), 1)]
                        for j in range(1, 6):
                            a2 = an + j * .9; kk.append((f0 + 2 + 4 * j, (C(a2) * rr - C(an) * rr, .15 * S(j), S(a2) * rr - S(an) * rr), 1))
                        kk.append((f0 + 26, (0, .4, 0), 0)); k[b] = kk
                if mode == 'fall' or el in ('ice', 'pollen', 'smoke'):
                    SC = (TG[0], 3.0, TG[2]); b = self.bone(P + 'Cloud', SC)
                    self.fluffy(b, SC, .45, self.mat('p', {'ice': 0xcfe8f8, 'pollen': 0xffe9a8, 'smoke': 0x6a6470, 'earth': 0xb59a7a, 'coral': 0x7fc8e8}.get(el, 0xdddddd), .1, .9, 1), b, 5, idx)
                    k[b] = [(1, (0, 0, 0), 0), (6, (0, .3, 0), 0), (12, (0, 0, 0), 1), (44, (0, .05, 0), 1), (52, (0, .2, 0), 0)]
        elif kind == 'nova':
            R = a.get('R') or 3.0
            for j, f0 in enumerate((8, 16)):
                gring((0, .05, .1), f0, f0 + 16, .6, min(4.5, R * .9 / .6) * .55, 'N%d' % j)
            for i in range(8):
                an = i / 8 * TAU; c = (C(an) * .5, .6, .1 + S(an) * .5); b = self.bone(P + 'Rad%d' % i, c); self.particle(el, b, c, .3, col, b, i)
                k[b] = [(1, (0, 0, 0), 0), (9, (0, 0, 0), 0), (11, (0, 0, 0), 1.1), (24, (C(an) * 1.6, .1, S(an) * 1.6), 1, (0, 2, 0)), (30, (C(an) * 2.0, -.3, S(an) * 2.0), 0)]
        elif kind == 'dot':
            SG = (TG[0], 1.7, TG[2]); b = self.bone(P + 'Sigil', SG); self.ring(b, SG, .5, .06, ringm, b, 28); self.ring(b + 'In', SG, .3, .035, ringm, b, 24)
            self.gem(b + 'Gm', SG, .1, .18, self.mat('p', col, 1.8), b)
            k[b] = [(1, None, 0, (0, 0, 0)), (8, None, 0, (0, 0, 0)), (12, None, 1.1, (0, 1, 0)), (14, None, 1, (0, 1.5, 0)), (30, None, 1, (0, 5, 0)), (34, None, 0, (0, 6, 0))]
            for i in range(5):
                an = i / 5 * TAU; c = (TG[0] + C(an) * .3, .3, TG[2] + S(an) * .3); bb = self.bone(P + 'Tick%d' % i, c); self.particle(el, bb, c, .25, col, bb, i)
                kk = [(1, (0, 0, 0), 0)]
                for cy in range(3):
                    t0 = 10 + cy * 8 + i
                    if t0 + 7 > F: break
                    kk += [(t0 - 1, (0, 0, 0), 0), (t0, (0, 0, 0), 1), (t0 + 6, (0, .7, 0), .6), (t0 + 7, (0, .7, 0), 0)]
                k[bb] = kk
        elif kind == 'heal':
            gring((0, .05, 0), 6, 30, .9, 1.5)
            pink = el in ('wool', 'pollen') or col in (0xffa8c8,)
            for i in range(6):
                an = i / 6 * TAU; c = (C(an) * .55, 1.1, S(an) * .55); b = self.bone(P + 'H%d' % i, c)
                if pink: self.heart(b, c, .14, self.mat('p', 0xff8fbf, 1.2), b)
                elif el == 'grass': self.leaf(b, c, .22, self.mat('p', 0x8fe05a, .8), b, i)
                else: self.gem(b, c, .07, .14, self.mat('p', GLOW.get(el, col), 1.8), b)
                f0 = 10 + 2 * i; k[b] = [(1, (0, 0, 0), 0), (f0, (0, 0, 0), 0), (f0 + 3, (0, .15, 0), 1.1, (0, 0, 0)), (f0 + 18, (C(an) * .4, 1.1, S(an) * .4), 1, (0, 2, 0)), (f0 + 24, (C(an) * .5, 1.4, S(an) * .5), 0, (0, 2.6, 0))]
        elif kind == 'shield':
            b = self.bone(P + 'Dome', (0, .2, .1)); self.ell(b, (0, .6, .1), (1.3, 1.25, 1.4), self.mat('d', GLOW.get(el, col), .5, .2, .1), b, 24, 14)
            k[b] = [(1, None, 0), (6, None, 0), (12, None, 1.05), (14, None, 1), (30, None, 1), (35, None, 0)]
            for i in range(6):
                an = i / 6 * TAU; c = (C(an) * 1.15, .55, .1 + S(an) * 1.15); bb = self.bone(P + 'Orb%d' % i, c); self.particle(el, bb, c, .32, col, bb, i)
                kk = [(1, (0, 0, 0), 0), (6 + i, (0, -.2, 0), 0), (10 + i, (0, 0, 0), 1)]
                for j in range(1, 6):
                    a2 = an + j * .5; kk.append((10 + i + 4 * j, (C(a2) * 1.15 - C(an) * 1.15, .08 * S(j), S(a2) * 1.15 - S(an) * 1.15), 1))
                kk.append((35, (0, .1, 0), 0)); k[bb] = kk
        elif kind == 'taunt':
            H = (0, 1.25, .8)
            for j, f0 in enumerate((10, 16, 22)):
                b = self.bone(P + 'Wave%d' % j, H); self.ring(b, H, .3, .035, ringm, b, 28, 'z')
                k[b] = [(1, (0, 0, 0), 0), (f0, (0, 0, 0), 0), (f0 + 1, (0, 0, 0), .6), (f0 + 12, (0, 0, 1.2), 2.4), (f0 + 13, (0, 0, 1.2), 0)]
            EX = (0, 2.2, .3); b = self.bone(P + 'Excl', EX); em = self.mat('p', 0xff5a3a, 1.6)
            self.cone(b, (EX[0], EX[1] + .35, EX[2]), (EX[0], EX[1] - .05, EX[2]), .09, em, b); self.ell(b + 'D', (EX[0], EX[1] - .17, EX[2]), (.07, .07, .07), em, b)
            k[b] = [(1, None, 0), (8, None, 0), (11, None, 1.3), (13, None, 1), (34, None, 1), (38, None, 0)]
            gring((0, .03, .3), 16, 30, .8, 2.0, 'Stomp')
        self.clip('atk_%d' % idx, F, k)
        return {'clip': 'atk_%d' % idx, 'name': a['n'], 'kind': a['k'], 'anim': kind, 'elem': el, 'slot': a['slot'], 'frames': F}

    # ---------- збирання й експорт ----------
    def export(self, out, fname):
        sc = self.sc
        arm_data = bpy.data.armatures.new(self.pal + 'FxRig'); arm = bpy.data.objects.new(self.pal + '_FX', arm_data); sc.collection.objects.link(arm)
        bpy.context.view_layer.objects.active = arm; arm.select_set(True); bpy.ops.object.mode_set(mode='EDIT'); E = arm_data.edit_bones
        rb = E.new('FxRoot'); rb.head = V(0, 0, 0); rb.tail = V(0, .3, 0)
        for n, c in self.bones.items():
            eb = E.new(n); eb.head = V(*c); eb.tail = V(c[0], c[1] + .2, c[2]); eb.roll = 0; eb.parent = rb
        bpy.ops.object.mode_set(mode='OBJECT')
        for o, bn in self.parts:
            g = o.vertex_groups.new(name=bn); g.add([v.index for v in o.data.vertices], 1.0, 'REPLACE')
        bpy.ops.object.select_all(action='DESELECT')
        for o, _ in self.parts: o.select_set(True)
        bpy.context.view_layer.objects.active = self.parts[0][0]; bpy.ops.object.join(); mesh = bpy.context.view_layer.objects.active; mesh.name = self.pal + 'FX'
        mesh.parent = arm; md = mesh.modifiers.new('Armature', 'ARMATURE'); md.object = arm
        bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='POSE'); PB = arm.pose.bones; ad = arm.animation_data_create()
        allfx = list(self.bones)
        for name, (frames, keys) in self.clips.items():
            act = bpy.data.actions.new(name); ad.action = act
            for p in PB: p.location = (0, 0, 0); p.scale = (1, 1, 1); p.rotation_mode = 'XYZ'; p.rotation_euler = (0, 0, 0)
            for bn in allfx:
                if bn in keys: continue
                p = PB[bn]; p.scale = (0, 0, 0)
                for f in (1, frames + 1): p.keyframe_insert('scale', frame=f)
                p.scale = (1, 1, 1)
            for bn, ks in keys.items():
                p = PB[bn]
                for kk in ks:
                    f, loc, s = kk[0], kk[1], kk[2]; rot = kk[3] if len(kk) > 3 else None
                    if loc is not None: p.location = loc; p.keyframe_insert('location', frame=f)
                    if s is not None: p.scale = (s, s, s); p.keyframe_insert('scale', frame=f)
                    if rot is not None: p.rotation_euler = rot; p.keyframe_insert('rotation_euler', frame=f)
                p.location = (0, 0, 0); p.scale = (1, 1, 1); p.rotation_euler = (0, 0, 0)
            try: fcs = act.layers[0].strips[0].channelbags[0].fcurves
            except Exception: fcs = act.fcurves
            for fc in fcs:
                if any('"%s"' % b in fc.data_path for b in self.step):
                    for kp in fc.keyframe_points: kp.interpolation = 'CONSTANT'
            tr = ad.nla_tracks.new(); tr.name = name; st = tr.strips.new(name, 1, act); st.name = name; ad.action = None
        for p in PB: p.location = (0, 0, 0); p.scale = (1, 1, 1); p.rotation_euler = (0, 0, 0)
        bpy.ops.object.mode_set(mode='OBJECT'); os.makedirs(out, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, fname + '.blend'))
        bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True); mesh.select_set(True); bpy.context.view_layer.objects.active = arm
        glb = os.path.join(out, fname + '.glb')
        bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, use_active_scene=True, export_skins=True, export_all_influences=False,
                                  export_animations=True, export_animation_mode='NLA_TRACKS', export_apply=False, export_yup=True)
        tris = sum(len(p.vertices) - 2 for p in mesh.data.polygons)
        print('BUILT', glb, 'tris', tris, 'bones', len(self.bones) + 1, 'clips', len(self.clips)); return glb, tris
