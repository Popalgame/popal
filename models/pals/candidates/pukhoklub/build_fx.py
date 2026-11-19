# Ефекти атак Пухоклуба (спільні для всіх форм) — окремий GLB зі своїм скелетом.
# Кожен ефект — жорсткі сітки на «своїх» кістках; поява/зникнення — масштаб кістки (0 = сховано).
# Кліпи мають ті самі назви й тривалість, що й кліпи тіла в pukhoklub_formN: atk_*.
# Початок координат — лапи попала; ціль атаки — TGT (2,6 м попереду). У грі корінь ефекту можна ставити/повертати до цілі.
# Координати в коді: (x, вгору, вперед); у Blender: (x, -вперед, вгору).
import bpy, bmesh, math, sys, os, random
from mathutils import Vector, Matrix, noise

OUT = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.fps = 30
def V(x, y, z): return Vector((x, -z, y))
TGT = (0, 0, 2.6)
random.seed(11)

def lin(h): return [((v / 255) / 12.92 if v / 255 <= .04045 else (((v / 255) + .055) / 1.055) ** 2.4) for v in ((h >> 16) & 255, (h >> 8) & 255, h & 255)]
def mat(name, hexc, rough=.6, emis=0, alpha=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    c = lin(hexc); b.inputs['Base Color'].default_value = (*c, 1); b.inputs['Roughness'].default_value = rough
    if emis: b.inputs['Emission Color'].default_value = (*c, 1); b.inputs['Emission Strength'].default_value = emis
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        try: m.surface_render_method = 'BLENDED'
        except Exception: m.blend_method = 'BLEND'
    return m
M = dict(wool=mat('FxWool', 0xf6f0e4, .95, .15), pink=mat('FxPink', 0xff8fbf, .5, 1.2), pinkCloud=mat('FxPinkCloud', 0xffc9df, .9, .35),
         storm=mat('FxStorm', 0x56688f, .95), bolt=mat('FxBolt', 0xfff3a0, .3, 4.0), glow=mat('FxBoltGlow', 0xffe45a, .5, 2.5, .3),
         ring=mat('FxRing', 0xffe866, .4, 2.0, .55), pinkRing=mat('FxPinkRing', 0xff9ccc, .4, 1.4, .5), bubble=mat('FxBubble', 0xdff3ff, .1, .4, .22),
         note=mat('FxNote', 0xc77dff, .4, 1.0), drop=mat('FxDrop', 0x9fdcff, .2, .8), dust=mat('FxDust', 0xe9dcc6, 1, 0, .8),
         spark=mat('FxSpark', 0xfff6b0, .3, 3.0))

parts = []   # (obj, bone)
BONES = {}   # bone -> (head_code, parent)
def bone_at(name, c):
    if name not in BONES: BONES[name] = c
    return name
def link(me, name, m, bone):
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); o.data.materials.append(M[m])
    for p in me.polygons: p.use_smooth = True
    parts.append((o, bone)); return o
def ellipsoid(name, c, r, m, bone, seg=10, rings=7):
    me = bpy.data.meshes.new(name); bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1)
    bmesh.ops.transform(bm, matrix=Matrix.Diagonal((r[0], r[2], r[1], 1)), verts=bm.verts); bmesh.ops.translate(bm, vec=V(*c), verts=bm.verts)
    bm.to_mesh(me); bm.free(); return link(me, name, m, bone)
def fluffy(name, c, r, m, bone, n=5, seed=0):
    """Пухнаста хмаринка/клубок: кілька куль навколо центру."""
    rnd = random.Random(seed)
    ellipsoid(name, c, (r, r * .85, r), m, bone)
    for i in range(n):
        a = i / n * 2 * math.pi + rnd.random() * .5; rr = r * (.55 + rnd.random() * .25)
        ellipsoid(name, (c[0] + math.cos(a) * r * .75, c[1] + rnd.uniform(-.2, .35) * r, c[2] + math.sin(a) * r * .75), (rr, rr * .9, rr), m, bone, 8, 6)
def tube(name, pts, th, m, bone, taper=.75):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for i, (p, q) in enumerate(zip(sp.points, pts)): p.co = (*V(*q), 1); p.radius = 1 - taper * i / max(1, len(pts) - 1)
    cu.bevel_depth = th; cu.bevel_resolution = 1; cu.use_fill_caps = True
    o = bpy.data.objects.new(name, cu); sc.collection.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target='MESH'); o = bpy.context.view_layer.objects.active; o.data.materials.append(M[m])
    for p in o.data.polygons: p.use_smooth = True
    parts.append((o, bone)); return o
