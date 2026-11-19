# Грумрок (№2, земля/кристал, танк) — пісочний ведмедик-копач із кам'яними горбами й самоцвітами на спині, металевими кігтями.
# Тотожність — з гри: pal-models.js buildGrumrok, pal-forms.js (1): форма 2 — кристалевий гребінь, ріг, бури на лапах;
# форма 3 — більший гребінь, ще два ріжки, кам'яні пластини на боках.
import math
from pal_lib import Pal, rotY, rotZ, rotX, S, C

TOP, BOT = 0xd9b47e, 0x946f48
BELLY = (0xf6e8c8, 0xdcc7a0)
LEGC = (0xa57d52, 0x6a4a30); FOOT = (0x5a3f2a, 0x3e2a1c)
HC = (0, .82, .66); HR = (.46, .4, .42)

def build(form, ks):
    P = Pal('grumrok', form, ks)
    P.mat('Gem', 0x6fe8d6, .15, emis=.8, emis_hex=0x1aa598, alpha=.9)
    P.mat('Crystal', 0x9af0ff, .12, emis=.8, emis_hex=0x2ab8e8, alpha=.88)
    P.mat('Metal', 0xc5ccd8, .35, metal=.7)
    P.mat('Drill', 0x8a8f9e, .35, metal=.5)
    def bodyW(c):
        v = min(1, max(0, (c[2] + .3) / .7)); return {'Base': 1 - v, 'Chest': v}
    P.blob_union('Body', [((0, .62, -.05), (.58, .5, .62)), ((0, .66, .28), (.52, .46, .36)), ((0, .6, -.4), (.52, .46, .34))], bodyW, (TOP, BOT), fluff=.02, ffreq=12, dec=.065)
    P.ell('Belly', (0, .5, .3), (.36, .3, .24), bodyW, grad=BELLY, seg=16, rings=10)
    # кам'яні горби на спині й самоцвіти
    for i in range(3):
        P.ell('Rock', (0, 1.06 - abs(i - 1) * .04, .3 - i * .3), (.34 - abs(i - 1) * .04, .13, .19), bodyW, grad=(0x8a6a48, 0x4a3322), seg=14, rings=8, rot=rotX(-.1 + i * .1), fluff=.02, ffreq=18)
    for (x, y, z, r, h, t) in ((0, 1.2, .15, .1, .26, .1), (-.2, 1.15, -.1, .075, .2, -.35), (.2, 1.15, -.12, .08, .22, .35), (0, 1.13, -.4, .065, .17, 0)):
        P.gem('BackGem', (x, y, z), r, h, bodyW, 'Gem', rot=rotY(t))
    H = {'Head': 1}
    P.ell('Head', HC, HR, H, grad=(0xe3bf8a, 0xa57d52), seg=24, rings=18)
    for s in (-1, 1):
        P.ell('Cheek', (HC[0] + s * .3, HC[1] - .12, HC[2] + .08), (.15, .13, .13), H, grad=(0xeccb98, 0xb58a5c), seg=12, rings=8, fluff=.015, ffreq=16)
    mz = (HC[0], HC[1] - .1, HC[2] + HR[2] * .8)
    P.ell('Muzzle', mz, (.2, .14, .17), H, grad=BELLY, seg=16, rings=12)
    P.ell('Nose', (mz[0], mz[1] + .055, mz[2] + .14), (.055, .04, .035), H, mat='Blush', seg=12, rings=8)
    P.ell('NoseShine', (mz[0] - .015, mz[1] + .075, mz[2] + .17), (.014, .008, .006), H, mat='Shine', seg=8, rings=6)
    P.mouth_w(HC, -.17, HR[2] * .8 + .155, w=.032)
    for s in (-1, 1):
        P.ell('Blush', (HC[0] + s * .25, HC[1] - .08, HC[2] + .32), (.06, .03, .012), H, mat='Blush', seg=12, rings=8, rot=rotZ(s * .5))
    P.eyes(HC, HR, .19, .07, .08, 0x6a4422, lid_grad=(0xe3bf8a, 0xc9a070))
    for s, nm in ((-1, 'EarL'), (1, 'EarR')):
        P.ell('Ear', (HC[0] + s * .3, HC[1] + .32, HC[2] - .05), (.11, .11, .07), {nm: 1}, grad=LEGC, seg=12, rings=9)
        P.ell('EarIn', (HC[0] + s * .3, HC[1] + .31, HC[2] + .0), (.06, .06, .02), {nm: 1}, grad=(0xeec09a, 0xd9a07a), seg=10, rings=7)
    LEGS = {'LF': (-.32, .34, .38), 'RF': (.32, .34, .38), 'LB': (-.32, .34, -.4), 'RB': (.32, .34, -.4)}
    for k, (x, y, z) in LEGS.items():
        up, lo = 'Leg' + k, 'Leg' + k + '2'
        def lw(c, up=up, lo=lo): t = min(1, max(0, (.24 - c[1]) / .12)); return {up: 1 - t, lo: t}
        P.ell('Thigh', (x, y - .08, z), (.16, .17, .17), lw, grad=LEGC, seg=14, rings=10)
        P.ell('Shin', (x, .15, z + .01), (.13, .12, .13), lw, grad=LEGC, seg=12, rings=8)
        P.ell('Paw', (x, .06, z + .06), (.15, .07, .18), {lo: 1}, grad=FOOT, seg=14, rings=8)
        if k[1] == 'F':  # металеві кігті (3 кульки) на передніх лапах
            for j in range(3):
                P.ell('Claw', (x + (j - 1) * .06, .06, z + .22), (.04 - j * 0, .04, .05), {lo: 1}, mat='Metal', seg=10, rings=8)
            if form >= 2:
                P.cone('Drill', (x, .1, z + .24), (x, .1, z + .52), .075, {lo: 1}, mat='Drill', seg=10)
                for j in range(3):  # гвинтова нарізка
                    P.ell('DrillRing', (x, .1, z + .28 + j * .07), (.07 - j * .015, .07 - j * .015, .012), {lo: 1}, mat='Metal', seg=12, rings=6)
    P.ell('Tail', (0, .5, -.78), (.12, .1, .16), {'Tail': 1}, grad=LEGC, seg=12, rings=8, fluff=.02, ffreq=14)
    if form >= 2:
        n = 9 if form >= 3 else 5
        for i in range(n):
            k = i / (n - 1); z = .45 - 1.0 * k; s = (.17 if form >= 3 else .13) * (1 - abs(k - .45) * .6)
            P.gem('Crest', ((.05 if i % 2 else -.05), 1.12 + s * .9, z), s * .55, s * 1.6, bodyW, 'Crystal', rot=rotY(.25 if i % 2 else -.25) @ rotZ(i))
        hb = (HC[0], HC[1] + HR[1] - .02, HC[2] + .12)
        L = .34 * (1.3 if form >= 3 else 1)
        P.cone('Horn', hb, (hb[0], hb[1] + L * .82, hb[2] + L * .5), .07 * (1.3 if form >= 3 else 1), H, mat='Crystal', seg=8)
    if form >= 3:
        for s in (-1, 1):
            hb = (HC[0] + s * .13, HC[1] + HR[1] - .04, HC[2] + .02)
            P.cone('Horn2', hb, (hb[0] + s * .1, hb[1] + .2, hb[2] + .1), .05, H, mat='Crystal', seg=8)
            for i in range(3):  # кам'яні пластини, що лежать на боках
                P.ell('Plate', (s * .52, .74, .3 - i * .3), (.06, .17, .14), bodyW, grad=(0x8a7a6a, 0x5a4a3a), seg=8, rings=6, rot=rotY(s * .5))
    P.quad_rig(hips=(0, .62, -.45), chest=(0, .66, .05), neck=(0, .7, .4), head_top=(0, 1.3, .7),
               legs={k: (x, y + .01, z) for k, (x, y, z) in LEGS.items()}, tail=[(0, .5, -.66), (0, .52, -.92)],
               ears={'EarL': ((-.27, HC[1] + .22, HC[2] - .05), (-.33, HC[1] + .42, HC[2] - .05)), 'EarR': ((.27, HC[1] + .22, HC[2] - .05), (.33, HC[1] + .42, HC[2] - .05))})
    return P

RIG = {'tail': ('Tail',)}
