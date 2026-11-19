# Пухоклуб (форми 1, 2, 3: FORM=1|2|3) — кандидат GLB зі скелетом і кліпами idle / walk / attack / happy / blink.
# Одноразовий скрипт: щоразу починає з порожньої сцени (read_factory_settings) і зберігає .blend + .glb поруч.
# Координати в коді — як у грі (x, y-вгору, z-вперед); у Blender: (x, -z, y). Експортер glTF перетворює назад (+Y вгору, морда +Z).
import bpy, bmesh, math, sys, os, random
from mathutils import Vector, Matrix, noise

OUT = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = 30

def V(x, y, z): return Vector((x, -z, y))
FORM = int(os.environ.get('FORM', '1')); KS = {1: 1.0, 2: 1.06, 3: 1.12}[FORM]  # розмір форми — як у грі (pal-forms.js)

# ---------- матеріали ----------
def mat(name, hexc, rough=.9, emis=None, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    c = [((hexc >> s) & 255) / 255 for s in (16, 8, 0)]
    lin = [(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4) for v in c]
    b.inputs['Base Color'].default_value = (*lin, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emis:
        b.inputs['Emission Color'].default_value = (*lin, 1); b.inputs['Emission Strength'].default_value = emis
    return m
def useVC(m):
    nt = m.node_tree; b = nt.nodes['Principled BSDF']; a = nt.nodes.new('ShaderNodeVertexColor'); a.layer_name = 'Col'
    nt.links.new(a.outputs['Color'], b.inputs['Base Color'])
def texmat(name, img, rough=.3):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(img); nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = rough; return m
def glass(name):
    m = mat(name, 0xffffff, .04); b = m.node_tree.nodes['Principled BSDF']; b.inputs['Alpha'].default_value = .16
    try: m.surface_render_method = 'BLENDED'
    except Exception: m.blend_method = 'BLEND'
    return m
M = dict(
    wool=mat('Wool', 0xf4ede0, .97), woolShade=mat('WoolShade', 0xe6dccd, .97),
    face=mat('Face', 0xf6cdb3, .8), inner=mat('EarInner', 0xe39a98, .85), hoof=mat('Hoof', 0x6e5468, .6),
    ink=mat('Ink', 0x2b2236, .3), iris=mat('Iris', 0x5fb3a6, .25), shine=mat('Shine', 0xffffff, .1, emis=.6),
    eyeDark=mat('EyeDark', 0x2e2228, .2), irisWarm=mat('IrisWarm', 0x8a5634, .25), irisTex=texmat('IrisTex', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'iris.png')), cornea=glass('Cornea'), blush=mat('Blush', 0xf49a9e, .8), nose=mat('Nose', 0x4a3240, .35),
    cloud=mat('CloudWool', 0xc8d7ee, .95), storm=mat('StormWool', 0x667aa6, .95), horn=mat('Horn', 0xd8b26a, .45),
    bolt=mat('Bolt', 0xffe866, .3, emis=3.0))
M['boltGlow'] = mat('BoltGlow', 0xfff0a0, .5, emis=2.0); M['boltGlow'].node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = .28
try: M['boltGlow'].surface_render_method = 'BLENDED'
except Exception: M['boltGlow'].blend_method = 'BLEND'

# ---------- допоміжні ----------
parts = []  # (obj, {bone: weight} or callable(co_code)->{bone:w})
def ellipsoid(name, c, r, m, w, seg=24, rings=16, rot=None):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1)
    S = Matrix.Diagonal((r[0], r[2], r[1], 1))  # код (rx, ry, rz) -> Blender (x, y=-z, z=y)
    bmesh.ops.transform(bm, matrix=S, verts=bm.verts)
    if rot: bmesh.ops.transform(bm, matrix=rot, verts=bm.verts)
    bmesh.ops.translate(bm, vec=V(*c), verts=bm.verts)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    o.data.materials.append(M[m]); [setattr(p, 'use_smooth', True) for p in me.polygons]
    parts.append((o, w)); return o
def rotX(a): return Matrix.Rotation(a, 4, 'X')
def rotY(a): return Matrix.Rotation(a, 4, 'Y')
def rotZ(a): return Matrix.Rotation(a, 4, 'Z')

def code(co):  # Blender -> код
    return (co.x, co.z, -co.y)

# ---------- тіло: одна суцільна «грушка» з вовняними клубками ----------
blobs = [((0, .72, -.12), (.45, .40, .66)), ((0, .80, .22), (.49, .43, .40)), ((0, .70, -.42), (.43, .38, .34)),
         ((0, .62, .05), (.40, .30, .55))]
bo = []
for i, (c, r) in enumerate(blobs):
    o = ellipsoid('BodyBlob%d' % i, c, r, 'wool', None, 32, 20); parts.pop(); bo.append(o)
