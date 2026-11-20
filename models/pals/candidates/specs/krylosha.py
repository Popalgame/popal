# Крилоша (№6, повітря, хіл) — пухнаста бджоло-метелик: помаранчеві груди, жовте черевце, кремова голова з вусиками, червоні очі,
# помаранчеві передні й бузкові задні крила зі світними цятками; ширяє над землею.
# Тотожність — з гри: pal-models.js buildKryl, pal-forms.js (5): форма 2 — більші крила, довгі вуса з пилковими кульками;
# форма 3 — ще 4 крила (менші), корона з пилку.
import math
from pal_lib import Pal, rotY, rotZ, rotX, S, C

HC = (0, 1.34, .05); HR = (.3, .27, .26)
WINGS = ('WingL', 'WingR', 'Wing2L', 'Wing2R')

def build(form, ks):
    P = Pal('krylosha', form, ks)
    P.mat('WingO', 0xffa860, .5, emis=.25, emis_hex=0x5a2a00, alpha=.9)
    P.mat('WingP', 0xb888f0, .5, emis=.25, emis_hex=0x2a0a50, alpha=.9)
    P.mat('Pollen', 0xffe08a, .3, emis=1.2, emis_hex=0xffb030)
    P.mat('Antenna', 0x7a3a14, .6)
    def bodyW(c):
        v = min(1, max(0, (c[1] - .7) / .3)); return {'Base': 1 - v, 'Chest': v}
    P.ell('Thorax', (0, .97, 0), (.25, .31, .23), bodyW, grad=(0xffb45a, 0xf08a30), seg=20, rings=14, fluff=.03, ffreq=16)
    P.ell('Abdomen', (0, .66, -.06), (.19, .25, .18), bodyW, grad=(0xffe58a, 0xffc84a), seg=18, rings=12)
    for i in range(2):  # смужки на черевці
        P.ell('Stripe', (0, .6 + i * .12, -.06), (.192, .025, .182), bodyW, grad=(0xf08a30, 0xd9602a), seg=18, rings=6)
    P.ell('Collar', (0, 1.13, .02), (.22, .08, .2), {'Chest': 1}, grad=(0xfff4c8, 0xffe58a), seg=16, rings=8, fluff=.025, ffreq=18)
    H = {'Head': 1}
    P.ell('Head', HC, HR, H, grad=(0xffeaa0, 0xffc84a), seg=22, rings=16)
    P.eyes(HC, HR, .12, .03, .09, 0xc23a30, lid_grad=(0xffeaa0, 0xffd870))
    P.mouth_w(HC, -.1, .26, w=.025)
    for s in (-1, 1):
        P.ell('Blush', (HC[0] + s * .19, HC[1] - .09, HC[2] + .2), (.05, .025, .01), H, mat='Blush', seg=12, rings=8, rot=rotZ(s * .5))
    for s, nm in ((-1, 'EarL'), (1, 'EarR')):  # вусики (на кістках вух)
        A = {nm: 1}
        P.ell('AntBall', (HC[0] + s * .1, HC[1] + .28, HC[2] + .02), (.04,) * 3, A, grad=(0xf08a30, 0xd9602a), seg=8, rings=6)
        P.ell('AntBall2', (HC[0] + s * .17, HC[1] + .38, HC[2] + .04), (.04,) * 3, A, grad=(0xf08a30, 0xd9602a), seg=8, rings=6)
        P.ell('AntTip', (HC[0] + s * .22, HC[1] + .47, HC[2] + .05), (.055,) * 3, A, grad=(0xe04a3a, 0xc23a30), seg=10, rings=8)
        if form >= 2:
            P.tube('Feeler', [(HC[0] + s * .06, HC[1] + HR[1] - .04, HC[2] + .04), (HC[0] + s * .16, HC[1] + HR[1] + .22, HC[2] + .12), (HC[0] + s * .3, HC[1] + HR[1] + .32, HC[2] + .06)], .016, A, mat='Antenna', taper=.3, res=1)
            P.ell('FeelerBall', (HC[0] + s * .31, HC[1] + HR[1] + .33, HC[2] + .06), (.05,) * 3, A, mat='Pollen', seg=10, rings=8)
    # крила: горизонтальні пластини (u — назовні, v — вперед/назад), на своїх кістках
    sc = 1.0 if form == 1 else 1.25 if form == 2 else 1.35
    fore = [(0, 0), (.15, .5), (.45, .75), (.75, .8), (1.0, .55), (1.05, .3), (.85, .08), (.4, -.12), (0, -.05)]
    hind = [(0, 0), (.4, .05), (.75, -.15), (.82, -.5), (.6, -.8), (.25, -.7), (0, -.15)]
    def wing(name, pts, bone, s, y0, mat, k, dy=0, tilt=0):
        P.slab(name, pts, lambda u, v, s=s: (s * (.08 + u * .62 * k), y0 + dy + u * tilt, v * .55 * k - .02), .015, {bone: 1}, mat=mat)
        for (u, v) in ((.62, .42), (.82, .4), (.5, .2)) if mat == 'WingO' else ((.4, -.3), (.55, -.5)):
            P.ell('WingDot', (s * (.08 + u * .62 * k), y0 + dy + u * tilt + .012, v * .55 * k - .02), (.035, .012, .035), {bone: 1}, mat='Pollen', seg=8, rings=6)
    for s, side in ((-1, 'L'), (1, 'R')):
        wing('WingF', fore, 'Wing' + side, s, 1.1, 'WingO', sc, tilt=.15)
        wing('WingH', hind, 'Wing2' + side, s, .98, 'WingP', sc, tilt=.08)
        if form >= 3:
            wing('WingF3', fore, 'Wing' + side, s, 1.1, 'WingO', sc * .72, dy=-.18, tilt=-.15)
            wing('WingH3', hind, 'Wing2' + side, s, .98, 'WingP', sc * .72, dy=-.16, tilt=-.1)
    for s, k in ((-1, 'LB'), (1, 'RB')):  # тонкі звисаючі лапки
        P.tube('Leg', [(s * .07, .5, 0), (s * .08, .42, .02), (s * .08, .36, .04)], .035, {'Leg' + k: .5, 'Leg' + k + '2': .5}, grad=(0xd9602a, 0xb84a20), taper=.2, res=1)
        P.ell('Foot', (s * .08, .35, .05), (.045, .03, .05), {'Leg' + k + '2': 1}, grad=(0x8a3a18, 0x6a2a10), seg=8, rings=6)
    if form >= 3:
        for i in range(8):
            a = i / 8 * 2 * math.pi
            P.ell('PollenCrown', (HC[0] + C(a) * .16, HC[1] + HR[1] + .04 + (i % 2) * .05, HC[2] + S(a) * .14), (.04 + (i % 2) * .015,) * 3, H, mat='Pollen', seg=8, rings=6)
        for i in range(5):
            P.ell('Trail', (0, .45 - i * .03, -.2 - i * .14), (.06 - i * .009,) * 3, {'Base': 1}, mat='Pollen', seg=8, rings=6)
    P.bone('Root', (0, 0, 0), (0, 0, .3))
    P.bone('Base', (0, .62, -.25), (0, .78, .08), 'Root')
    P.bone('Chest', (0, .78, .08), (0, .9, .36), 'Base', True)
    P.bone('Neck', (0, 1.08, .02), (0, 1.12, .1), 'Chest')
    P.bone('Head', (0, 1.12, .1), (0, 1.62, .1), 'Neck', True)
    for s, side in ((-1, 'L'), (1, 'R')):
        P.bone('Ear' + side, (HC[0] + s * .08, HC[1] + .22, HC[2]), (HC[0] + s * .22, HC[1] + .5, HC[2] + .05), 'Head')
        P.bone('Wing' + side, (s * .08, 1.1, 0), (s * .7, 1.1, 0), 'Chest')
        P.bone('Wing2' + side, (s * .08, .98, 0), (s * .6, .98, 0), 'Chest')
        k = 'LB' if s < 0 else 'RB'
        P.bone('Leg' + k, (s * .07, .52, 0), (s * .08, .43, .02), 'Base'); P.bone('Leg' + k + '2', (s * .08, .43, .02), (s * .08, .34, .05), 'Leg' + k, True)
    return P

RIG = {'tail': ()}

def _flap(F, n, amp, base=.0):
    out = []
    for i in range(n * 2 + 1):
        f = 1 + F * i / (n * 2); a = base + (amp if i % 2 else -amp)
        out.append((f, a))
    return out
def _wings(F, n, amp):
    k = {}
    for side, sg in (('L', -1), ('R', 1)):
        k['Wing' + side] = {'rot': [(f, (sg * a, 0, 0)) for f, a in _flap(F, n, amp, .1)]}
        k['Wing2' + side] = {'rot': [(f, (sg * a * .8, 0, 0)) for f, a in _flap(F, n, amp, .05)]}
    return k
def extra_base(name, F):
    if name == 'blink': return {}
    n = {'idle': 12, 'walk': 4, 'attack': 4, 'happy': 6}.get(name, 4)
    k = _wings(F, n, .55)
    k['Base'] = {'loc': [(1 + F * i / 4, (0, .31 * .04 * (1 if i % 2 else 0), -.95 * .04 * (1 if i % 2 else 0))) for i in range(5)]}  # ширяння вгору-вниз
    return k
def extra_clip(kind, F):
    return _wings(F, max(3, F // 5), .65)
