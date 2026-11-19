# Хвилезуб (№9, вода, ДД) — акуло-песик: довге синє тіло зі світлим черевцем, спинний і бічні плавці, хвіст-плавець з двох лопатей, золоті очі й два зубки.
# Тотожність — з гри: pal-models.js buildShark, pal-forms.js (8): форма 2 — більший спинний плавник, плавці на лапах;
# форма 3 — подвійний плавник, броньована морда, водяне кільце.
import math
from pal_lib import Pal, rotY, rotZ, rotX, S, C

TOP, BOT = 0x8cc4f2, 0x4a86c0
BELLY = (0xffffff, 0xe3eef8)
FIN = (0x7ab6ec, 0x4a86c0)
LEGC = (0x5a96d0, 0x3a6aa0); FOOT = (0x2e5f96, 0x24507e)
HC = (0, .64, .76); HR = (.46, .4, .42)

def build(form, ks):
    P = Pal('khvylezub', form, ks)
    P.mat('Tooth', 0xffffff, .3)
    P.mat('ArmorB', 0x8a9ab0, .3, metal=.6)
    P.mat('Wave', 0x6ad0ff, .1, emis=.8, alpha=.5)
    def bodyW(c):
        v = min(1, max(0, (c[2] + .35) / .8)); return {'Base': 1 - v, 'Chest': v}
    P.blob_union('Body', [((0, .55, 0), (.5, .46, .85)), ((0, .6, .32), (.46, .43, .45)), ((0, .52, -.45), (.4, .38, .42))], bodyW, (TOP, BOT), fluff=0, dec=.07)
    P.ell('Belly', (0, .4, .25), (.36, .26, .55), bodyW, grad=BELLY, seg=18, rings=10)
    H = {'Head': 1}
    P.ell('Head', HC, HR, H, grad=(0x9cd0f8, 0x5a96d0), seg=24, rings=18)
    P.ell('Jaw', (HC[0], HC[1] - .17, HC[2] + .12), (.36, .2, .3), H, grad=BELLY, seg=18, rings=12)
    for s in (-1, 1):  # два зубки
        P.cone('Tooth', (HC[0] + s * .08, HC[1] - .1, HC[2] + .445), (HC[0] + s * .08, HC[1] - .19, HC[2] + .45), .03, H, mat='Tooth', seg=8)
        P.ell('Gill', (HC[0] + s * .38, HC[1] - .05, HC[2] - .1), (.012, .09, .03), H, mat='Ink', seg=8, rings=6, rot=rotX(.2))
        P.ell('Gill2', (HC[0] + s * .36, HC[1] - .06, HC[2] - .17), (.012, .08, .03), H, mat='Ink', seg=8, rings=6, rot=rotX(.2))
    P.ell('Nose', (HC[0], HC[1] + .02, HC[2] + .41), (.05, .03, .025), H, mat='Nose', seg=12, rings=8)
    P.mouth_w(HC, -.1, .445, w=.03)
    for s in (-1, 1):
        P.ell('Blush', (HC[0] + s * .27, HC[1] - .06, HC[2] + .3), (.06, .03, .012), H, mat='Blush', seg=12, rings=8, rot=rotZ(s * .5))
    P.eyes(HC, HR, .22, .12, .088, 0xe8b020, lid_grad=(0x9cd0f8, 0x7ab4e8))
    # плавці: спинний (у площині вгору-вперед), бічні, хвостовий
    def side_plane(x):
        return lambda u, v: (x, v, u)
    def dorsal(z0, sc):
        pts = [(0, 0), (.05 * sc, .35 * sc), (.2 * sc, .6 * sc), (.42 * sc, .62 * sc), (.3 * sc, .4 * sc), (.32 * sc, .18 * sc), (.36 * sc, 0)]
        P.slab('Dorsal', [(z0 + .2 * sc - u, 1.0 + v) for u, v in pts], side_plane(0), .05, bodyW, grad=FIN)
    dorsal(-.1, 1.0 if form == 1 else (1.15 if form == 2 else 1.25))
    if form >= 3: dorsal(-.5, .7)
    for s in (-1, 1):
        P.ell('Pectoral', (s * .55, .42, .25), (.22, .05, .13), bodyW, grad=FIN, seg=12, rings=8, rot=rotY(s * .5))
    def tw(c): t = min(1, max(0, (-.95 - c[2]) / .25)); return {'Tail': 1 - t, 'Tail2': t}
    P.tube('TailStem', [(0, .56, -.7), (0, .6, -.95), (0, .64, -1.12)], .16, tw, grad=(TOP, BOT), taper=.5, res=3)
    P.ell('TailUp', (0, .86, -1.25), (.06, .3, .2), {'Tail2': 1}, grad=FIN, seg=12, rings=10, rot=rotX(.9))
    P.ell('TailDn', (0, .48, -1.22), (.05, .2, .16), {'Tail2': 1}, grad=FIN, seg=12, rings=10, rot=rotX(2.3))
    LEGS = {'LF': (-.3, .28, .45), 'RF': (.3, .28, .45), 'LB': (-.3, .28, -.5), 'RB': (.3, .28, -.5)}
    for k, (x, y, z) in LEGS.items():
        up, lo = 'Leg' + k, 'Leg' + k + '2'
        def lw(c, up=up, lo=lo): t = min(1, max(0, (.2 - c[1]) / .1)); return {up: 1 - t, lo: t}
        P.ell('Thigh', (x, y - .06, z), (.13, .15, .14), lw, grad=LEGC, seg=14, rings=10)
        P.ell('Paw', (x, .06, z + .06), (.14, .065, .17), {lo: 1}, grad=FOOT, seg=14, rings=8)
        if form >= 2:  # плавці на лапах
            s = 1 if x > 0 else -1
            P.slab('LegFin', [(0, 0), (.22, .06), (.28, -.04), (.1, -.08)], lambda u, v, x=x, z=z, s=s: (x + s * (.08 + u * .9), .2 + v, z - .05 - u * .3), .025, {up: 1}, grad=FIN)
    if form >= 3:
        P.ell('Helm', (HC[0], HC[1] + HR[1] - .06, HC[2] + .12), (.22, .1, .28), H, mat='ArmorB', seg=16, rings=10, rot=rotX(.3))
        P.ell('WaveRing', (0, .06, 0), (.8, .03, .8), {'Root': 1}, mat='Wave', seg=32, rings=6)
    P.quad_rig(hips=(0, .55, -.6), chest=(0, .58, .05), neck=(0, .6, .45), head_top=(0, 1.1, .82),
               legs={k: (x, y + .01, z) for k, (x, y, z) in LEGS.items()}, tail=[(0, .56, -.7), (0, .6, -.98), (0, .66, -1.25)])
    return P

RIG = {'ears': ('EarL', 'EarR')}