bpy.ops.object.select_all(action='DESELECT')
for o in bo: o.select_set(True)
bpy.context.view_layer.objects.active = bo[0]; bpy.ops.object.join()
body = bpy.context.view_layer.objects.active; body.name = 'Body'
rm = body.modifiers.new('Remesh', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = .022; rm.use_smooth_shade = True
bpy.ops.object.modifier_apply(modifier='Remesh')

def fluff(obj, freq, amp, seed=0, mask=None):
    """Вовна: клубки (комірки Вороного) випирають назовні по нормалі."""
    me = obj.data; me.calc_loop_triangles()
    off = Vector((seed * 13.1, seed * 7.7, seed * 3.3))
    for v in me.vertices:
        p = v.co * freq + off
        d = noise.voronoi(p, distance_metric='DISTANCE')[0]
        h = max(0.0, 1 - (d[0] / .9) ** 2) ** .6  # центр клубка — 1, межа — 0
        k = 1.0 if mask is None else mask(v.co)
        v.co += v.normal * (h - .45) * amp * k
fluff(body, 9.0, .06, 1)
sm = body.modifiers.new('Smooth', 'SMOOTH'); sm.factor = .5; sm.iterations = 3
bpy.ops.object.modifier_apply(modifier='Smooth')
dc = body.modifiers.new('Dec', 'DECIMATE'); dc.ratio = .055
bpy.ops.object.modifier_apply(modifier='Dec')
for p in body.data.polygons: p.use_smooth = True
def bodyW(c):
    v = min(1, max(0, (c[2] + .2) / .6)); return {'PuffBase': 1 - v, 'PuffChest': v}
parts.append((body, bodyW))

# пухнастий «комір» навколо шиї — кільце клубків
for i in range(9):
    a = i / 9 * 2 * math.pi
    x, y = math.sin(a) * .30, .98 + math.cos(a) * .17
    z = .44 - .05 * math.cos(a)
    ellipsoid('Ruff%d' % i, (x, y, z), (.17, .15, .14), 'wool', {'PuffNeck': .7, 'PuffChest': .3}, 10, 7)

LIDS = []
# ---------- голова ----------
HC = (0, 1.12, .66)  # центр голови (більша, ніж у старій моделі: чибі-пропорції)
def hd(dx, dy, dz): return (HC[0] + dx, HC[1] + dy, HC[2] + dz)
head = ellipsoid('Head', HC, (.40, .37, .36), 'wool', {'PuffHead': 1}, 20, 14)
# клубки вовни на маківці й щоках
for (dx, dy, dz, r) in [(0, .30, -.02, .17), (-.14, .27, .04, .12), (.14, .27, .04, .12), (0, .22, .16, .11),
                        (-.31, -.08, .05, .14), (.31, -.08, .05, .14), (-.24, .16, -.12, .13), (.24, .16, -.12, .13)]:
    ellipsoid('HeadFluff', hd(dx, dy, dz), (r, r * .92, r), 'wool', {'PuffHead': 1}, 10, 7)
# мордочка
ellipsoid('Muzzle', hd(0, -.12, .25), (.24, .17, .14), 'face', {'PuffHead': 1}, 18, 12)
ellipsoid('Nose', hd(0, -.06, .385), (.045, .03, .025), 'nose', {'PuffHead': 1}, 14, 8)
ellipsoid('NoseShine', hd(-.012, -.048, .405), (.012, .007, .006), 'shine', {'PuffHead': 1}, 8, 6)
for s in (-1, 1):
    ellipsoid('Blush', hd(s * .225, -.11, .30), (.055, .028, .012), 'blush', {'PuffHead': 1}, 14, 8, rot=rotZ(-s * .1) @ rotY(s * .55))
    # великі очі: білок-контур (ink) + райдужка + 2 відблиски
    ry = rotY(s * .42)
    EYES = os.environ.get('EYES', 'D')
    if EYES == 'A':  # намистинки: маленькі круглі блискучі очі без райдужки
        ellipsoid('EyeInk', hd(s * .16, .0, .318), (.047, .054, .034), 'eyeDark', {'PuffHead': 1}, 14, 10, rot=ry)
        ellipsoid('EyeShine', hd(s * .146, .022, .349), (.016, .018, .008), 'shine', {'PuffHead': 1}, 8, 6, rot=ry)
        ellipsoid('EyeShine2', hd(s * .171, -.016, .346), (.007, .008, .005), 'shine', {'PuffHead': 1}, 6, 5, rot=ry)
    elif EYES == 'B':  # теплі карі: середні, тонкий обвід, великий відблиск
        ellipsoid('EyeInk', hd(s * .165, -.005, .33), (.058, .068, .026), 'eyeDark', {'PuffHead': 1}, 16, 10, rot=ry)
        ellipsoid('EyeIris', hd(s * .166, -.015, .346), (.043, .05, .016), 'irisWarm', {'PuffHead': 1}, 14, 9, rot=ry)
        ellipsoid('EyePupil', hd(s * .166, -.014, .36), (.022, .026, .008), 'eyeDark', {'PuffHead': 1}, 10, 8, rot=ry)
        ellipsoid('EyeShine', hd(s * .15, .022, .362), (.019, .021, .008), 'shine', {'PuffHead': 1}, 8, 6, rot=ry)
        ellipsoid('EyeShine2', hd(s * .18, -.035, .358), (.008, .009, .005), 'shine', {'PuffHead': 1}, 6, 5, rot=ry)
    elif EYES == 'D':  # «справжні»: яблуко, райдужка-текстура, рогівка, повіка на кістці
        EC = hd(s * .16, .0, .297); ERX, ERY = .05, .055
        ellipsoid('EyeBall', EC, (ERX, ERY, .04), 'eyeDark', {'PuffHead': 1}, 16, 12, rot=None)
        o = parts[-1][0]; piv = V(*EC); Mx = Matrix.Translation(piv) @ ry @ Matrix.Translation(-piv)
        for v in o.data.vertices: v.co = Mx @ v.co
        # райдужка: трохи опуклий диск з UV
        me = bpy.data.meshes.new('Iris'); bm = bmesh.new()
        bmesh.ops.create_circle(bm, cap_ends=True, cap_tris=True, segments=28, radius=1)
        uvl = bm.loops.layers.uv.new('UVMap')
        for f in bm.faces:
            for l in f.loops: l[uvl].uv = (l.vert.co.x * .5 + .5, l.vert.co.y * .5 + .5)
        for v in bm.verts:
            d = v.co.length; v.co = Vector((v.co.x * ERX * .86, v.co.y * ERY * .86, 0)); v.co = Vector((v.co.x, -(1 - d * d) * .006, v.co.y))
        bm.to_mesh(me); bm.free()
        o = bpy.data.objects.new('Iris', me); sc.collection.objects.link(o); o.data.materials.append(M['irisTex'])
        for v in o.data.vertices: v.co = Matrix.Translation(V(*EC) + V(0, 0, .0385)) @ v.co
        for v in o.data.vertices: v.co = Mx @ v.co
        for p in me.polygons: p.use_smooth = True
        parts.append((o, {'PuffHead': 1}))
        # рогівка — прозорий купол поверх райдужки
        ellipsoid('Cornea', hd(s * .16, .0, .307), (ERX * .92, ERY * .92, .036), 'cornea', {'PuffHead': 1}, 16, 12)
        o = parts[-1][0]
        for v in o.data.vertices: v.co = Mx @ v.co
        ellipsoid('EyeShine', hd(s * .146, .024, .343), (.011, .013, .005), 'shine', {'PuffHead': 1}, 8, 6, rot=None)
        o = parts[-1][0]
        for v in o.data.vertices: v.co = Mx @ v.co
        # верхня повіка: шапочка над оком (вовна), опускається кісткою PuffLidL/R
        lid = 'PuffLid' + ('L' if s < 0 else 'R')
        ellipsoid('Lid', EC, (ERX * 1.14, ERY * 1.14, .058), 'wool', {lid: 1}, 20, 14)
        o = parts[-1][0]; bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < EC[1] - ERY * .8], context='VERTS'); bm.to_mesh(o.data); bm.free()
        # у спокої повіка відкинута вгору-назад (захована в голові); кліп — обертання кістки вниз
        up = Matrix.Translation(piv) @ Matrix.Rotation(-1.62, 4, 'X') @ Matrix.Translation(-piv)
        for v in o.data.vertices: v.co = Mx @ (up @ v.co)
        LIDS.append((lid, EC, s))
    else:  # щасливі «^ ^» — закриті дужки
        pass
