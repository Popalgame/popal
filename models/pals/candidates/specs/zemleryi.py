# Землерий (№13, земля, ДД) — кріт-шахтар: фіолетово-сіре хутро, великий рожевий ніс із вусами, кремові кігті, рожеві лапки.
# Тотожність — з гри: pal-models.js buildMole, pal-forms.js (12): форма 2 — шахтарська каска з кристалом-ліхтариком;
# форма 3 — ще й бур на носі, кам'яна броня й кристали на спині, довгі сталеві кігті.
import math
from pal_lib import Pal, rotY, rotZ, rotX, S, C

TOP, BOT = 0x94788a, 0x55424a
BELLY = (0xeed8d4, 0xcdb4b0)
LEGC = (0x6a5560, 0x55424a); FOOT = (0xf0b8b8, 0xd99a9a)
HC = (0, .66, .64); HR = (.42, .38, .4)

def build(form, ks):
    P = Pal('zemleryi', form, ks)
    P.mat('Claw', 0xfff2dc, .4)
    P.mat('Pink', 0xff8aa0, .35)
    P.mat('Helmet', 0xffc83a, .45); P.mat('HelmetD', 0xd99a1a, .5)
    P.mat('Lamp', 0x8af0ff, .15, emis=2.0, emis_hex=0x2ad0ff, alpha=.92)
    P.mat('Steel', 0xb8c2d0, .3, metal=.75)
    P.mat('StoneA', 0x7a7a86, .95)
    def bodyW(c):
        v = min(1, max(0, (c[2] + .3) / .7)); return {'Base': 1 - v, 'Chest': v}
    P.blob_union('Body', [((0, .52, -.05), (.5, .46, .62)), ((0, .56, .28), (.46, .42, .34)), ((0, .5, -.4), (.46, .42, .32))], bodyW, (TOP, BOT), fluff=.025, ffreq=13, dec=.065)
    P.ell('Belly', (0, .4, .28), (.32, .26, .24), bodyW, grad=BELLY, seg=16, rings=10)
    H = {'Head': 1}
    P.ell('Head', HC, HR, H, grad=(0xa48a9a, 0x6a5560), seg=24, rings=18)
    # довга мордочка й великий рожевий ніс
    mz = (HC[0], HC[1] - .06, HC[2] + HR[2] * .72)
    P.ell('Muzzle', mz, (.17, .13, .26), H, grad=(0xf6e0da, 0xe0c2bc), seg=16, rings=12)
    nose = (mz[0], mz[1] + .02, mz[2] + .24)
    P.ell('Nose', nose, (.09, .078, .072), H, mat='Pink', seg=14, rings=10)
    P.ell('NoseShine', (nose[0] - .025, nose[1] + .035, nose[2] + .055), (.022, .014, .01), H, mat='Shine', seg=8, rings=6)
    for s in (-1, 1):
        P.ell('Nostril', (nose[0] + s * .03, nose[1] - .01, nose[2] + .065), (.014, .012, .008), H, mat='Nose', seg=8, rings=6)
        for i in range(2):  # вуса
            P.tube('Whisker', [(s * .1, mz[1] - .02 + i * .04, mz[2] + .14), (s * .24, mz[1] - .01 + i * .07, mz[2] + .13), (s * .36, mz[1] + i * .1, mz[2] + .1)], .007, H, mat='Ink', taper=.6, res=1)
    P.mouth_w(HC, -.15, HR[2] * .72 + .22, w=.028)
    for s in (-1, 1):
        P.ell('Blush', (HC[0] + s * .24, HC[1] - .06, HC[2] + .3), (.055, .028, .012), H, mat='Blush', seg=12, rings=8, rot=rotZ(s * .5))
    P.eyes(HC, HR, .17, .1, .062, 0x2a2232, lid_grad=(0xa48a9a, 0x8a7080))
    for s, nm in ((-1, 'EarL'), (1, 'EarR')):
        P.ell('Ear', (HC[0] + s * .31, HC[1] + .26, HC[2] - .06), (.08, .08, .055), {nm: 1}, grad=(TOP, BOT), seg=10, rings=8)
    LEGS = {'LF': (-.34, .25, .36), 'RF': (.34, .25, .36), 'LB': (-.34, .25, -.38), 'RB': (.34, .25, -.38)}
    for k, (x, y, z) in LEGS.items():
        up, lo = 'Leg' + k, 'Leg' + k + '2'
        def lw(c, up=up, lo=lo): t = min(1, max(0, (.18 - c[1]) / .1)); return {up: 1 - t, lo: t}
        P.ell('Thigh', (x, y - .06, z), (.15, .14, .16), lw, grad=LEGC, seg=14, rings=10)
        P.ell('Paw', (x, .06, z + .07), (.15, .065, .19), {lo: 1}, grad=FOOT, seg=14, rings=8)
        front = k[1] == 'F'
        for j in range(3):
            L = (.3 if form >= 3 else .2) if front else .1; r = .045 if front else .028
            b = (x + (j - 1) * (.075 if front else .055), .07, z + .2)
            P.cone('Claw', b, (b[0] + (j - 1) * .04, .03, b[2] + L), r, {lo: 1}, mat='Steel' if (form >= 3 and front) else 'Claw', seg=8)
    P.ell('Tail', (0, .42, -.72), (.05, .05, .13), {'Tail': 1}, grad=(0xffa8b4, 0xf08a9a), seg=10, rings=8)
    if form >= 2:  # шахтарська каска з ліхтариком
        P.ell('Helmet', (HC[0], HC[1] + .16, HC[2] - .08), (.47, .3, .43), H, mat='Helmet', seg=22, rings=14)
        P.ell('Brim', (HC[0], HC[1] + .17, HC[2] - .04), (.5, .028, .47), H, mat='HelmetD', seg=24, rings=6)
        P.ell('LampBase', (HC[0], HC[1] + .34, HC[2] + .3), (.07, .07, .04), H, mat='HelmetD', seg=12, rings=8)
        P.gem('Lamp', (HC[0], HC[1] + .34, HC[2] + .34), .075, .09, H, 'Lamp')
    if form >= 3:
        b = (nose[0], nose[1] - .02, nose[2] + .06)
        P.cone('NoseDrill', b, (b[0], b[1], b[2] + .42), .11, H, mat='Steel', seg=12)
        for i in range(4):
            P.ell('DrillRing', (b[0], b[1], b[2] + .06 + i * .09), (.1 - .022 * i, .1 - .022 * i, .014), H, mat='Steel', seg=14, rings=6)
        for (x, y, z, r) in ((0, 1.0, .12, .24), (-.26, .9, -.12, .2), (.26, .9, -.12, .2), (0, .98, -.34, .22), (-.2, .84, -.48, .16), (.2, .84, -.48, .16)):
            P.ell('Armor', (x, y, z), (r, r * .5, r), bodyW, mat='StoneA', seg=7, rings=5, rot=rotZ(x * 2))
        P.gem('BackCrystal', (0, 1.14, -.1), .07, .15, bodyW, 'Lamp'); P.gem('BackCrystal2', (.16, 1.04, -.3), .05, .1, bodyW, 'Lamp', rot=rotY(-.4))
    P.quad_rig(hips=(0, .52, -.45), chest=(0, .56, .05), neck=(0, .58, .42), head_top=(0, 1.1, .7),
               legs={k: (x, y + .01, z) for k, (x, y, z) in LEGS.items()}, tail=[(0, .42, -.62), (0, .42, -.85)],
               ears={'EarL': ((-.28, HC[1] + .2, HC[2] - .06), (-.33, HC[1] + .34, HC[2] - .06)), 'EarR': ((.28, HC[1] + .2, HC[2] - .06), (.33, HC[1] + .34, HC[2] - .06))})
    return P

RIG = {'tail': ('Tail',)}
