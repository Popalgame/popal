# Ігніс-Виверг (№3, вогонь, РДД) — фіолетовий павучок: велике черевце зі світними цятками й трьома вогниками, кругла голова з помаранчевими очима,
# шість колінчастих лап із помаранчевими кінчиками.
# Тотожність — з гри: pal-models.js buildIgnis, pal-forms.js (2): форма 2 — роги з вогниками, вогняні шипи на спині, довші лапи;
# форма 3 — вогняна корона, палаючі кінчики лап, крила з плазми.
# Скелет: LegLF/RF — передня пара, LegLM/RM — середня, LegLB/RB — задня (кожна: стегно + гомілка «2»).
import math
from pal_lib import Pal, rotY, rotZ, rotX, S, C

TOP, BOT = 0x7a5a8a, 0x32243f
LEGC = (0x8a6a9a, 0x4a3a5a)
HC = (0, .68, .42); HR = (.4, .34, .36)
LEGZ = {'F': .3, 'M': .02, 'B': -.26}

def build(form, ks):
    P = Pal('ignis', form, ks)
    P.mat('Glow', 0xff8a2a, .3, emis=1.6, emis_hex=0xff5a10)
    P.mat('Yellow', 0xffe070, .3, emis=1.8, emis_hex=0xffb030)
    P.mat('Plasma', 0xffe070, .3, emis=1.5, emis_hex=0xffb030, alpha=.6)
    P.mat('Horn', 0x4a3a5a, .5)
    def bodyW(c):
        v = min(1, max(0, (c[2] + .3) / .5)); return {'Base': 1 - v, 'Chest': v}
    P.blob_union('Body', [((0, .62, -.35), (.52, .46, .55)), ((0, .58, .1), (.34, .3, .3))], bodyW, (TOP, BOT), fluff=.015, ffreq=12, dec=.07)
    top = lambda x, z: .62 + .46 * math.sqrt(max(.02, 1 - (x / .52) ** 2 - ((z + .35) / .55) ** 2))
    for (x, z) in ((-.25, -.3), (.25, -.3), (-.18, -.62), (.18, -.62), (0, -.45)):
        P.ell('Spot', (x, top(x, z) - .02, z), (.09, .04, .09), bodyW, mat='Glow', seg=10, rings=6)
    for (x, z) in ((-.15, -.05), (0, 0), (.15, -.05)):  # три вогники на спині
        y = top(x, z) - .02
        P.ell('Flame', (x, y + .12, z), (.08, .15, .08), {'Base': 1}, mat='Glow', seg=10, rings=8)
        P.ell('FlameCore', (x, y + .24, z), (.045, .09, .045), {'Base': 1}, mat='Yellow', seg=8, rings=6)
    H = {'Head': 1}
    P.ell('Head', HC, HR, H, grad=(0x8a6a9a, 0x3a2a4a), seg=24, rings=18)
    P.eyes(HC, HR, .15, .1, .095, 0xff8a2a, lid_grad=(0x8a6a9a, 0x6a4a7a))
    for s in (-1, 1):
        P.ell('Fang', (HC[0] + s * .12, HC[1] - .15, HC[2] + .3), (.06, .07, .07), H, grad=(0x3a2a4a, 0x1d1428), seg=10, rings=8)
        P.ell('Blush', (HC[0] + s * .26, HC[1] - .06, HC[2] + .27), (.06, .03, .012), H, mat='Blush', seg=12, rings=8, rot=rotZ(s * .5))
    P.mouth_w(HC, -.08, .36, w=.032)
    # лапи: від боку тулуба вгору-назовні до коліна, потім униз до кінчика
    L = 1.0 if form == 1 else (1.12 if form == 2 else 1.18)
    for side, s in (('L', -1), ('R', 1)):
        for k, z in LEGZ.items():
            up, lo = 'Leg' + side + k, 'Leg' + side + k + '2'
            sp = {'F': .35, 'M': 0, 'B': -.35}[k]  # розворот лап віялом
            hip = (s * .28, .45, z); knee = (s * (.28 + .38 * L), .62 * L, z + sp * .4); foot = (s * (.28 + .66 * L), .05, z + sp * .75)
            P.tube('Thigh', [hip, knee], .075, {up: 1}, grad=LEGC, taper=.1, res=2)
            P.tube('Shin', [knee, foot], .07, {lo: 1}, grad=LEGC, taper=.3, res=2)
            P.ell('Knee', knee, (.085,) * 3, {up: .5, lo: .5}, grad=LEGC, seg=10, rings=8)
            P.ell('Tip', foot, (.09, .07, .09), {lo: 1}, grad=(0xffb870, 0xe8803a), mat='Glow' if form >= 3 else 'Fur', seg=10, rings=8)
    if form >= 2:
        for s in (-1, 1):
            P.tube('Horn', [(HC[0] + s * .12, HC[1] + HR[1] - .05, HC[2]), (HC[0] + s * .2, HC[1] + HR[1] + .12, HC[2] - .02), (HC[0] + s * .16, HC[1] + HR[1] + .3, HC[2] - .08)], .055, H, mat='Horn', taper=.6, res=2)
            P.cone('HornFlame', (HC[0] + s * .16, HC[1] + HR[1] + .3, HC[2] - .09), (HC[0] + s * .19, HC[1] + HR[1] + .5, HC[2] - .1), .06, H, mat='Glow', seg=7)
        for i in range(3):
            P.cone('BackSpike', (0, 1.02, -.12 - i * .12), (0, 1.32 - i * .06, -.24 - i * .14), .08 - .015 * i, {'Base': 1}, mat='Glow', seg=7)
    if form >= 3:
        for i in range(6):
            a = i / 6 * 2 * math.pi
            b = (HC[0] + C(a) * .16, HC[1] + HR[1] + .06, HC[2] + S(a) * .14)
            P.cone('Crown', b, (b[0] + C(a) * .06, b[1] + .2, b[2] + S(a) * .06), .045, H, mat='Glow', seg=6)
        for s in (-1, 1):
            pts = [(0, 0), (.1, .6), (.55, .95), (1.1, .7), (.85, .45), (.9, .2), (.6, .12), (.35, .15), (.15, 0)]
            P.slab('PlasmaWing', pts, lambda u, v, s=s: (s * (.15 + u * .75), 1.05 + v * .75, -.25 - u * .3), .015, {'Chest': 1}, mat='Plasma')
    P.bone('Root', (0, 0, 0), (0, 0, .3))
    P.bone('Base', (0, .6, -.62), (0, .64, .0), 'Root')
    P.bone('Chest', (0, .64, .0), (0, .66, .2), 'Base', True)
    P.bone('Neck', (0, .62, .22), (0, .64, .3), 'Chest')
    P.bone('Head', (0, .64, .3), (0, 1.1, .42), 'Neck', True)
    for side, s in (('L', -1), ('R', 1)):
        for k, z in LEGZ.items():
            sp = {'F': .35, 'M': 0, 'B': -.35}[k]
            hip = (s * .28, .45, z); knee = (s * (.28 + .38 * L), .62 * L, z + sp * .4); foot = (s * (.28 + .66 * L), .05, z + sp * .75)
            P.bone('Leg' + side + k, hip, knee, 'Chest' if k == 'F' else 'Base')
            P.bone('Leg' + side + k + '2', knee, foot, 'Leg' + side + k, True)
    return P