# ротик «ω»: дві маленькі дуги з циліндра-трубки
def arc(name, cx, cy, cz, r, a0, a1, th, w):
    pts = [Vector(V(cx + math.cos(a) * r, cy + math.sin(a) * r, cz)) for a in [a0 + (a1 - a0) * i / 10 for i in range(11)]]
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for p, q in zip(sp.points, pts): p.co = (*q, 1)
    cu.bevel_depth = th; cu.bevel_resolution = 2
    o = bpy.data.objects.new(name, cu); sc.collection.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target='MESH'); o = bpy.context.view_layer.objects.active
    o.data.materials.append(M['ink']); parts.append((o, w)); return o
for s in (-1, 1):
    arc('Mouth', HC[0] + s * .035, HC[1] - .125, HC[2] + .385, .035, math.pi, 2 * math.pi, .008, {'PuffHead': 1})
if os.environ.get('EYES', 'D') == 'C':
    for s_ in (-1, 1):
        arc('EyeHappy', HC[0] + s_ * .16, HC[1] - .02, HC[2] + .335 - abs(s_) * 0, .045, 0, math.pi, .013, {'PuffHead': 1})

# ---------- вуха ----------
for s, nm in ((-1, 'PuffEarL'), (1, 'PuffEarR')):
    tilt = rotY(-s * .32)  # відхилені назовні
    ellipsoid('Ear', hd(s * .27, .36, -.03), (.10, .24, .07), 'wool', {nm: 1}, 18, 12)
    o = parts[-1][0]
    ellipsoid('EarIn', hd(s * .27, .36, .025), (.058, .17, .02), 'inner', {nm: 1}, 14, 10)