def bolt(name, top, bottom, bone, seed, th=.07):
    """Блискавка-зигзаг від хмари до землі + напівпрозоре сяйво + 1 відгалуження."""
    rnd = random.Random(seed); n = 7; pts = []
    for i in range(n + 1):
        t = i / n; j = 0 if i in (0, n) else 1
        pts.append((top[0] + (bottom[0] - top[0]) * t + j * rnd.uniform(-.22, .22), top[1] + (bottom[1] - top[1]) * t, top[2] + (bottom[2] - top[2]) * t + j * rnd.uniform(-.22, .22)))
    tube(name, pts, th, 'bolt', bone, .55); tube(name + 'Glow', pts, th * 2.4, 'glow', bone, .5)
    k = 3; b0 = pts[k]; tube(name + 'Br', [b0, (b0[0] + .35, b0[1] - .35, b0[2] + .1), (b0[0] + .5, b0[1] - .7, b0[2] - .05)], th * .6, 'bolt', bone, .8)
def ring(name, c, R, th, m, bone, seg=32):
    me = bpy.data.meshes.new(name); bm = bmesh.new(); rs = 6; vs = []
    for i in range(seg):
        a = i / seg * 2 * math.pi; row = []
        for j in range(rs):
            b = j / rs * 2 * math.pi; r = R + math.cos(b) * th
            row.append(bm.verts.new(V(c[0] + math.cos(a) * r, c[1] + math.sin(b) * th * .5, c[2] + math.sin(a) * r)))
        vs.append(row)
    for i in range(seg):
        for j in range(rs): bm.faces.new((vs[i][j], vs[(i + 1) % seg][j], vs[(i + 1) % seg][(j + 1) % rs], vs[i][(j + 1) % rs]))
    bm.normal_update(); bm.to_mesh(me); bm.free(); return link(me, name, m, bone)
