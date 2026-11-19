# Мороріг (№7, лід, РДД) — біле крижане оленятко з кристалами-ріжками, рожевим носиком і пухнастим нагрудником.
# Тотожність — з гри: pal-models.js buildMoror, pal-forms.js (6): форма 2 — крижані гілки на ріжках, пухнаста грива;
# форма 3 — більше гілок, великі крижані роги, крижаний нагрудник, корона з кристалів.
import math
from pal_lib import Pal, rotY, rotZ, rotX, S, C

TOP, BOT = 0xeef8ff, 0xa9d4ea
BELLY = (0xffffff, 0xeaf6ff)
LEGC = (0xdcefff, 0xa9d4ea); FOOT = (0x6a7a96, 0x4a5a76)
HC = (0, 1.12, .5); HR = (.42, .38, .4)

def build(form, ks):
    P = Pal('mororyh', form, ks)
    P.mat('Ice', 0x9aeaff, .15, emis=.7, emis_hex=0x2a9ad0, alpha=.88)
    P.mat('IceDeep', 0x6fd4ff, .12, emis=.9, emis_hex=0x2a9ad0, alpha=.9)
    def bodyW(c):
        v = min(1, max(0, (c[2] + .25) / .6)); return {'Base': 1 - v, 'Chest': v}
    P.blob_union('Body', [((0, .7, -.05), (.46, .42, .58)), ((0, .76, .25), (.42, .4, .32)), ((0, .68, -.38), (.42, .38, .3))], bodyW, (TOP, BOT), fluff=.03, ffreq=12, dec=.07)
    # пухнастий нагрудник (як у гри: torso blob 0,.78,.45)
    P.ell('Bib', (0, .76, .45), (.3, .28, .2), bodyW, grad=BELLY, seg=16, rings=12, fluff=.03, ffreq=14)
    for i in range(4):
        P.ell('BibTuft', (-.15 + .1 * i, .6 + (i % 2) * .05, .5), (.09, .1, .08), bodyW, grad=BELLY, seg=10, rings=7, fluff=.02, ffreq=16)
    H = {'Head': 1}
    P.ell('Head', HC, HR, H, grad=(TOP, 0xc9e6f6), seg=24, rings=18)
    for s in (-1, 1):
        P.ell('Cheek', (HC[0] + s * .26, HC[1] - .14, HC[2] + .1), (.12, .1, .11), H, grad=(0xffffff, 0xdcefff), seg=12, rings=8, fluff=.02, ffreq=16)
    mz = (HC[0], HC[1] - .1, HC[2] + HR[2] * .8)
    P.ell('Muzzle', mz, (.17, .12, .15), H, grad=(0xffffff, 0xe8f2fa), seg=16, rings=12)
    P.ell('Nose', (mz[0], mz[1] + .05, mz[2] + .13), (.05, .038, .032), H, mat='Blush', seg=12, rings=8)
    P.ell('NoseShine', (mz[0] - .013, mz[1] + .068, mz[2] + .158), (.013, .008, .006), H, mat='Shine', seg=8, rings=6)
    P.mouth_w(HC, -.16, HR[2] * .8 + .14, w=.03)
    for s in (-1, 1):
        P.ell('Blush', (HC[0] + s * .23, HC[1] - .09, HC[2] + .3), (.055, .028, .012), H, mat='Blush', seg=12, rings=8, rot=rotZ(s * .5))
    P.eyes(HC, HR, .17, .04, .08, 0x3b6fb8, lid_grad=(TOP, 0xdcefff))
    # круглі вуха в сторони (як у гри: rz −s·0.8)
    for s, nm in ((-1, 'EarL'), (1, 'EarR')):
        P.ell('Ear', (HC[0] + s * .38, HC[1] + .2, HC[2] - .05), (.1, .19, .07), {nm: 1}, grad=(TOP, 0xbfe2f2), seg=14, rings=10, rot=rotY(s * .85))
        P.ell('EarIn', (HC[0] + s * .38, HC[1] + .2, HC[2] + .0), (.055, .12, .02), {nm: 1}, grad=(0xffd6e2, 0xf2b6c8), seg=12, rings=8, rot=rotY(s * .85))
    # крижані ріжки (3 кристали з кожного боку)
    for s in (-1, 1):
        for (x, y, z, r, h, t) in ((.15, .46, -.02, .06, .24, .3), (.27, .62, -.02, .045, .18, .8), (.08, .7, -.04, .04, .16, .15)):
            P.gem('Antler', (HC[0] + s * x, HC[1] + y, HC[2] + z), r, h, H, 'Ice', rot=rotY(s * t))
    # лапи (вищі, ніж у Грозовика)
    LEGS = {'LF': (-.24, .44, .3), 'RF': (.24, .44, .3), 'LB': (-.24, .44, -.32), 'RB': (.24, .44, -.32)}
    for k, (x, y, z) in LEGS.items():
        up, lo = 'Leg' + k, 'Leg' + k + '2'
        def lw(c, up=up, lo=lo): t = min(1, max(0, (.3 - c[1]) / .14)); return {up: 1 - t, lo: t}
        P.ell('Thigh', (x, y - .1, z), (.11, .2, .12), lw, grad=LEGC, seg=14, rings=10, fluff=.015, ffreq=16)
        P.ell('Shin', (x, .17, z + .01), (.085, .15, .09), lw, grad=LEGC, seg=12, rings=8)
        P.ell('Hoof', (x, .05, z + .03), (.1, .06, .12), {lo: 1}, grad=FOOT, seg=12, rings=8)
        P.ell('HoofSplit', (x, .06, z + .135), (.011, .04, .026), {lo: 1}, mat='Ink', seg=8, rings=6)
    P.ell('Tail', (0, .85, -.67), (.12, .12, .12), {'Tail': 1}, grad=BELLY, seg=12, rings=8, fluff=.025, ffreq=14)
    # форма 2–3: гілки на ріжках, грива; форма 3 — великі роги, нагрудник, корона
    if form >= 2:
        n = 4 if form >= 3 else 2
        for s in (-1, 1):
            for i in range(n):
                y = HC[1] + HR[1] + .1 + i * .12; b = (HC[0] + s * (.2 + i * .07), y, HC[2] - .05 - i * .03)
                a = .7 + i * .15; L = .22 + i * .04
                P.cone('Branch', b, (b[0] + s * S(a) * L, b[1] + C(a) * L, b[2] - .05), .04, H, mat='Ice', seg=6)
        for i in range(5):
            P.ell('Mane', (HC[0] + (.06 if i % 2 else -.06), HC[1] - HR[1] + .05 + i * .04, HC[2] - HR[2] - .02 - i * .05), (.1 - .01 * i,) * 3, {'Neck': .6, 'Head': .4},
                  grad=(0xeaf6ff, 0xcfe6f4), seg=12, rings=9, fluff=.025, ffreq=14)
    if form >= 3:
        for s in (-1, 1):
            b = (HC[0] + s * .18, HC[1] + HR[1] + .05, HC[2] - .12)
            P.cone('BigAntler', b, (b[0] + s * .14, b[1] + .55, b[2] - .08), .07, H, mat='IceDeep', seg=6)
            P.cone('BigAntlerB', (b[0] + s * .07, b[1] + .28, b[2] - .1), (b[0] + s * .3, b[1] + .45, b[2] - .14), .035, H, mat='IceDeep', seg=6)
        for i in range(5):
            a = (i - 2) * .4
            P.gem('Crown', (HC[0] + S(a) * .12, HC[1] + HR[1] + .06 + C(a) * .04, HC[2] + .06), .06, .13, H, 'Ice', rot=rotY(a))
        P.ell('Breastplate', (0, .78, .62), (.24, .2, .09), bodyW, mat='Ice', seg=16, rings=10)
    P.quad_rig(hips=(0, .7, -.42), chest=(0, .74, .05), neck=(0, .84, .28), head_top=(0, 1.6, .55),
               legs={k: (x, y + .01, z) for k, (x, y, z) in LEGS.items()}, tail=[(0, .82, -.6), (0, .88, -.78)],
               ears={'EarL': ((-.3, HC[1] + .14, HC[2] - .05), (-.55, HC[1] + .3, HC[2] - .05)), 'EarR': ((.3, HC[1] + .14, HC[2] - .05), (.55, HC[1] + .3, HC[2] - .05))})
    return P

RIG = {'tail': ('Tail',)}