# нахиляємо вуха навколо їхньої основи
for o, w in parts:
    if o.name.startswith('Ear'):
        s = -1 if sum(v.co.x for v in o.data.vertices) < 0 else 1
        pivot = V(s * .25, HC[1] + .16, HC[2])
        Mx = Matrix.Translation(pivot) @ rotY(-s * .35) @ Matrix.Translation(-pivot)
        for v in o.data.vertices: v.co = Mx @ v.co

# ---------- ноги (2 кістки: стегно й гомілка) і копитця ----------
LEGS = {'LF': (-.27, .56, .36), 'RF': (.27, .56, .36), 'LB': (-.28, .54, -.42), 'RB': (.28, .54, -.42)}
for k, (x, y, z) in LEGS.items():
    up, lo = 'PuffLeg' + k, 'PuffLeg' + k + '2'
    def lw(c, up=up, lo=lo, y=y):
        t = min(1, max(0, (y - .2 - c[1]) / .22)); return {up: 1 - t, lo: t}
    ellipsoid('Thigh', (x, y - .08, z), (.15, .2, .16), 'wool', lw, 14, 9)
    ellipsoid('Shin', (x, .2, z + .01), (.09, .17, .095), 'wool', lw, 12, 8)
    ellipsoid('Hoof', (x, .055, z + .03), (.1, .065, .12), 'hoof', {lo: 1}, 12, 8)
    o = parts[-1][0]
    for v in o.data.vertices:  # пласка підошва
        if v.co.z < .03: v.co.z = .03 + (v.co.z - .03) * .25
    ellipsoid('HoofSplit', (x, .065, z + .125), (.011, .042, .028), 'ink', {lo: 1}, 8, 6)

# ---------- хвіст ----------
ellipsoid('Tail', (0, .9, -.82), (.17, .17, .2), 'wool', {'PuffTail': 1}, 18, 12)
ellipsoid('TailTip', (0, 1.0, -1.0), (.14, .14, .15), 'wool', {'PuffTailTip': 1}, 16, 10)


# ---------- еволюції ----------
def spiral(name, base, s, R0, turns, th, out, m, w):
    """Ріжок-спіраль збоку голови: закручується назад і вниз, тоншає до кінця."""
    pts = []
    for i in range(29):
        t = i / 28; a = t * turns * 2 * math.pi; r = R0 * (1 - .55 * t)
        pts.append((Vector(V(base[0] + s * out * t, base[1] + math.sin(a) * r, base[2] - (1 - math.cos(a)) * r * .9 - t * .02)), 1 - .72 * t))
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for p, (q, rad) in zip(sp.points, pts): p.co = (*q, 1); p.radius = rad
    cu.bevel_depth = th; cu.bevel_resolution = 3; cu.use_fill_caps = True
    o = bpy.data.objects.new(name, cu); sc.collection.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target='MESH'); o = bpy.context.view_layer.objects.active
    for p in o.data.polygons: p.use_smooth = True
    o.data.materials.append(M[m]); parts.append((o, w)); return o
def bolt(name, c, scale, yaw, w):
    """Блискавка-зигзаг (товщина 4 см), два хрестоподібні листи — видно з будь-якого боку."""
    P2 = [(-.05, .32), (.08, .32), (.01, .17), (.09, .17), (-.08, -.08), (-.01, .09), (-.08, .09)]
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    vs = [bm.verts.new(V(c[0], c[1] + v_ * scale, c[2] + u * scale)) for u, v_ in P2]
    f = bm.faces.new(vs); r = bmesh.ops.extrude_face_region(bm, geom=[f])
    bmesh.ops.translate(bm, vec=Vector((.04 * scale, 0, 0)), verts=[e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)])
    bmesh.ops.translate(bm, vec=Vector((-.02 * scale, 0, 0)), verts=bm.verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    piv = V(*c); bmesh.ops.transform(bm, matrix=Matrix.Translation(piv) @ rotZ(yaw) @ Matrix.Translation(-piv), verts=bm.verts)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); o.data.materials.append(M['bolt']); parts.append((o, w)); return o
if FORM >= 2:
    # пишніший комір
    for i in range(7):
        a = i / 7 * 2 * math.pi + .4
        ellipsoid('Ruff2_%d' % i, (math.sin(a) * .34, .97 + math.cos(a) * .2, .4), (.15, .14, .13), 'wool', {'PuffNeck': .7, 'PuffChest': .3}, 10, 7)
    # хмаринки вовни: форма 2 — світло-блакитні плями з боків, форма 3 — ще й темна грозова хмара на спині
    # купки з 3 клубків, наполовину втоплені у вовну (поверхня тулуба на боці — x≈0.46)
    for s in (-1, 1):
        for (y, z) in ((.86, .12), (.8, -.3), (.98, -.5)):
            for (dy, dz, r) in ((0, 0, .15), (.09, .1, .11), (-.07, .11, .1)):
                ellipsoid('Cloud', (s * .39, y + dy, z + dz), (r * .75, r, r), 'cloud', bodyW, 10, 6)
    # ріжки
    for s in (-1, 1):
        if FORM == 2: spiral('Horn', hd(s * .3, .12, .08), s, .15, .95, .045, .12, 'horn', {'PuffHead': 1})
        else: spiral('Horn', hd(s * .24, .2, .0), s, .2, 1.15, .052, .17, 'horn', {'PuffHead': 1})
