# Попелюх (№11, вогонь/темрява, ДД) — попелястий лис із жариною на кінчику пухнастого хвоста, помаранчевими очима й вухами.
# Тотожність — з гри: pal-models.js buildAsh, pal-forms.js (10): форма 2 — три хвости з жаринами, знак-жарина на лобі;
# форма 3 — вогняна грива, темна маска, палаючі лапи.
import math
from pal_lib import Pal, rotY, rotZ, rotX, S, C

TOP, BOT = 0x8f8996, 0x4a444e
BELLY = (0xf0e8e0, 0xd8ccc2)
LEGC = (0x6a6470, 0x2e2a32); FOOT = (0x26222a, 0x1a161e)
HC = (0, .98, .52); HR = (.44, .4, .4)

def build(form, ks):
    P = Pal('popeliukh', form, ks)
    P.mat('Ember', 0xffb04a, .3, emis=2.2, emis_hex=0xff5a1a)
    P.mat('Flame', 0xff8a2a, .3, emis=2.0, emis_hex=0xff3a0a)
    P.mat('DarkTip', 0x2e2a32, .8)
    def bodyW(c):
        v = min(1, max(0, (c[2] + .25) / .6)); return {'Base': 1 - v, 'Chest': v}
    P.blob_union('Body', [((0, .6, -.05), (.4, .38, .55)), ((0, .66, .22), (.37, .36, .3)), ((0, .58, -.34), (.36, .34, .3))], bodyW, (TOP, BOT), fluff=.025, ffreq=13, dec=.07)
    P.ell('Bib', (0, .66, .44), (.24, .24, .18), bodyW, grad=BELLY, seg=14, rings=10, fluff=.025, ffreq=15)
    H = {'Head': 1}
    P.ell('Head', HC, HR, H, grad=(0x9a94a2, 0x6a6470), seg=24, rings=18)
    for s in (-1, 1):  # білі пухнасті щоки
        P.ell('Cheek', (HC[0] + s * .33, HC[1] - .14, HC[2] + .12), (.13, .1, .11), H, grad=BELLY, seg=12, rings=8, rot=rotY(s * .5), fluff=.02, ffreq=16)
    mz = (HC[0], HC[1] - .12, HC[2] + HR[2] * .7)
    P.ell('Muzzle', mz, (.14, .11, .28), H, grad=BELLY, seg=16, rings=12)
    nose = (mz[0], mz[1] + .03, mz[2] + .27)
    P.ell('Nose', nose, (.05, .038, .035), H, mat='Nose', seg=12, rings=8)
    P.ell('NoseShine', (nose[0] - .014, nose[1] + .02, nose[2] + .03), (.013, .008, .006), H, mat='Shine', seg=8, rings=6)
    P.mouth_w(HC, -.19, HR[2] * .7 + .25, w=.028)
    for s in (-1, 1):
        P.ell('Blush', (HC[0] + s * .25, HC[1] - .1, HC[2] + .3), (.055, .028, .012), H, mat='Blush', seg=12, rings=8, rot=rotZ(s * .5))
    P.eyes(HC, HR, .18, .05, .085, 0xff8a1a, lid_grad=(0x9a94a2, 0x7a7480))
    for s, nm in ((-1, 'EarL'), (1, 'EarR')):
        P.ell('Ear', (HC[0] + s * .27, HC[1] + .44, HC[2] - .02), (.14, .3, .08), {nm: 1}, grad=(TOP, 0x2e2a32), seg=14, rings=10, rot=rotY(s * .35))
        P.ell('EarIn', (HC[0] + s * .27, HC[1] + .42, HC[2] + .045), (.07, .19, .03), {nm: 1}, grad=(0xffb07a, 0xff7a3a), seg=12, rings=8, rot=rotY(s * .35))
        tip = (HC[0] + s * .27 + s * S(.35) * .3, HC[1] + .44 + C(.35) * .3, HC[2] - .02)
        P.cone('EarTip', (tip[0] - s * .04, tip[1] - .1, tip[2]), (tip[0] + s * .03, tip[1] + .08, tip[2]), .075, {nm: 1}, mat='DarkTip', seg=8)
    LEGS = {'LF': (-.22, .38, .32), 'RF': (.22, .38, .32), 'LB': (-.22, .38, -.36), 'RB': (.22, .38, -.36)}
    for k, (x, y, z) in LEGS.items():
        up, lo = 'Leg' + k, 'Leg' + k + '2'
        def lw(c, up=up, lo=lo): t = min(1, max(0, (.26 - c[1]) / .12)); return {up: 1 - t, lo: t}
        P.ell('Thigh', (x, y - .1, z), (.11, .18, .12), lw, grad=LEGC, seg=14, rings=10)
        P.ell('Shin', (x, .16, z + .01), (.085, .14, .09), lw, grad=(0x4a444e, 0x2e2a32), seg=12, rings=8)
        P.ell('Paw', (x, .05, z + .05), (.1, .055, .13), {lo: 1}, grad=FOOT, seg=12, rings=8)
        if form >= 3: P.ell('PawFlame', (x, .08, z + .06), (.11, .07, .14), {lo: 1}, mat='Flame', seg=12, rings=8)
    def tw(c): t = min(1, max(0, (-.7 - c[2]) / .25)); return {'Tail': 1 - t, 'Tail2': t}
    t = P.tube('Tail', [(0, .6, -.5), (0, .72, -.7), (0, .92, -.86), (0, 1.12, -.95)], .2, tw, grad=(TOP, BOT), taper=.25, res=4)
    P.fluff(t, 14, .035, 7)  # пухнастий хвіст
    P.ell('TailEmber', (0, 1.2, -.97), (.14, .17, .14), {'Tail2': 1}, mat='Ember', seg=14, rings=10)
    if form >= 2:
        for s in (-1, 1):  # ще два хвости
            t2 = P.tube('Tail2_', [(s * .1, .6, -.5), (s * .25, .72, -.72), (s * .36, .9, -.86)], .15, {'Tail': 1}, grad=(0x7a7480, BOT), taper=.3, res=4)
            P.fluff(t2, 15, .03, 8 + s)
            P.ell('Ember2', (s * .4, .98, -.9), (.1, .12, .1), {'Tail': 1}, mat='Ember', seg=12, rings=8)
        P.gem('ForeEmber', (HC[0], HC[1] + .2, HC[2] + .34), .05, .09, H, 'Ember', rot=rotX(.5))
    if form >= 3:
        for i in range(11):  # вогняна грива
            a = (i / 10 - .5) * 4; L = .34 + .1 * C(a * 1.3)
            b = (S(a) * .38, .84 + C(a) * .3, .2)
            P.cone('Mane', b, (b[0] + S(a) * L * .7, b[1] + C(a) * L * .6, b[2] - L * .55), .085, {'Neck': .6, 'Chest': .4}, mat='Flame' if i % 2 else 'Ember', seg=7)
        for s in (-1, 1):  # темна «маска» над очима
            P.ell('Mask', (HC[0] + s * .2, HC[1] + .16, HC[2] + .3), (.14, .06, .06), H, grad=(0x2a252e, 0x2a252e), seg=12, rings=8, rot=rotZ(-s * .3))
    P.quad_rig(hips=(0, .6, -.42), chest=(0, .64, .05), neck=(0, .74, .3), head_top=(0, 1.46, .58),
               legs={k: (x, y + .01, z) for k, (x, y, z) in LEGS.items()}, tail=[(0, .6, -.5), (0, .78, -.78), (0, 1.15, -.97)],
               ears={'EarL': ((-.24, HC[1] + .2, HC[2] - .02), (-.38, HC[1] + .72, HC[2] - .02)), 'EarR': ((.24, HC[1] + .2, HC[2] - .02), (.38, HC[1] + .72, HC[2] - .02))})
    return P
