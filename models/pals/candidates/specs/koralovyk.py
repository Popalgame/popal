# Кораловик (№12, вода/земля, танк) — помаранчевий крабик із кораловими гілками й мушлями на спині, двома клешнями й шістьма ніжками.
# Тотожність — з гри: pal-models.js buildCrab, pal-forms.js (11): форма 2 — риф (бірюзовий, жовтий, рожевий корали) і мушлі;
# форма 3 — кораловий замок (вежі з рожевими дахами), перли.
import math
from pal_lib import Pal, rotY, rotZ, rotX, S, C

TOP, BOT = 0xffa27a, 0xe0583a
BELLY = (0xfff0dc, 0xf2d6b4)
LEGC = (0xe0583a, 0xb83a24)
HC = (0, .52, .4); HR = (.42, .34, .3)

def build(form, ks):
    P = Pal('koralovyk', form, ks)
    P.mat('Coral', 0xff7aa8, .55); P.mat('CoralT', 0x4ad8c8, .55); P.mat('CoralY', 0xffd34e, .55)
    P.mat('Shell', 0xfff6ea, .35); P.mat('Wall', 0xffe6ea, .6); P.mat('Roof', 0xff5a8a, .5)
    P.mat('Pearl', 0xfff8f0, .15, emis=.4, emis_hex=0xffe08a)
    def bodyW(c):
        v = min(1, max(0, (c[2] + .3) / .6)); return {'Base': 1 - v, 'Chest': v}
    P.blob_union('Body', [((0, .45, -.08), (.64, .4, .5)), ((0, .5, .15), (.56, .36, .36))], bodyW, (TOP, BOT), dec=.07)
    P.ell('Belly', (0, .32, .05), (.46, .2, .38), bodyW, grad=BELLY, seg=18, rings=10)
    for s in (-1, 1):  # горбики панцира
        P.ell('ShellBump', (s * .3, .76, -.05), (.18, .08, .2), bodyW, grad=(0xffb48a, 0xff8a5a), seg=12, rings=8)
    H = {'Head': 1}
    P.ell('Head', HC, HR, H, grad=(0xffb08a, 0xe86a48), seg=22, rings=16)
    P.ell('Nose', (HC[0], HC[1] - .02, HC[2] + .3), (.045, .03, .025), H, mat='Nose', seg=12, rings=8)
    P.mouth_w(HC, -.09, .3, w=.03)
    for s in (-1, 1):
        P.ell('Blush', (HC[0] + s * .25, HC[1] - .06, HC[2] + .22), (.06, .03, .012), H, mat='Blush', seg=12, rings=8, rot=rotZ(s * .5))
        P.tube('EyeStalk', [(s * .19, HC[1] + .2, HC[2] + .05), (s * .2, HC[1] + .3, HC[2] + .08)], .045, H, grad=(0xffb08a, 0xe86a48), taper=0, res=2)
    P.eyes((HC[0], HC[1] + .34, HC[2] + .08), (.32, .12, .12), .2, .0, .085, 0x2a3a5a, lid_grad=(0xffb08a, 0xf09070))
    # клешні: плече → передпліччя → клешня з двох «пальців»
    for s, nm in ((-1, 'ArmL'), (1, 'ArmR')):
        W = {nm: 1}
        P.ell('ArmUp', (s * .56, .46, .34), (.12, .11, .16), W, grad=(TOP, BOT), seg=12, rings=8)
        P.ell('Claw', (s * .62, .5, .6), (.21, .19, .24), W, grad=(0xffb08a, 0xd9482e), seg=16, rings=12)
        P.ell('Pincer', (s * .58, .62, .84), (.075, .07, .15), W, grad=BELLY, seg=10, rings=8, rot=rotX(-.4))
        P.ell('Pincer2', (s * .69, .44, .83), (.085, .06, .16), W, grad=BELLY, seg=10, rings=8, rot=rotX(.3))
    LEGS = {'LF': (-.55, .22, .1), 'RF': (.55, .22, .1), 'LB': (-.55, .22, -.34), 'RB': (.55, .22, -.34)}
    for k, (x, y, z) in LEGS.items():
        up, lo = 'Leg' + k, 'Leg' + k + '2'; s = 1 if x > 0 else -1
        def lw(c, up=up, lo=lo): t = min(1, max(0, (.16 - c[1]) / .08)); return {up: 1 - t, lo: t}
        P.tube('Leg', [(x - s * .05, .32, z), (x + s * .12, .26, z), (x + s * .18, .04, z + .02)], .07, lw, grad=LEGC, taper=.55, res=2)
    for s in (-1, 1):  # третя пара ніжок — на тулубі
        P.tube('Leg3', [(s * .5, .32, -.12), (s * .67, .26, -.12), (s * .74, .04, -.1)], .065, {'Base': 1}, grad=LEGC, taper=.55, res=2)
    # корал на спині (у всіх формах — рожевий)
    def coral(mat, x, y, z, sc, lean):
        for d in ((0, 0, 0, 0, .34, 0), (0, .14, 0, .17, .36, .03), (0, .2, 0, -.15, .44, -.03), (0, .3, 0, .04, .56, .04)):
            p0 = (x + d[0] * sc + lean * d[1], y + d[1] * sc, z + d[2] * sc); p1 = (x + d[3] * sc + lean * d[4], y + d[4] * sc, z + d[5] * sc)
            P.tube('Coral', [p0, tuple((a + b) / 2 for a, b in zip(p0, p1)), p1], .05 * sc, bodyW, mat=mat, taper=.3, res=2)
            P.ell('CoralTip', p1, (.05 * sc,) * 3, bodyW, mat=mat, seg=8, rings=6)
    coral('Coral', -.05, .8, -.12, .9, .1); coral('Coral', .26, .74, -.22, .55, -.35)
    if form >= 2:
        coral('CoralT', -.34, .72, -.05, .8, -.3); coral('CoralY', .36, .7, 0, .6, .35)
        for (x, y, z, r) in ((-.2, .8, .14, .3), (.18, .82, .1, -.4), (-.02, .8, -.3, .2)):
            P.cone('Shell', (x, y - .05, z), (x, y + .12, z), .085, bodyW, mat='Shell', seg=9)
    if form >= 3:
        for (x, y, z, r, h) in ((0, .86, -.14, .13, .5), (-.24, .8, -.24, .09, .34), (.24, .8, -.24, .09, .34), (0, .8, .1, .08, .26)):
            P.tube('Tower', [(x, y, z), (x, y + h, z)], r, bodyW, mat='Wall', taper=.1, res=2)
            P.cone('Roof', (x, y + h, z), (x, y + h + r * 2.2, z), r * 1.35, bodyW, mat='Roof', seg=10)
        for i in range(5):
            a = i / 5 * 2 * math.pi
            P.ell('Pearl', (S(a) * .45, .62, C(a) * .3 - .08), (.045, .045, .045), bodyW, mat='Pearl', seg=10, rings=8)
    P.quad_rig(hips=(0, .45, -.4), chest=(0, .48, .02), neck=(0, .48, .26), head_top=(0, .9, .44),
               legs={k: (x, y + .1, z) for k, (x, y, z) in LEGS.items()})
    for s, nm in ((-1, 'ArmL'), (1, 'ArmR')):
        P.bone(nm, (s * .5, .46, .26), (s * .6, .5, .6), 'Chest')
    return P

RIG = {'tail': (), 'ears': ('ArmL', 'ArmR')}

def extra_clip(kind, F):
    """Клешні: у ближніх атаках — клацання вперед; у решті — піднімає клешні."""
    z = (0, 0, 0)
    if kind in ('melee', 'dash'):
        k = [(1, z), (7, (-.6, 0, 0)), (11, (.5, 0, 0)), (14, (-.3, 0, 0)), (17, (.4, 0, 0)), (F, z)]
    else:
        k = [(1, z), (8, (-.7, 0, 0)), (F - 8, (-.6, 0, 0)), (F, z)]
    return {'ArmL': {'rot': k}, 'ArmR': {'rot': k}}