if FORM >= 2:
    SM = 'cloud' if FORM == 2 else 'storm'
    for (x, y, z, r) in [(0, 1.14, -.15, .22), (-.17, 1.1, .05, .18), (.17, 1.1, .05, .18), (-.15, 1.1, -.36, .19), (.15, 1.1, -.36, .19),
                         (0, 1.12, -.55, .17), (0, 1.16, .16, .16), (-.25, 1.02, -.15, .17), (.25, 1.02, -.15, .17)]:
        ellipsoid('Storm', (x, y, z), (r, r * .85, r), SM, bodyW, 10, 7)
    ellipsoid('StormTail', (0, 1.0, -1.0), (.17, .16, .18), SM, {'PuffTailTip': 1}, 12, 8)
    ellipsoid('StormTail2', (0, .92, -.84), (.13, .12, .13), SM, {'PuffTail': 1}, 10, 7)
    ellipsoid('StormTuft', hd(0, .33, .0), (.15, .12, .14), SM, {'PuffHead': 1}, 12, 8)
    for s in (-1, 1):  # кінчики вух
        o = ellipsoid('EarTip', hd(s * .27, .55, -.03), (.09, .1, .065), SM, {'PuffEarL' if s < 0 else 'PuffEarR': 1}, 10, 7)
        pivot = V(s * .25, HC[1] + .16, HC[2]); Mx = Matrix.Translation(pivot) @ rotY(-s * .35) @ Matrix.Translation(-pivot)
        for v in o.data.vertices: v.co = Mx @ v.co  # той самий нахил, що й у вуха
if FORM >= 3:
    # хмаринка над спиною (своя кістка PuffCloud) і дві блискавки, що б'ють з неї вниз
    CC = (0, 1.66, -.3)
    for (dx, dy, dz, r) in [(0, 0, 0, .2), (-.2, -.03, .05, .15), (.2, -.03, .05, .15), (-.1, .07, -.12, .14), (.12, .06, -.13, .14), (0, -.02, .17, .13)]:
        ellipsoid('SkyCloud', (CC[0] + dx, CC[1] + dy, CC[2] + dz), (r, r * .8, r), 'storm', {'PuffCloud': 1}, 10, 7)
    def zap(name, x0, z0, h, w, th=.05, m='bolt'):
        pts = [(0, 0), (.09, -.08), (-.04, -.14), (.09, -.22), (-.02, -.28), (.04, -.36)]
        cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
        for i, (p, (u, v)) in enumerate(zip(sp.points, pts)):
            p.co = (*V(x0 + u * h * .75, CC[1] - .12 + v * h, z0 + u * h * .75), 1); p.radius = 1 - .75 * i / (len(pts) - 1)  # зигзаг по діагоналі — видно з усіх боків
        cu.bevel_depth = th; cu.bevel_resolution = 2; cu.use_fill_caps = True
        o = bpy.data.objects.new(name, cu); sc.collection.objects.link(o)
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
        bpy.ops.object.convert(target='MESH'); o = bpy.context.view_layer.objects.active
        o.data.materials.append(M[m]); parts.append((o, w)); return o
    zap('Zap1', -.1, CC[2] + .02, 1.2, {'PuffCloud': 1}); zap('Zap2', .12, CC[2] - .06, 1.0, {'PuffCloud': 1})
    zap('ZapGlow1', -.1, CC[2] + .02, 1.2, {'PuffCloud': 1}, .11, 'boltGlow'); zap('ZapGlow2', .12, CC[2] - .06, 1.0, {'PuffCloud': 1}, .1, 'boltGlow')
for i, (o, w) in enumerate(parts):
    if o.name.startswith(('Tail', 'Ruff', 'HeadFluff', 'Thigh', 'Cloud', 'Storm', 'SkyCloud', 'EarTip')):
        big = o.name.startswith(('Cloud', 'Storm', 'SkyCloud'))
        fluff(o, 13.0 if big else 11.0, .035 if big else .025, i)

# ---------- скелет ----------
arm_data = bpy.data.armatures.new('PuffRig'); arm = bpy.data.objects.new('Pukhoklub_Rig', arm_data); sc.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm; arm.select_set(True); bpy.ops.object.mode_set(mode='EDIT')
E = arm_data.edit_bones
def bone(n, h, t, parent=None, conn=False):
    b = E.new(n); b.head = V(*h); b.tail = V(*t); b.roll = 0
    if parent: b.parent = E[parent]; b.use_connect = conn
    return b
bone('PuffRoot', (0, 0, 0), (0, 0, .3))
bone('PuffBase', (0, .72, -.35), (0, .76, .05), 'PuffRoot')
bone('PuffChest', (0, .76, .05), (0, .84, .34), 'PuffBase', True)
bone('PuffNeck', (0, .86, .38), (0, .98, .52), 'PuffChest')
bone('PuffHead', (0, .98, .52), (0, 1.38, .6), 'PuffNeck', True)
bone('PuffEarL', hd(-.25, .16, 0), hd(-.33, .58, -.03), 'PuffHead')
bone('PuffEarR', hd(.25, .16, 0), hd(.33, .58, -.03), 'PuffHead')
for k, (x, y, z) in LEGS.items():
    par = 'PuffChest' if k[1] == 'F' else 'PuffBase'
    bone('PuffLeg' + k, (x, y + .02, z), (x, .27, z), par)
    bone('PuffLeg' + k + '2', (x, .27, z), (x, .02, z + .02), 'PuffLeg' + k, True)
