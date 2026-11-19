# Сонцеклюв (№10, вогонь/повітря, РДД) — круглий червоний пташеня-фенікс: кремові груди, жовтий дзьоб і чубчик, сонячний вінець за спиною, крильця, жовті лапки.
# Тотожність — з гри: pal-models.js buildSun, pal-forms.js (9): форма 2 — хвіст із пір'я, більший вінець;
# форма 3 — вогняні крила, корона, хвіст-полум'я.
# Скелет як у Бамбузла: LegLF/LegRF — крила (махають у кліпах), LegLB/LegRB — лапи.
import math
from pal_lib import Pal, rotY, rotZ, rotX, S, C

TOP, BOT = 0xff8a6a, 0xd9402e
CR = (0xffeccc, 0xffd9a8); WG = (0xe8583e, 0xb83422)
HC = (0, 1.32, .12); HR = (.4, .36, .36)

def build(form, ks):
    P = Pal('sontseklyv', form, ks)
    P.mat('Sun', 0xffd34e, .3, emis=1.6, emis_hex=0xffa020)
    P.mat('Flame', 0xffc04a, .3, emis=2.0, emis_hex=0xff7a2a)
    P.mat('Beak', 0xffc84a, .4)
    def bodyW(c):
        v = min(1, max(0, (c[1] - .45) / .5)); return {'Base': 1 - v, 'Chest': v}
    P.blob_union('Body', [((0, .66, 0), (.5, .5, .46)), ((0, .9, .04), (.42, .34, .38))], bodyW, (TOP, BOT), fluff=.02, ffreq=14, dec=.07)
    P.ell('Breast', (0, .6, .32), (.33, .35, .15), bodyW, grad=CR, seg=16, rings=12, fluff=.02, ffreq=16)
    H = {'Head': 1}
    P.ell('Head', HC, HR, H, grad=(0xff9a7a, 0xe04a34), seg=24, rings=18)
    P.eyes(HC, HR, .17, .06, .085, 0x8a4a10, lid_grad=(0xff9a7a, 0xf07a5a))
    P.ell('Beak', (HC[0], HC[1] - .08, HC[2] + .38), (.1, .075, .12), H, mat='Beak', seg=14, rings=10)
    P.cone('BeakTip', (HC[0], HC[1] - .07, HC[2] + .44), (HC[0], HC[1] - .1, HC[2] + .55), .06, H, mat='Beak', seg=10)
    for s in (-1, 1):
        P.ell('Blush', (HC[0] + s * .25, HC[1] - .1, HC[2] + .26), (.06, .03, .012), H, mat='Blush', seg=12, rings=8, rot=rotZ(s * .5))
    for i in range(3):  # чубчик
        P.ell('Crest', (HC[0] + (i - 1) * .08, HC[1] + .38 + (.05 if i == 1 else 0), HC[2]), (.045, .11, .045), H, grad=(0xffd34e, 0xe8803a), seg=10, rings=8, rot=rotY((i - 1) * .3))
    # сонячний вінець за головою (на кістці Halo — повільно крутиться в кліпах ефектів не потрібно: крутиться в idle)
    R = .55 if form == 1 else .62 if form == 2 else .7
    hc = (0, 1.32, -.3)
    for i in range(36):
        a0, a1 = i / 36 * 2 * math.pi, (i + 1) / 36 * 2 * math.pi
        P.tube('Halo', [(hc[0] + C(a0) * R, hc[1] + S(a0) * R, hc[2]), (hc[0] + C(a1) * R, hc[1] + S(a1) * R, hc[2])], .035, {'Halo': 1}, mat='Sun', taper=0, res=1)
    for i in range(10 if form == 1 else 12):
        n = 10 if form == 1 else 12; a = i / n * 2 * math.pi
        b = (hc[0] + C(a) * (R + .02), hc[1] + S(a) * (R + .02), hc[2])
        P.cone('Ray', b, (hc[0] + C(a) * (R + .16), hc[1] + S(a) * (R + .16), hc[2]), .045, {'Halo': 1}, mat='Sun', seg=6)
    # крила (кістки LegLF/LegRF)
    for s, k in ((-1, 'LF'), (1, 'RF')):
        up, lo = 'Leg' + k, 'Leg' + k + '2'
        def aw(c, up=up, lo=lo): t = min(1, max(0, (.8 - c[1]) / .2)); return {up: 1 - t, lo: t}
        P.ell('Wing', (s * .55, .7, -.02), (.15, .32, .18), aw, grad=WG, seg=14, rings=10, fluff=.02, ffreq=15)
        if form >= 3:
            pts = [(0, 0), (.2, .4), (.6, .75), (1.15, .6), (.9, .38), (1, .18), (.75, .08), (.55, .14), (.35, 0)]
            P.slab('FireWing', pts, lambda u, v, s=s: (s * (.6 + u * .75), .62 + v * .8, -.1 - u * .25), .02, {lo: .5, up: .5}, mat='Flame')
    LEGS = {'LB': (-.2, .3, .05), 'RB': (.2, .3, .05)}
    for k, (x, y, z) in LEGS.items():
        up, lo = 'Leg' + k, 'Leg' + k + '2'
        P.tube('LegStick', [(x, .3, z), (x, .06, z + .02)], .05, {up: .5, lo: .5}, grad=(0xf0c24a, 0xd9a02a), taper=0, res=2)
        for j in (-1, 0, 1):
            P.cone('Toe', (x, .03, z + .03), (x + j * .09, .02, z + .17), .028, {lo: 1}, grad=(0xf0c24a, 0xd9a02a), seg=6)
    nf = 3 if form == 1 else 5
    for i in range(nf):  # хвіст із пір'я
        a = (i - (nf - 1) / 2) * .3; L = .5 if form == 1 else .7
        P.ell('TailFeather', (S(a) * .2, .75 + L * .3, -.5 - L * .35), (.09, L * .5, .06), {'Tail': 1}, grad=WG if i % 2 else (0xffb45a, 0xe8803a), seg=10, rings=8, rot=rotX(-.75) @ rotY(a))
    if form >= 3:
        for i in range(5):  # корона
            P.cone('Crown', (HC[0] + (i - 2) * .07, HC[1] + HR[1] - .02, HC[2] + .02), (HC[0] + (i - 2) * .1, HC[1] + HR[1] + .2 - abs(i - 2) * .03, HC[2] + .02), .04, H, mat='Sun', seg=5)
        for i in range(3):  # хвіст-полум'я
            P.cone('TailFlame', ((i - 1) * .08, .55, -.55), ((i - 1) * .2, .3, -1.05 - i * .05), .08 - .015 * i, {'Tail': 1}, mat='Flame', seg=7)
    P.quad_rig(hips=(0, .5, -.2), chest=(0, .62, .1), neck=(0, .95, .08), head_top=(0, 1.75, .12),
               legs={k: (x, y, z) for k, (x, y, z) in LEGS.items()}, tail=[(0, .7, -.42), (0, .8, -.7)])
    for s, k in ((-1, 'LF'), (1, 'RF')):
        P.bone('Leg' + k, (s * .46, 1.0, 0), (s * .55, .78, -.01), 'Chest')
        P.bone('Leg' + k + '2', (s * .55, .78, -.01), (s * .58, .45, -.02), 'Leg' + k, True)
    P.bone('Halo', (0, 1.32, -.3), (0, 1.6, -.3), 'Chest')
    return P

RIG = {'tail': ('Tail',), 'ears': ('EarL', 'EarR')}

def extra_clip(kind, F):
    """Вінець повертається під час атаки; крила (LegLF/RF) уже рухаються загальними кліпами."""
    return {'Halo': {'rot': [(1, (0, 0, 0)), (F, (0, 2.0, 0))]}}