RIG = {'tail': (), 'ears': ('EarL', 'EarR')}

def _scuttle(F, n, amp):
    """Шість лап по черзі (тринога: LF, RM, LB разом; RF, LM, RB разом) — підйом стегна й згин гомілки."""
    k = {}
    for name, ph in (('LegLF', 0), ('LegRM', 0), ('LegLB', 0), ('LegRF', .5), ('LegLM', .5), ('LegRB', .5)):
        sg = -1 if name[3] == 'L' else 1
        k[name] = {'rot': [(1 + F * i / (2 * n), (sg * amp * max(0, S(2 * math.pi * (i / (2 * n) * n / 1 + ph))), 0, 0)) for i in range(2 * n + 1)]}
        k[name + '2'] = {'rot': [(1 + F * i / (2 * n), (sg * amp * .6 * max(0, S(2 * math.pi * (i / (2 * n) * n + ph))), 0, 0)) for i in range(2 * n + 1)]}
    return k
def extra_base(name, F):
    if name == 'walk': return _scuttle(F, 2, .45)
    if name == 'idle': return {'LegLF': {'rot': [(1, (0, 0, 0)), (36, (-.12, 0, 0)), (73, (0, 0, 0))]}, 'LegRF': {'rot': [(1, (0, 0, 0)), (36, (.12, 0, 0)), (73, (0, 0, 0))]}}
    return {}
def extra_clip(kind, F):
    """Передні лапи піднімаються в замаху (як у грі: rig.atk — коліна передніх лап)."""
    z = (0, 0, 0)
    return {'LegLF': {'rot': [(1, z), (8, (-.6, 0, 0)), (12, (.2, 0, 0)), (F, z)]}, 'LegRF': {'rot': [(1, z), (8, (.6, 0, 0)), (12, (-.2, 0, 0)), (F, z)]}}