for nm_, ec, s_ in LIDS:
    # кістка повіки дивиться туди ж, куди око (поворот на s*0.42 навколо вертикалі), тож її вісь X — вісь кліпання
    a_ = s_ * .42; bone(nm_, ec, (ec[0] + math.sin(a_) * .12, ec[1], ec[2] + math.cos(a_) * .12), 'PuffHead')
bone('PuffTail', (0, .82, -.62), (0, .92, -.86), 'PuffBase')
bone('PuffTailTip', (0, .92, -.86), (0, 1.02, -1.1), 'PuffTail', True)
if FORM >= 3: bone('PuffCloud', (0, 1.5, -.3), (0, 1.85, -.3), 'PuffBase')
for b_ in E:  # розмір форми: масштабуємо кістки (сітку — після об'єднання), доки сітка ще не прив'язана
    b_.head = b_.head * KS; b_.tail = b_.tail * KS
bpy.ops.object.mode_set(mode='OBJECT')
BONES = [b.name for b in arm_data.bones]

# ---------- ваги й об'єднання в одну сітку ----------
for o, w in parts:
    for b in BONES: o.vertex_groups.new(name=b)
    for v in o.data.vertices:
        ww = w(code(v.co)) if callable(w) else w
        tot = sum(ww.values()) or 1
        for b, x in ww.items():
            if x > 1e-4: o.vertex_groups[b].add([v.index], x / tot, 'REPLACE')
bpy.ops.object.select_all(action='DESELECT')
for o, _ in parts: o.select_set(True)
bpy.context.view_layer.objects.active = body; bpy.ops.object.join()
mesh = bpy.context.view_layer.objects.active; mesh.name = 'Pukhoklub'
for v in mesh.data.vertices: v.co = v.co * KS
# нижня частина вовни трохи темніша (як «тінь» у грі): кольоровий атрибут
# ---------- затінення (ambient occlusion) у кольорах вершин ----------
# Для кожної вершини пускаємо промені в півсферу над нею: що більше їх упирається в сусідні клубки поруч, то темніше.
# Так западини між клубками вовни, під коміром, під хмарою й під животом стають глибшими. Очі (яблуко, райдужка, рогівка, відблиск) і блискавки не темнимо.
from mathutils.bvhtree import BVHTree
me_ = mesh.data
bvh = BVHTree.FromPolygons([v.co.copy() for v in me_.vertices], [tuple(p.vertices) for p in me_.polygons])
random.seed(7); DIRS = []
for i in range(18):  # косинусний розподіл, фіксований набір
    u, w_ = (i + .5) / 18, (i * .618034) % 1
    r_ = math.sqrt(u); a_ = 2 * math.pi * w_
    DIRS.append(Vector((r_ * math.cos(a_), r_ * math.sin(a_), math.sqrt(max(0, 1 - u)))))
AOD = .32 * KS
NOAO = {'EyeDark', 'IrisTex', 'Cornea', 'Shine', 'Bolt', 'BoltGlow', 'Ink'}
vmat = {}
for p in me_.polygons:
    for vi in p.vertices: vmat.setdefault(vi, set()).add(me_.materials[p.material_index].name)
ao = [1.0] * len(me_.vertices)
for v in me_.vertices:
    if vmat.get(v.index, set()) <= NOAO: continue
    n = v.normal; t = n.orthogonal().normalized(); b = n.cross(t)
    o = v.co + n * .006; occ = 0.0
    for d in DIRS:
        dd = (t * d.x + b * d.y + n * d.z).normalized()
        hit, _, _, dist = bvh.ray_cast(o, dd, AOD)
        if hit is not None: occ += (1 - dist / AOD) ** .7
    ao[v.index] = 1 - .7 * min(1, occ / len(DIRS) * 1.8)
ca = me_.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
WOOLC = (0xf4 / 255, 0xed / 255, 0xe0 / 255)
for poly in me_.polygons:
    mname = me_.materials[poly.material_index].name
    for li in poly.loop_indices:
        vi = me_.loops[li].vertex_index; z = me_.vertices[vi].co.z / KS
        if mname in NOAO: ca.data[li].color = (1, 1, 1, 1); continue
        a = ao[vi]
        if mname == 'Wool':
            k = max(0, min(1, (.8 - z) * .7)) * .18   # знизу трохи тепліше й темніше
            col = (WOOLC[0] * (1 - k * .8), WOOLC[1] * (1 - k), WOOLC[2] * (1 - k * 1.1))
            # тінь у западинах — з легким теплим відтінком (як у справжньої вовни), а не сіра
            ca.data[li].color = (col[0] * (a ** .85), col[1] * (a ** .95), col[2] * (a ** 1.1), 1)
        else:
            a2 = 1 - (1 - a) * .7
            ca.data[li].color = (a2, a2, a2, 1)
