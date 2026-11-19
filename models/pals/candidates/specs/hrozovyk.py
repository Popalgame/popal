# Грозовик (№8, електро/темрява, ДД) — котик-вовчик з темним хутром і світними синіми мітками.
# Тотожність — з гри: pal-models.js buildWolf, pal-forms.js (7): форма 2 — грива з шипів, хвіст-блискавка; форма 3 — більше шипів, іскри над головою, броньовані лапи.
import math
from pal_lib import Pal, V, rotY, rotZ, rotX, about, S, C

TOP, BOT = 0x7a7aa4, 0x34344e
BELLY = (0xd6dcf5, 0xb3bde6)
LEGC = (0x5a5a80, 0x34344e); FOOT = (0x2c2c44, 0x1e1e30)
HC = (0, .98, .55); HR = (.5, .44, .44)

def build(form, ks):
    P = Pal('hrozovyk', form, ks)
    P.mat('Neon', 0x6ae8ff, .35, emis=1.8, emis_hex=0x3ab8ff)
    P.mat('Armor', 0x5a5a80, .3, metal=.55)
    def bodyW(c):
        v = min(1, max(0, (c[2] + .25) / .6)); return {'Base': 1 - v, 'Chest': v}
    # тулуб — суцільна сітка з трьох об'ємів (груди, середина, стегна), ледь пухнаста шерсть
    P.blob_union('Body', [((0, .6, -.05), (.45, .4, .55)), ((0, .66, .22), (.41, .38, .3)), ((0, .58, -.36), (.4, .36, .3))], bodyW, (TOP, BOT), fluff=.018, ffreq=14, dec=.07)
    P.ell('Belly', (0, .5, .17), (.3, .25, .24), bodyW, grad=BELLY, seg=16, rings=10)
    # шия-пухнастий комірець (світлий)
    for i in range(5):  # світлий пухнастий нагрудник під підборіддям
        a = (i / 4 - .5) * 1.2
        P.ell('Ruff', (S(a) * .2, .68 + C(a) * .04, .5 - abs(S(a)) * .08), (.12, .12, .1), {'Neck': .6, 'Chest': .4}, grad=BELLY, seg=10, rings=7, fluff=.02, ffreq=16)
    # голова
    H = {'Head': 1}
    P.ell('Head', HC, HR, H, grad=(TOP, 0x5a5a80), seg=24, rings=18)
    for s in (-1, 1):  # пухнасті щоки
        P.ell('Cheek', (HC[0] + s * .3, HC[1] - .14, HC[2] + .08), (.13, .11, .12), H, grad=(0x8a8ab4, 0x5a5a80), seg=12, rings=8, fluff=.02, ffreq=16)
    mz = (HC[0], HC[1] - .12, HC[2] + HR[2] * .82)
    P.ell('Muzzle', mz, (.2, .14, .16), H, grad=BELLY, seg=16, rings=12)
    P.ell('Nose', (mz[0], mz[1] + .06, mz[2] + .14), (.055, .04, .035), H, mat='Nose', seg=12, rings=8)
    P.ell('NoseShine', (mz[0] - .015, mz[1] + .08, mz[2] + .17), (.014, .008, .006), H, mat='Shine', seg=8, rings=6)
    P.mouth_w(HC, -.18, HR[2] * .82 + .155, w=.032)
    for s in (-1, 1):
        P.ell('Blush', (HC[0] + s * .27, HC[1] - .1, HC[2] + .33), (.06, .03, .012), H, mat='Blush', seg=12, rings=8, rot=rotZ(s * .5))
    P.eyes(HC, HR, .19, .05, .085, 0x2ad0ff, lid_grad=(TOP, 0x6a6a94))
    # вуха
    for s, nm in ((-1, 'EarL'), (1, 'EarR')):
        P.ell('Ear', (HC[0] + s * .3, HC[1] + .4, HC[2] - .02), (.13, .23, .08), {nm: 1}, grad=(0x6a6a94, TOP), seg=14, rings=10, rot=rotY(s * .3))
        P.ell('EarIn', (HC[0] + s * .3, HC[1] + .38, HC[2] + .035), (.065, .14, .03), {nm: 1}, grad=(0xffc8d8, 0xe89ab0), seg=12, rings=8, rot=rotY(s * .3))
        P.ell('EarTuft', (HC[0] + s * .27, HC[1] + .27, HC[2] + .06), (.05, .06, .03), {nm: 1}, grad=(0xeef0ff, 0xd6dcf5), seg=8, rings=6, rot=rotY(s * .3))
    # світні мітки: 3 на лобі, 3 на спині, по 2 на боках
    for i, (x, rz) in enumerate(((-.085, .5), (0, 0), (.085, -.5))):
        P.ell('ForeMark', (HC[0] + x, HC[1] + .3, HC[2] + .33 - abs(x) * .3), (.022, .075, .015), H, mat='Neon', seg=8, rings=6, rot=rotY(-rz))
    for i in range(3):
        P.gem('BackGem', (0, 1.02 - abs(i - 1) * .03, .3 - i * .3), .05, .12, bodyW, 'Neon')
    for s in (-1, 1):
        for i in range(2):
            P.ell('SideMark', (s * .44, .62, .18 - i * .32), (.012, .07, .02), bodyW, mat='Neon', seg=8, rings=6, rot=rotX(.5 if i else -.5))
    # лапи
    LEGS = {'LF': (-.26, .34, .35), 'RF': (.26, .34, .35), 'LB': (-.26, .34, -.38), 'RB': (.26, .34, -.38)}
    for k, (x, y, z) in LEGS.items():
        up, lo = 'Leg' + k, 'Leg' + k + '2'
        def lw(c, up=up, lo=lo): t = min(1, max(0, (.24 - c[1]) / .12)); return {up: 1 - t, lo: t}
        P.ell('Thigh', (x, y - .08, z), (.14, .17, .15), lw, grad=LEGC, seg=14, rings=10)
        P.ell('Shin', (x, .15, z + .01), (.11, .12, .11), lw, grad=LEGC, seg=12, rings=8)
        P.ell('Paw', (x, .055, z + .06), (.13, .065, .16), {lo: 1}, grad=FOOT, seg=14, rings=8)
        for j in (-1, 0, 1):  # пальчики
            P.ell('Toe', (x + j * .055, .045, z + .19), (.035, .03, .03), {lo: 1}, grad=FOOT, seg=8, rings=6)
        if form >= 3:
            P.ell('Armor', (x, .2, z + .04), (.135, .1, .14), {lo: 1}, mat='Armor', seg=14, rings=8)
            P.cone('ArmorSpike', (x, .26, z + .1), (x, .33, z + .22), .03, {lo: 1}, mat='Armor')
    # хвіст: товстий, піднятий, зі світним кристалом на кінці
    def tw(c): t = min(1, max(0, (-.72 - c[2]) / .3)); return {'Tail': 1 - t, 'Tail2': t}
    P.tube('Tail', [(0, .6, -.52), (0, .72, -.75), (0, .9, -.92), (0, 1.08, -1.0)], .15, tw, grad=(0x6a6a94, BOT), taper=.45, res=3)
    P.gem('TailGem', (0, 1.2, -1.02), .065, .16, {'Tail2': 1}, 'Neon', rot=rotX(.4))
    # форми 2–3: грива з шипів, хвіст-блискавка, іскри над головою
    if form >= 2:
        n = 11 if form >= 3 else 8
        for i in range(n):
            a = (i / (n - 1) - .5) * math.pi * 1.3
            b = (S(a) * .26, .7 + C(a) * .22, .2); d = (S(a) * .7, .6, -.85); L = .32 if form >= 3 else .26
            P.cone('Mane', b, (b[0] + d[0] * L, b[1] + d[1] * L, b[2] + d[2] * L), .065, {'Neck': .6, 'Head': .4}, grad=(0x4a4a6a, 0x24243a), seg=8)
        P.zig('TailBolt', (0, 1.15, -1.05), (.05, 1.55, -1.35), 4, .07, .025, {'Tail2': 1}, 'Neon')
    if form >= 3:
        for i in range(3):
            P.zig('Spark', (-.2 + .2 * i, HC[1] + .4, HC[2] - .08), (-.24 + .22 * i, HC[1] + .66, HC[2] - .2), 3, .04, .016, H, 'Neon')
    P.quad_rig(hips=(0, .6, -.42), chest=(0, .64, .05), neck=(0, .74, .3), head_top=(0, 1.48, .6),
               legs={k: (x, y + .01, z) for k, (x, y, z) in LEGS.items()}, tail=[(0, .6, -.52), (0, .78, -.8), (0, 1.1, -1.02)],
               ears={'EarL': ((-.27, HC[1] + .2, HC[2]), (-.36, HC[1] + .62, HC[2] - .04)), 'EarR': ((.27, HC[1] + .2, HC[2]), (.36, HC[1] + .62, HC[2] - .04))})
    return P
