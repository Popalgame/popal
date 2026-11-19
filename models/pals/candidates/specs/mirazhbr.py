# Міражбр (№4, темрява/привид, ДД) — напівпрозорий бузковий привид-аксолотль: світне ядро в тілі, очі на горбиках, хвіст-спіраль, бірюзові кристали.
# Тотожність — з гри: pal-models.js buildMiraj, pal-forms.js (3): форма 2 — хвіст-спіраль, гребінь, тіньові плавці;
# форма 3 — ширяє над землею, плащ-крила, світні візерунки.
import math
from pal_lib import Pal, rotY, rotZ, rotX, S, C

TOP, BOT = 0xe6d8ff, 0xb090f4
LEGC = (0xcab0ff, 0x9a7ae8); FOOT = (0x8a6ad8, 0x7a5ac8)

def build(form, ks):
    HOV = .3 if form >= 3 else .05      # ширяння (у формі 3 — високо)
    def Y(p): return (p[0], p[1] + HOV, p[2])
    HC = Y((0, .82, .62)); HR = (.42, .36, .38)
    P = Pal('mirazhbr', form, ks)
    P.mat('Aura', 0xc8a8ff, .3, emis=.6, alpha=.2)  # світний ореол «привида» (тіло непрозоре: прозора сітка зі скелетом дає артефакти сортування)
    P.mat('Core', 0xd8c6ff, .2, emis=1.6, emis_hex=0xa070ff)
    P.mat('Teal', 0x5ff0e0, .2, emis=1.4, emis_hex=0x18b8a8)
    P.mat('Shade', 0x5a3aa0, .4, emis=.35, alpha=.82)
    P.mat('Glow', 0x9fe8ff, .2, emis=2.0, emis_hex=0x6ad0ff)
    def bodyW(c):
        v = min(1, max(0, (c[2] + .25) / .6)); return {'Base': 1 - v, 'Chest': v}
    o = P.blob_union('Body', [(Y((0, .62, 0)), (.5, .46, .62)), (Y((0, .66, .3)), (.46, .42, .36))], bodyW, (TOP, BOT), dec=.07)
    P.ell('AuraBody', Y((0, .64, .08)), (.56, .52, .76), bodyW, mat='Aura', seg=20, rings=14)
    P.ell('Core', Y((0, .62, .05)), (.24, .2, .3), bodyW, mat='Core', seg=16, rings=12)
    for (x, y, z, r, h) in ((0, 1.1, .1, .08, .2), (-.15, 1.05, -.15, .06, .16), (.15, 1.05, -.15, .06, .16)):
        P.gem('BackGem', Y((x, y, z)), r, h, bodyW, 'Teal')
    H = {'Head': 1}
    P.ell('Head', HC, HR, H, grad=(0xeee2ff, 0xc0a2f8), seg=24, rings=18)
    P.ell('AuraHead', HC, (HR[0] * 1.08, HR[1] * 1.1, HR[2] * 1.08), H, mat='Aura', seg=18, rings=12)
    EH = (HC[0], HC[1] + .24, HC[2] + .1)  # горбики для очей
    for s in (-1, 1):
        P.ell('EyeBump', (EH[0] + s * .2, EH[1] - .02, EH[2] - .07), (.13, .13, .12), H, grad=(0xcdb4ff, 0x9a78e8), seg=16, rings=12)
        P.ell('Blush', (HC[0] + s * .28, HC[1] - .08, HC[2] + .3), (.06, .03, .012), H, mat='Blush', seg=12, rings=8, rot=rotZ(s * .5))
        P.ell('Gill', (HC[0] + s * .42, HC[1] + .05, HC[2] - .05), (.04, .12, .03), H, mat='Teal', seg=8, rings=6, rot=rotY(s * .9))
    P.eyes((EH[0], EH[1], EH[2]), (.36, .16, .16), .2, .0, .085, 0x3ad0c0, lid_grad=(0xcdb4ff, 0xb494f5))
    P.mouth_w(HC, -.08, .37, w=.035)
    LEGS = {'LF': (-.3, .3, .35), 'RF': (.3, .3, .35), 'LB': (-.3, .3, -.35), 'RB': (.3, .3, -.35)}
    for k, (x, y, z) in LEGS.items():
        up, lo = 'Leg' + k, 'Leg' + k + '2'
        def lw(c, up=up, lo=lo): t = min(1, max(0, (.2 + HOV - c[1]) / .1)); return {up: 1 - t, lo: t}
        P.ell('Thigh', Y((x, y - .08, z)), (.1, .14, .1), lw, grad=LEGC, seg=12, rings=9)
        P.ell('Paw', Y((x, .07, z + .04)), (.1, .055, .12), {lo: 1}, grad=FOOT, seg=12, rings=8)
    # хвіст-спіраль (форма 1 — коротша; форма 2+ — довша, з більшою кількістю кілець)
    n = 12 if form == 1 else 16
    for k in range(n + 1):
        t = k / n; th = t * (2.5 if form == 1 else 3.2) * math.pi; r = .34 * (1 - .62 * t)
        c = Y((0, .62 + r * S(th), -.95 + r * C(th))); rr = .11 - .07 * t
        P.ell('TailBead', c, (rr, rr, rr), {'Tail': 1 - t, 'Tail2': t}, grad=(TOP, BOT), seg=12, rings=8)
    P.ell('TailTip', Y((0, .8, -.9)), (.06, .06, .06), {'Tail2': 1}, mat='Teal', seg=10, rings=8)
    if form >= 2:
        for i in range(5):  # гребінь
            z0 = .35 - i * .16; sc = 1 + .2 * S(i)
            P.slab('Crest', [(0, 0), (.08, .18), (.18, 0)], lambda u, v, z0=z0, sc=sc: (0, 1.06 + HOV + v * sc, z0 - u * sc), .02, bodyW, grad=(0xa07af0, 0x8a64e0))
        for s in (-1, 1):  # тіньові плавці
            P.slab('ShadeFin', [(0, 0), (.3, .12), (.5, -.05), (.25, -.12)], lambda u, v, s=s: (s * (.48 + u * .8), .62 + HOV + v, .05 - u * .55), .015, bodyW, mat='Shade')
    if form >= 3:
        for s in (-1, 1):  # плащ-крила
            pts = [(0, 0), (.1, .6), (.55, .95), (1.1, .7), (.85, .45), (.9, .2), (.6, .12), (.35, .15), (.15, 0)]
            P.slab('Wing', pts, lambda u, v, s=s: (s * (.12 + u * .8), 1.0 + HOV + v * .7, -.1 - u * .35 + v * .1), .015, {'Chest': 1}, mat='Shade')
        for i in range(6):  # світні візерунки на боках
            a = i / 6 * math.pi
            for s in (-1, 1): P.ell('Pattern', Y((s * .47, .62 + .25 * C(a), .3 - .6 * i / 5)), (.012, .04, .04), bodyW, mat='Glow', seg=8, rings=6)
    P.quad_rig(hips=Y((0, .62, -.42)), chest=Y((0, .66, .05)), neck=Y((0, .7, .4)), head_top=Y((0, 1.3, .66)),
               legs={k: Y((x, y + .01, z)) for k, (x, y, z) in LEGS.items()}, tail=[Y((0, .6, -.62)), Y((0, .62, -.85)), Y((0, .78, -.95))])
    P.ao = .4
    return P