useVC(M['wool'])
mesh.parent = arm; mod = mesh.modifiers.new('Armature', 'ARMATURE'); mod.object = arm
# не більше 4 впливів (контракт), нормалізація
bpy.context.view_layer.objects.active = mesh
bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
bpy.ops.object.mode_set(mode='OBJECT')

# ---------- анімації ----------
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='POSE')
PB = arm.pose.bones
for p in PB: p.rotation_mode = 'XYZ'
ad = arm.animation_data_create()
def clip(name, frames, keys, cyclic=True):
    """keys: {bone: {'rot': [(f, (x,y,z)), ...], 'loc': [...]}} — кадри в межах 0..frames."""
    act = bpy.data.actions.new(name); ad.action = act
    for p in PB: p.rotation_euler = (0, 0, 0); p.location = (0, 0, 0)
    for b, ch in keys.items():
        p = PB[b]
        for kind, path in (('rot', 'rotation_euler'), ('loc', 'location')):
            for f, val in ch.get(kind, []):
                setattr(p, path, val); p.keyframe_insert(path, frame=f)
            setattr(p, path, (0, 0, 0))
    tr = ad.nla_tracks.new(); tr.name = name
    st = tr.strips.new(name, 1, act); st.name = name
    ad.action = None
    return act
def cyc(n, period, f):  # n ключів по колу, f(phase 0..1) -> (x,y,z)
    return [(1 + period * i / n, f(i / n)) for i in range(n + 1)]
S = math.sin; TAU = 2 * math.pi
BLINK = float(os.environ.get('BLINK', '-1.6'))
# idle 2.4 c: дихання, вуха, хвіст
F = 72
clip('idle', F, {
    'PuffChest': {'rot': cyc(8, F, lambda t: (.035 * S(TAU * t), 0, 0))},
    'PuffHead': {'rot': cyc(8, F, lambda t: (-.04 * S(TAU * t), .05 * S(TAU * t * 2) * 0, 0))},
    'PuffEarL': {'rot': cyc(8, F, lambda t: (0, 0, .1 * S(TAU * t)))},
    'PuffEarR': {'rot': cyc(8, F, lambda t: (0, 0, -.1 * S(TAU * t)))},
    'PuffTail': {'rot': cyc(8, F, lambda t: (0, 0, .2 * S(TAU * t)))},
    'PuffTailTip': {'rot': cyc(8, F, lambda t: (0, 0, .15 * S(TAU * t - 1)))},
    **{n_: {'rot': [(1, (0, 0, 0)), (44, (0, 0, 0)), (47, (BLINK, 0, 0)), (50, (0, 0, 0)), (73, (0, 0, 0))]} for n_, _, _s in LIDS},
    **({'PuffCloud': {'loc': cyc(8, F, lambda t: (0, .05 * S(TAU * t), 0)), 'rot': cyc(8, F, lambda t: (0, .2 * S(TAU * t), 0))}} if FORM >= 3 else {}),
})
# walk 0.8 c: рись (ліва передня + права задня разом), коліна згинаються
F = 24
def leg(ph, amp=.55):
    return lambda t: (amp * S(TAU * (t + ph)), 0, 0)
def knee(ph):
    return lambda t: (max(0, S(TAU * (t + ph) + 1.2)) * .7, 0, 0)
