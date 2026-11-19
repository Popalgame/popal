# Бамбузл (№1, трава, танк) — зелена двонога панда з темно-зеленими плямами навколо очей, паростком на голові й бамбуковою палицею в лапі.
# Тотожність — з гри: pal-models.js buildBam, pal-forms.js (0): форма 2 — бамбукові наплічники й довгий спис за спиною;
# форма 3 — бамбуковий панцир на грудях і бамбукова корона з листям.
# Скелет: стандартні назви; «передні ноги» LegLF/LegRF — це руки (усі кліпи махають ними як руками), задні LegLB/LegRB — ноги.
import math
from pal_lib import Pal, rotY, rotZ, rotX, S, C

TOP, BOT = 0xa6ea72, 0x62bb48
CR = (0xfffbe6, 0xeee6c0); DG = (0x3a8a45, 0x256a32)
HC = (0, 1.32, .06); HR = (.58, .5, .52)

def build(form, ks):
    P = Pal('bambuzl', form, ks)
    P.mat('Bamboo', 0x7cc04a, .6); P.mat('BambooD', 0x4f8f2e, .6); P.mat('Leaf', 0xb2f27c, .5)
    def bodyW(c):
        v = min(1, max(0, (c[1] - .45) / .5)); return {'Base': 1 - v, 'Chest': v}
    P.blob_union('Body', [((0, .62, 0), (.5, .46, .44)), ((0, .82, .02), (.44, .32, .38))], bodyW, (TOP, BOT), fluff=.015, ffreq=13, dec=.07)
    P.ell('Belly', (0, .6, .36), (.32, .32, .14), bodyW, grad=CR, seg=16, rings=12)
    H = {'Head': 1}
    P.ell('Head', HC, HR, H, grad=(0xb2f27c, 0x78cc55), seg=26, rings=20)
    for s in (-1, 1):  # темні плями навколо очей
        zs = HR[2] * math.sqrt(max(.04, 1 - (.24 / HR[0]) ** 2 - (.06 / HR[1]) ** 2))
        P.ell('Patch', (HC[0] + s * .24, HC[1] + .05, HC[2] + zs - .07), (.15, .19, .09), H, grad=DG, seg=14, rings=10, rot=rotY(-s * .45))
        P.ell('Blush', (HC[0] + s * .38, HC[1] - .12, HC[2] + .36), (.07, .035, .014), H, mat='Blush', seg=12, rings=8, rot=rotZ(s * .5))
    P.eyes(HC, HR, .24, .08, .095, 0x7a4a1a, lid_grad=DG)
    P.ell('Muzzle', (HC[0], HC[1] - .14, HC[2] + .42), (.2, .15, .14), H, grad=CR, seg=16, rings=12)
    P.ell('Nose', (HC[0], HC[1] - .09, HC[2] + .54), (.06, .045, .04), H, mat='Nose', seg=12, rings=8)
    P.ell('NoseShine', (HC[0] - .016, HC[1] - .072, HC[2] + .575), (.015, .009, .007), H, mat='Shine', seg=8, rings=6)
    P.mouth_w(HC, -.2, .545, w=.032)
    for s, nm in ((-1, 'EarL'), (1, 'EarR')):
        P.ell('Ear', (HC[0] + s * .4, HC[1] + .38, HC[2] - .05), (.17, .17, .11), {nm: 1}, grad=DG, seg=14, rings=10)
        P.ell('EarIn', (HC[0] + s * .4, HC[1] + .38, HC[2] + .03), (.09, .09, .04), {nm: 1}, grad=(0xffeedd, 0xffd9c0), seg=10, rings=8)
    for a in (-.8, 0, .8):  # паросток
        P.ell('Sprout', (HC[0] + S(a) * .1, HC[1] + HR[1] + .1 + (0 if a else .05), HC[2]), (.06, .13, .025), H, mat='Leaf', seg=10, rings=8, rot=rotY(a * .9))
    # руки (кістки LegLF/LegRF + лікті LegLF2/LegRF2)
    for s, k in ((-1, 'LF'), (1, 'RF')):
        up, lo = 'Leg' + k, 'Leg' + k + '2'
        def aw(c, up=up, lo=lo): t = min(1, max(0, (.74 - c[1]) / .14)); return {up: 1 - t, lo: t}
        P.ell('Arm', (s * .55, .74, .06), (.15, .28, .15), aw, grad=DG, seg=14, rings=10, rot=rotY(s * .25))
        P.ell('Hand', (s * .6, .5, .1), (.13, .1, .12), {lo: 1}, grad=DG, seg=12, rings=8)
    # ноги
    LEGS = {'LB': (-.24, .34, 0), 'RB': (.24, .34, 0)}
    for k, (x, y, z) in LEGS.items():
        up, lo = 'Leg' + k, 'Leg' + k + '2'
        def lw(c, up=up, lo=lo): t = min(1, max(0, (.2 - c[1]) / .1)); return {up: 1 - t, lo: t}
        P.ell('Thigh', (x, .2, z), (.17, .2, .2), lw, grad=DG, seg=14, rings=10)
        P.ell('Foot', (x, .05, z + .1), (.14, .06, .17), {lo: 1}, grad=CR, seg=12, rings=8)
    P.ell('Tail', (0, .45, -.46), (.14, .14, .14), {'Tail': 1}, grad=CR, seg=12, rings=9, fluff=.02, ffreq=15)
    def stalk(a, b, r, w):
        n = max(2, round(math.dist(a, b) / .22))
        for i in range(n):
            p0 = tuple(a[j] + (b[j] - a[j]) * i / n for j in range(3)); p1 = tuple(a[j] + (b[j] - a[j]) * (i + .96) / n for j in range(3))
            P.tube('Bamboo', [p0, p1], r, w, mat='Bamboo', taper=0, res=2)
            P.ell('Node', p0, (r * 1.2, r * .5, r * 1.2), w, mat='BambooD', seg=10, rings=6)
    # бамбукова палиця в правій руці (форма 1–3)
    stalk((.62, .42, .12), (.62, 1.6, .2), .04, {'LegRF2': 1})
    for a in (-.8, 0, .8):
        P.ell('StaffLeaf', (.62 + S(a) * .16, 1.75 + (0 if a else .06), .2), (.06, .2, .02), {'LegRF2': 1}, mat='Leaf', seg=10, rings=8, rot=rotY(a * .9))
    if form >= 2:
        for s in (-1, 1):  # наплічники
            for i in range(3):
                x = s * (.27 + .05 * i); y = .98 - .06 * i
                stalk((x, y, .17), (x + s * .03, y - .03, -.17), .062, {'Chest': 1})
        top = 2.0 + (.2 if form > 2 else 0)
        stalk((-.38, .35, -.5), (.42, top, -.56), .045, {'Chest': 1})  # спис за спиною
        P.cone('SpearTip', (.43, top, -.56), (.5, top + .4, -.57), .09, {'Chest': 1}, mat='Leaf', seg=6)
    if form >= 3:
        for i in range(5):  # панцир на грудях
            a = (i - 2) * .36; x = S(a) * .22; z = .5 - (1 - C(a)) * .14
            stalk((x, .45, z), (x, .85, z + .02), .042, {'Chest': 1})
        for i in range(7):  # корона з листям
            a = i / 7 * 2 * math.pi; x, z = C(a) * .24, HC[2] + S(a) * .22
            stalk((x, HC[1] + HR[1] - .08, z), (x * 1.05, HC[1] + HR[1] + .12 + (i % 2) * .08, z * 1.05), .035, H)
            P.ell('CrownLeaf', (x * 1.08, HC[1] + HR[1] + .22 + (i % 2) * .08, z * 1.08), (.05, .12, .02), H, mat='Leaf', seg=8, rings=6, rot=rotZ(a))
    P.quad_rig(hips=(0, .5, -.2), chest=(0, .62, .1), neck=(0, .9, .04), head_top=(0, 1.85, .06),
               legs={k: (x, y, z) for k, (x, y, z) in LEGS.items()}, tail=[(0, .45, -.36), (0, .45, -.58)],
               ears={'EarL': ((-.36, HC[1] + .28, HC[2] - .05), (-.44, HC[1] + .5, HC[2] - .05)), 'EarR': ((.36, HC[1] + .28, HC[2] - .05), (.44, HC[1] + .5, HC[2] - .05))})
    for s, k in ((-1, 'LF'), (1, 'RF')):
        P.bone('Leg' + k, (s * .5, .95, .04), (s * .56, .72, .07), 'Chest')
        P.bone('Leg' + k + '2', (s * .56, .72, .07), (s * .6, .45, .1), 'Leg' + k, True)
    return P

RIG = {'tail': ('Tail',)}