def heart(name, c, s, bone):
    me = bpy.data.meshes.new(name); bm = bmesh.new(); pts = []
    for i in range(24):
        t = i / 24 * 2 * math.pi; x = 16 * math.sin(t) ** 3; y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append(bm.verts.new(V(c[0] + x / 17 * s, c[1] + y / 17 * s, c[2])))
    f = bm.faces.new(pts); r = bmesh.ops.extrude_face_region(bm, geom=[f])
    bmesh.ops.translate(bm, vec=V(0, 0, -.05 * s * 2), verts=[e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    o = link(me, name, 'pink', bone)
    for p in o.data.polygons: p.use_smooth = False
    return o
def note(name, c, s, bone):
    ellipsoid(name, (c[0], c[1], c[2]), (.07 * s, .055 * s, .045 * s), 'note', bone, 10, 7)
    tube(name + 'St', [(c[0] + .06 * s, c[1], c[2]), (c[0] + .06 * s, c[1] + .26 * s, c[2]), (c[0] + .16 * s, c[1] + .18 * s, c[2])], .018 * s, 'note', bone, 0)

# ================= ефекти =================
FX = {}  # кліп -> список кісток (щоб ховати чужі)
def reg(clip, b): FX.setdefault(clip, []).append(b); return b
MOUTH = (0, 1.0, 1.0)
# 1 Пухнастий стусан — клубок вовни летить у ціль і «пухкає»
b = reg('atk_stusan', bone_at('FxBall', MOUTH)); fluffy('Ball', MOUTH, .14, 'wool', b, 5, 1)
b = reg('atk_stusan', bone_at('FxPoof', (TGT[0], .8, TGT[2]))); fluffy('Poof', (TGT[0], .8, TGT[2]), .32, 'wool', b, 7, 2)
# 2 Хмаринка здоров'я — рожева хмаринка над головою й сердечка
HEADUP = (0, 2.15, .55)
b = reg('atk_heal', bone_at('FxHealCloud', HEADUP)); fluffy('HealCloud', HEADUP, .26, 'pinkCloud', b, 6, 3)
for i in range(3):
    p = (-.3 + .3 * i, 1.9, .55 + .05 * i); b = reg('atk_heal', bone_at('FxHeart%d' % i, p)); heart('Heart', p, .13, b)
# 3 Пухова завіса — кільце клубків і прозорий купол
for i in range(8):
    a = i / 8 * 2 * math.pi; p = (math.sin(a) * 1.15, .45, math.cos(a) * 1.15 + .1)
    b = reg('atk_shield', bone_at('FxWall%d' % i, p)); fluffy('Wall', p, .26, 'wool', b, 4, 10 + i)
b = reg('atk_shield', bone_at('FxDome', (0, .2, .1))); ellipsoid('Dome', (0, .55, .1), (1.35, 1.3, 1.45), 'bubble', b, 24, 14)
# 4 Хмарний відскок — пил з-під лап і зірка удару
for i in range(3):
    p = (-.35 + .35 * i, .12, -.5); b = reg('atk_dash', bone_at('FxDust%d' % i, p)); fluffy('Dust', p, .16, 'dust', b, 3, 20 + i)
b = reg('atk_dash', bone_at('FxImpact', (0, .9, 2.25))); ring('Impact', (0, .9, 2.25), .35, .05, 'ring', b)
for i in range(5):
    a = i / 5 * 2 * math.pi; p = (math.cos(a) * .3, .9 + math.sin(a) * .3, 2.25)
    ellipsoid('ImpactSpark', p, (.05, .05, .05), 'spark', b, 6, 4)
# 5 Колискова — ноти летять до цілі, рожеве коло сповільнення
for i in range(4):
    p = (-.25 + .17 * i, 1.6, .7); b = reg('atk_lullaby', bone_at('FxNote%d' % i, p)); note('Note', p, 1.1, b)
b = reg('atk_lullaby', bone_at('FxSleepRing', (TGT[0], .04, TGT[2]))); ring('SleepRing', (TGT[0], .04, TGT[2]), 1.1, .06, 'pinkRing', b, 40)
# 6 Велике зцілення — кільце під лапами й фонтан сердечок
b = reg('atk_bigheal', bone_at('FxHealRing', (0, .05, 0))); ring('HealRing', (0, .05, 0), 1.0, .07, 'pinkRing', b, 40)
for i in range(6):
    a = i / 6 * 2 * math.pi; p = (math.cos(a) * .55, 1.2, math.sin(a) * .55)
    b = reg('atk_bigheal', bone_at('FxBigHeart%d' % i, p)); heart('BigHeart', p, .16, b)
# 7 Пуховий кокон — пухнаста куля навколо цілі
for i in range(10):
    ph = math.acos(1 - 2 * (i + .5) / 10); th = i * 2.399
    p = (TGT[0] + math.sin(ph) * math.cos(th) * .75, .9 + math.cos(ph) * .75, TGT[2] + math.sin(ph) * math.sin(th) * .75)
    b = reg('atk_cocoon', bone_at('FxCocoon%d' % i, p)); fluffy('Cocoon', p, .22, 'wool', b, 3, 40 + i)
# 8 Грозова хмара — темна хмара над ціллю, 3 блискавки по черзі, кільця удару, іскри; іскорки на вовні
SC = (TGT[0], 3.1, TGT[2])
b = reg('atk_storm', bone_at('FxStormCloud', SC)); fluffy('StormCloud', SC, .55, 'storm', b, 8, 5)
for k, (dx, dz) in enumerate(((-.25, .1), (.3, -.15), (.0, .3))):
    top = (SC[0] + dx, SC[1] - .35, SC[2] + dz); bot = (TGT[0] + dx * 1.6, 0, TGT[2] + dz * 1.6)
    b = reg('atk_storm', bone_at('FxBolt%d' % k, (bot[0], 1.4, bot[2]))); bolt('Bolt%d' % k, top, bot, b, 30 + k)
for k in range(2):
    b = reg('atk_storm', bone_at('FxStormRing%d' % k, (TGT[0], .03, TGT[2]))); ring('StormRing', (TGT[0], .03, TGT[2]), .7, .06, 'ring', b, 36)
for k in range(6):
    a = k / 6 * 2 * math.pi; p = (TGT[0] + math.cos(a) * .15, .15, TGT[2] + math.sin(a) * .15)
    b = reg('atk_storm', bone_at('FxSpark%d' % k, p)); ellipsoid('Spark', p, (.06, .06, .06), 'spark', b, 6, 4)
b = reg('atk_storm', bone_at('FxStatic', (0, 1.25, -.2)))
for k in range(3):  # іскорки статики на вовні
    x0 = -.3 + .3 * k; tube('Static', [(x0, 1.2, -.4 + .2 * k), (x0 + .08, 1.33, -.35 + .2 * k), (x0 - .04, 1.42, -.3 + .2 * k), (x0 + .06, 1.55, -.26 + .2 * k)], .025, 'bolt', b, .6)
# 9 Дощ із хмаринок — три хмаринки над ціллю, з них падають краплі
for k in range(3):
    c = (TGT[0] - .7 + .7 * k, 2.4, TGT[2] + (.25 if k == 1 else -.1))
    b = reg('atk_rain', bone_at('FxRainCloud%d' % k, c)); fluffy('RainCloud', c, .28, 'pinkCloud', b, 5, 60 + k)
    for j in range(3):
        p = (c[0] - .15 + .15 * j, 2.15, c[2] + .05 * j); b = reg('atk_rain', bone_at('FxDrop%d_%d' % (k, j), p)); ellipsoid('Drop', p, (.04, .07, .04), 'drop', b, 8, 6)
b = reg('atk_rain', bone_at('FxRainRing', (TGT[0], .03, TGT[2]))); ring('RainRing', (TGT[0], .03, TGT[2]), 1.0, .05, 'pinkRing', b, 40)

# ================= скелет =================
arm_data = bpy.data.armatures.new('PuffFxRig'); arm = bpy.data.objects.new('Pukhoklub_FX', arm_data); sc.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm; arm.select_set(True); bpy.ops.object.mode_set(mode='EDIT'); E = arm_data.edit_bones
rb = E.new('FxRoot'); rb.head = V(0, 0, 0); rb.tail = V(0, .3, 0)
for n, c in BONES.items():
    eb = E.new(n); eb.head = V(*c); eb.tail = V(c[0], c[1] + .2, c[2]); eb.roll = 0; eb.parent = rb  # вісь кістки = вгору; локальні (x, вгору, вперед)
bpy.ops.object.mode_set(mode='OBJECT')
for o, bn in parts:
    g = o.vertex_groups.new(name=bn); g.add([v.index for v in o.data.vertices], 1.0, 'REPLACE')
bpy.ops.object.select_all(action='DESELECT')
for o, _ in parts: o.select_set(True)
bpy.context.view_layer.objects.active = parts[0][0]; bpy.ops.object.join(); mesh = bpy.context.view_layer.objects.active; mesh.name = 'PukhoklubFX'
mesh.parent = arm; md = mesh.modifiers.new('Armature', 'ARMATURE'); md.object = arm

# ================= анімації =================
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='POSE'); PB = arm.pose.bones
ad = arm.animation_data_create()
ALLFX = [n for n in BONES]
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fx_clips import CLIPS  # тривалість і ключі — спільні з кліпами тіла
for name, (frames, keys) in CLIPS['fx'].items():
    act = bpy.data.actions.new(name); ad.action = act
    for p in PB: p.location = (0, 0, 0); p.scale = (1, 1, 1); p.rotation_mode = 'XYZ'; p.rotation_euler = (0, 0, 0)
    mine = set(FX.get(name, []))
    for bn in ALLFX:  # чужі ефекти й ефекти без ключів — сховані весь кліп
        if bn in keys: continue
        p = PB[bn]; p.scale = (0, 0, 0)
        for f in (1, frames + 1): p.keyframe_insert('scale', frame=f)
        p.scale = (1, 1, 1)
    for bn, ks in keys.items():
        p = PB[bn]
        for k in ks:
            f = k[0]; loc = k[1]; s = k[2]; rot = k[3] if len(k) > 3 else None
            if loc is not None: p.location = loc; p.keyframe_insert('location', frame=f)
            if s is not None: p.scale = (s, s, s); p.keyframe_insert('scale', frame=f)
            if rot is not None: p.rotation_euler = rot; p.keyframe_insert('rotation_euler', frame=f)
        p.location = (0, 0, 0); p.scale = (1, 1, 1); p.rotation_euler = (0, 0, 0)
    # блискавки й іскри — без плавного переходу (миготіння)
    try:
        bag = act.layers[0].strips[0].channelbags[0]; fcs = bag.fcurves
    except Exception:
        fcs = act.fcurves
    for fc in fcs:
        if 'FxBolt' in fc.data_path or 'FxStatic' in fc.data_path:
            for kp in fc.keyframe_points: kp.interpolation = 'CONSTANT'
    tr = ad.nla_tracks.new(); tr.name = name; st = tr.strips.new(name, 1, act); st.name = name; ad.action = None
for p in PB: p.location = (0, 0, 0); p.scale = (1, 1, 1); p.rotation_euler = (0, 0, 0)
bpy.ops.object.mode_set(mode='OBJECT')

blend = os.path.join(OUT, 'pukhoklub_fx.blend'); glb = os.path.join(OUT, 'pukhoklub_fx.glb')
bpy.ops.wm.save_as_mainfile(filepath=blend)
bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True); mesh.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, use_active_scene=True, export_skins=True, export_all_influences=False,
                          export_animations=True, export_animation_mode='NLA_TRACKS', export_apply=False, export_yup=True, export_force_sampling=False)
print('BUILT', glb, 'tris', sum(len(p.vertices) - 2 for p in mesh.data.polygons), 'bones', len(BONES) + 1, 'clips', len(CLIPS['fx']))