clip('walk', F, {
    'PuffBase': {'loc': cyc(8, F, lambda t: (0, .31 * .025 * abs(S(TAU * t)), -.95 * .025 * abs(S(TAU * t))))},  # вісь Z кістки дивиться вниз — підйом = (0, .31, -.95)
    'PuffChest': {'rot': cyc(8, F, lambda t: (.04 * S(TAU * t * 2), 0, 0))},
    'PuffHead': {'rot': cyc(8, F, lambda t: (-.05 * S(TAU * t * 2), .07 * S(TAU * t), .05 * S(TAU * t)))},
    'PuffNeck': {'rot': cyc(8, F, lambda t: (.03 * S(TAU * t * 2 - .6), 0, 0))},
    'PuffLegLF': {'rot': cyc(8, F, leg(0))}, 'PuffLegRB': {'rot': cyc(8, F, leg(0))},
    'PuffLegRF': {'rot': cyc(8, F, leg(.5))}, 'PuffLegLB': {'rot': cyc(8, F, leg(.5))},
    'PuffLegLF2': {'rot': cyc(8, F, knee(0))}, 'PuffLegRB2': {'rot': cyc(8, F, knee(0))},
    'PuffLegRF2': {'rot': cyc(8, F, knee(.5))}, 'PuffLegLB2': {'rot': cyc(8, F, knee(.5))},
    'PuffEarL': {'rot': cyc(8, F, lambda t: (.1 * S(TAU * t * 2 - 1.2), 0, .14 * S(TAU * t * 2 - 1)))},
    'PuffEarR': {'rot': cyc(8, F, lambda t: (.1 * S(TAU * t * 2 - 1.2), 0, -.14 * S(TAU * t * 2 - 1)))},
    'PuffTail': {'rot': cyc(8, F, lambda t: (0, 0, .28 * S(TAU * t)))},
    'PuffTailTip': {'rot': cyc(8, F, lambda t: (0, 0, .2 * S(TAU * t - 1)))},
})
# attack 0.66 c: замах назад і удар головою вперед
F = 20
K = lambda vals: [(1 + F * i / (len(vals) - 1), v) for i, v in enumerate(vals)]
clip('attack', F, {
    'PuffBase': {'loc': K([(0, 0, 0), (0, -.08, .03), (0, .16, 0), (0, 0, 0)])},
    'PuffChest': {'rot': K([(0, 0, 0), (-.16, 0, 0), (.17, 0, 0), (0, 0, 0)])},
    'PuffHead': {'rot': K([(0, 0, 0), (-.22, 0, 0), (.26, 0, 0), (0, 0, 0)])},
    'PuffEarL': {'rot': K([(0, 0, 0), (-.25, 0, .22), (.2, 0, -.08), (0, 0, 0)])},
    'PuffEarR': {'rot': K([(0, 0, 0), (-.25, 0, -.22), (.2, 0, .08), (0, 0, 0)])},
    'PuffLegLF': {'rot': K([(0, 0, 0), (-.5, 0, 0), (.6, 0, 0), (0, 0, 0)])},
    'PuffLegRF': {'rot': K([(0, 0, 0), (-.5, 0, 0), (.6, 0, 0), (0, 0, 0)])},
    'PuffTail': {'rot': K([(0, 0, 0), (.3, 0, 0), (-.3, 0, 0), (0, 0, 0)])},
}, cyclic=False)
# happy 1.05 c: підскок, похитування, вуха й хвіст
F = 32
clip('happy', F, {
    'PuffBase': {'loc': cyc(8, F, lambda t: (0, .31 * .09 * abs(S(TAU * t)), -.95 * .09 * abs(S(TAU * t))))},
    'PuffChest': {'rot': cyc(8, F, lambda t: (0, .1 * S(TAU * t), 0))},
    'PuffHead': {'rot': cyc(8, F, lambda t: (0, -.16 * S(TAU * t), 0))},
    'PuffEarL': {'rot': cyc(8, F, lambda t: (0, 0, .3 * S(TAU * t * 2)))},
    'PuffEarR': {'rot': cyc(8, F, lambda t: (0, 0, -.3 * S(TAU * t * 2)))},
    'PuffLegLF': {'rot': cyc(8, F, lambda t: (.3 * max(0, S(TAU * t)), 0, 0))},
    'PuffLegRF': {'rot': cyc(8, F, lambda t: (.3 * max(0, S(TAU * t)), 0, 0))},
    'PuffTail': {'rot': cyc(8, F, lambda t: (0, 0, .45 * S(TAU * t * 2)))},
    'PuffTailTip': {'rot': cyc(8, F, lambda t: (0, 0, .35 * S(TAU * t * 2 - 1)))},
    **({'PuffCloud': {'loc': cyc(8, F, lambda t: (0, .08 * abs(S(TAU * t)), 0)), 'rot': cyc(8, F, lambda t: (0, .3 * S(TAU * t * 2), 0))}} if FORM >= 3 else {}),
})
if LIDS:
    clip('blink', 8, {n_: {'rot': [(1, (0, 0, 0)), (4, (BLINK, 0, 0)), (6, (BLINK * .6, 0, 0)), (9, (0, 0, 0))]} for n_, _, _s in LIDS}, cyclic=False)
# атаки (спільні з ефектами в build_fx.py; кістки, яких у цій формі немає, пропускаємо)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fx_clips import CLIPS as FXC
for nm_, (fr_, keys_) in FXC['body'].items():
    clip(nm_, fr_, {b_: ch_ for b_, ch_ in keys_.items() if b_ in PB}, cyclic=False)
for p in PB: p.rotation_euler = (0, 0, 0); p.location = (0, 0, 0)
bpy.ops.object.mode_set(mode='OBJECT')

# ---------- збереження й експорт ----------
SUF = os.environ.get('SUF', ''); blend = os.path.join(OUT, 'pukhoklub_form%d_candidate%s.blend' % (FORM, SUF)); glb = os.path.join(OUT, 'pukhoklub_form%d_candidate%s.glb' % (FORM, SUF))
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=blend)
bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True); mesh.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, use_active_scene=True,
                          export_skins=True, export_all_influences=False, export_animations=True,
                          export_animation_mode='NLA_TRACKS', export_apply=False, export_yup=True)
tris = sum(len(p.vertices) - 2 for p in mesh.data.polygons)
from collections import Counter
cnt = Counter(mesh.data.materials[p.material_index].name for p in mesh.data.polygons for _ in range(len(p.vertices) - 2))
print('PERMAT', dict(cnt))
print('BUILT', glb, 'tris', tris, 'verts', len(mesh.data.vertices), 'bones', len(BONES), 'mats', len(mesh.data.materials))
