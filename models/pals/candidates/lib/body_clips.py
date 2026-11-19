# Анімації тіла чотирилапого попала (стандартні кістки pal_lib.quad_rig). Осі кісток перевірено в Blender (Пухоклуб, axes.py):
#   Base: локальна Z дивиться ВНИЗ → підйом тіла UP(d), рух уперед FWD(d); rot x < 0 — стати дибки.
#   Chest: rot x > 0 — нахил уперед; rot y — похитування вбік.  Head: rot x > 0 — кивок уперед/вниз; rot z — нахил набік; rot y — поворот.
#   Ноги: rot x > 0 — назад, < 0 — вперед.  Вуха, хвіст: rot z — помах.  Повіки: rot x = BLINK — закрито.  Root: rot z — оберт навколо вертикалі.
import math
S = math.sin; TAU = 2 * math.pi
BLINK = -1.6
def UP(d): return (0, .31 * d, -.95 * d)
def FWD(d): return (0, .95 * d, .31 * d)
def add(*a): return tuple(sum(v) for v in zip(*a))
def cyc(n, F, f): return [(1 + F * i / n, f(i / n)) for i in range(n + 1)]
def K(F, vals): return [(1 + F * i / (len(vals) - 1), v) for i, v in enumerate(vals)]
def alt(start, step, n, amp, axis=2, end=None):
    out = [(1, (0, 0, 0))]
    for i in range(n):
        v = [0, 0, 0]; v[axis] = amp * (1 if i % 2 else -1); out.append((start + i * step, tuple(v)))
    out.append((end or start + n * step + 2, (0, 0, 0))); return out
LEGS = ('LegLF', 'LegRF', 'LegLB', 'LegRB')

# тривалість кліпів атак за видом (кадрів при 30/с) — спільна з ефектами (fx_lib)
DUR = {'melee': 26, 'dash': 30, 'shot': 30, 'multi': 42, 'beam': 48, 'aoe': 54, 'nova': 40, 'dot': 36, 'heal': 40, 'shield': 36, 'taunt': 40}
def kind_of(a): return 'dash' if a['k'] == 'melee' and (a.get('dash') or any(w in a['n'].lower() for w in ('ривок', 'стрибок', 'таран', 'відскок', 'пікірування', 'шквал'))) else a['k']

def base_clips(tail=('Tail', 'Tail2'), ears=('EarL', 'EarR'), lids=('LidL', 'LidR'), bob=1.0):
    C = {}; t1, t2 = (tail + (None, None))[:2]; eL, eR = ears
    F = 72
    k = {'Chest': {'rot': cyc(8, F, lambda t: (.035 * S(TAU * t), 0, 0))}, 'Head': {'rot': cyc(8, F, lambda t: (-.04 * S(TAU * t), 0, 0))},
         eL: {'rot': cyc(8, F, lambda t: (0, 0, .1 * S(TAU * t)))}, eR: {'rot': cyc(8, F, lambda t: (0, 0, -.1 * S(TAU * t)))}}
    if t1: k[t1] = {'rot': cyc(8, F, lambda t: (0, 0, .2 * S(TAU * t)))}
    if t2: k[t2] = {'rot': cyc(8, F, lambda t: (0, 0, .15 * S(TAU * t - 1)))}
    for l in lids: k[l] = {'rot': [(1, (0, 0, 0)), (44, (0, 0, 0)), (47, (BLINK, 0, 0)), (50, (0, 0, 0)), (73, (0, 0, 0))]}
    C['idle'] = (F, k)
    F = 24
    leg = lambda ph, amp=.55: (lambda t: (amp * S(TAU * (t + ph)), 0, 0))
    knee = lambda ph: (lambda t: (max(0, S(TAU * (t + ph) + 1.2)) * .7, 0, 0))
    k = {'Base': {'loc': cyc(8, F, lambda t: UP(.025 * bob * abs(S(TAU * t))))}, 'Chest': {'rot': cyc(8, F, lambda t: (.04 * S(TAU * t * 2), 0, 0))},
         'Head': {'rot': cyc(8, F, lambda t: (-.05 * S(TAU * t * 2), .07 * S(TAU * t), .05 * S(TAU * t)))},
         'Neck': {'rot': cyc(8, F, lambda t: (.03 * S(TAU * t * 2 - .6), 0, 0))},
         'LegLF': {'rot': cyc(8, F, leg(0))}, 'LegRB': {'rot': cyc(8, F, leg(0))}, 'LegRF': {'rot': cyc(8, F, leg(.5))}, 'LegLB': {'rot': cyc(8, F, leg(.5))},
         'LegLF2': {'rot': cyc(8, F, knee(0))}, 'LegRB2': {'rot': cyc(8, F, knee(0))}, 'LegRF2': {'rot': cyc(8, F, knee(.5))}, 'LegLB2': {'rot': cyc(8, F, knee(.5))},
         eL: {'rot': cyc(8, F, lambda t: (.1 * S(TAU * t * 2 - 1.2), 0, .14 * S(TAU * t * 2 - 1)))},
         eR: {'rot': cyc(8, F, lambda t: (.1 * S(TAU * t * 2 - 1.2), 0, -.14 * S(TAU * t * 2 - 1)))}}
    if t1: k[t1] = {'rot': cyc(8, F, lambda t: (0, 0, .28 * S(TAU * t)))}
    if t2: k[t2] = {'rot': cyc(8, F, lambda t: (0, 0, .2 * S(TAU * t - 1)))}
    C['walk'] = (F, k)
    F = 20
    k = {'Base': {'loc': K(F, [(0, 0, 0), FWD(-.08), FWD(.16), (0, 0, 0)])}, 'Chest': {'rot': K(F, [(0, 0, 0), (-.16, 0, 0), (.17, 0, 0), (0, 0, 0)])},
         'Head': {'rot': K(F, [(0, 0, 0), (-.22, 0, 0), (.26, 0, 0), (0, 0, 0)])},
         eL: {'rot': K(F, [(0, 0, 0), (-.25, 0, .22), (.2, 0, -.08), (0, 0, 0)])}, eR: {'rot': K(F, [(0, 0, 0), (-.25, 0, -.22), (.2, 0, .08), (0, 0, 0)])},
         'LegLF': {'rot': K(F, [(0, 0, 0), (-.5, 0, 0), (.6, 0, 0), (0, 0, 0)])}, 'LegRF': {'rot': K(F, [(0, 0, 0), (-.5, 0, 0), (.6, 0, 0), (0, 0, 0)])}}
    if t1: k[t1] = {'rot': K(F, [(0, 0, 0), (.3, 0, 0), (-.3, 0, 0), (0, 0, 0)])}
    C['attack'] = (F, k)
    F = 32
    k = {'Base': {'loc': cyc(8, F, lambda t: UP(.09 * abs(S(TAU * t))))}, 'Chest': {'rot': cyc(8, F, lambda t: (0, .1 * S(TAU * t), 0))},
         'Head': {'rot': cyc(8, F, lambda t: (0, -.16 * S(TAU * t), 0))}, eL: {'rot': cyc(8, F, lambda t: (0, 0, .3 * S(TAU * t * 2)))},
         eR: {'rot': cyc(8, F, lambda t: (0, 0, -.3 * S(TAU * t * 2)))},
         'LegLF': {'rot': cyc(8, F, lambda t: (.3 * max(0, S(TAU * t)), 0, 0))}, 'LegRF': {'rot': cyc(8, F, lambda t: (.3 * max(0, S(TAU * t)), 0, 0))}}
    if t1: k[t1] = {'rot': cyc(8, F, lambda t: (0, 0, .45 * S(TAU * t * 2)))}
    if t2: k[t2] = {'rot': cyc(8, F, lambda t: (0, 0, .35 * S(TAU * t * 2 - 1)))}
    C['happy'] = (F, k)
    C['blink'] = (8, {l: {'rot': [(1, (0, 0, 0)), (4, (BLINK, 0, 0)), (6, (BLINK * .6, 0, 0)), (9, (0, 0, 0))]} for l in lids})
    return C

def attack_clip(kind, tail=('Tail', 'Tail2'), ears=('EarL', 'EarR'), lids=('LidL', 'LidR'), extra=None):
    """Рух тіла для виду атаки. extra(kind, F) -> dict — додаткові кістки попала (хмаринка, плавник...)."""
    F = DUR[kind]; t1 = tail[0] if tail else None; eL, eR = ears; z = (0, 0, 0)
    E = lambda a, b: {eL: {'rot': [(1, z), (a, (-.3, 0, .25)), (b, (.25, 0, -.1)), (F, z)]}, eR: {'rot': [(1, z), (a, (-.3, 0, -.25)), (b, (.25, 0, .1)), (F, z)]}}
    k = {}
    if kind == 'melee':  # випад і укус/удар головою
        k = {'Base': {'loc': [(1, z), (7, FWD(-.1)), (11, FWD(.32)), (16, FWD(.25)), (F, z)]},
             'Chest': {'rot': [(1, z), (7, (-.2, 0, 0)), (11, (.25, 0, 0)), (F, z)]}, 'Head': {'rot': [(1, z), (7, (-.3, 0, 0)), (11, (.45, 0, .1)), (14, (.3, 0, -.1)), (F, z)]},
             'LegLF': {'rot': [(1, z), (7, (.2, 0, 0)), (11, (-.6, 0, 0)), (F, z)]}, 'LegRF': {'rot': [(1, z), (7, (.2, 0, 0)), (11, (-.5, 0, 0)), (F, z)]}, **E(7, 11)}
    elif kind == 'dash':  # присід, стрибок уперед, удар, повернення
        lf = {'rot': [(1, z), (6, (.3, 0, 0)), (10, (-.7, 0, 0)), (15, (-.2, 0, 0)), (22, (.25, 0, 0)), (F, z)]}
        lb = {'rot': [(1, z), (6, (-.3, 0, 0)), (10, (.7, 0, 0)), (15, (.2, 0, 0)), (22, (-.25, 0, 0)), (F, z)]}
        k = {'Base': {'loc': [(1, z), (6, UP(-.09)), (10, add(FWD(1.0), UP(.4))), (14, FWD(1.55)), (17, FWD(1.5)), (24, add(FWD(.6), UP(.15))), (F, z)]},
             'Chest': {'rot': [(1, z), (6, (.1, 0, 0)), (10, (-.15, 0, 0)), (14, (.25, 0, 0)), (20, z)]},
             'Head': {'rot': [(1, z), (6, (.15, 0, 0)), (11, (-.15, 0, 0)), (14, (.42, 0, 0)), (20, z)]},
             'LegLF': lf, 'LegRF': lf, 'LegLB': lb, 'LegRB': lb, **E(10, 15)}
    elif kind == 'shot':  # замах і кидок головою
        k = {'Base': {'loc': [(1, z), (9, FWD(-.08)), (13, FWD(.1)), (24, z)]}, 'Chest': {'rot': [(1, z), (9, (-.18, 0, 0)), (13, (.2, 0, 0)), (24, z)]},
             'Head': {'rot': [(1, z), (9, (-.32, 0, 0)), (12, (.38, 0, 0)), (24, z)]}, **E(9, 13)}
    elif kind == 'multi':  # три швидкі кидки
        hk = [(1, z)]; ck = [(1, z)]
        for i, f0 in enumerate((6, 16, 26)): hk += [(f0, (-.25, 0, .12 * (i - 1))), (f0 + 4, (.32, 0, -.1 * (i - 1)))]; ck += [(f0, (-.12, 0, 0)), (f0 + 4, (.14, 0, 0))]
        hk.append((F, z)); ck.append((F, z))
        k = {'Head': {'rot': hk}, 'Chest': {'rot': ck}, 'Base': {'loc': [(1, z), (6, FWD(-.05)), (30, FWD(.04)), (F, z)]}, **E(6, 10)}
    elif kind == 'beam':  # упертися й тримати промінь
        sh = [(1, z)] + [(10 + 2 * i, (.25 + .03 * (1 if i % 2 else -1), 0, 0)) for i in range(14)] + [(42, (.2, 0, 0)), (F, z)]
        k = {'Base': {'loc': [(1, z), (8, add(FWD(-.12), UP(-.05))), (40, add(FWD(-.12), UP(-.05))), (F, z)]},
             'Chest': {'rot': [(1, z), (8, (.1, 0, 0)), (40, (.1, 0, 0)), (F, z)]}, 'Head': {'rot': sh},
             'LegLF': {'rot': [(1, z), (8, (-.35, 0, 0)), (40, (-.35, 0, 0)), (F, z)]}, 'LegRF': {'rot': [(1, z), (8, (-.35, 0, 0)), (40, (-.35, 0, 0)), (F, z)]},
             'LegLB': {'rot': [(1, z), (8, (.3, 0, 0)), (40, (.3, 0, 0)), (F, z)]}, 'LegRB': {'rot': [(1, z), (8, (.3, 0, 0)), (40, (.3, 0, 0)), (F, z)]},
             eL: {'rot': [(1, z), (8, (-.45, 0, .1)), (40, (-.45, 0, .1)), (F, z)]}, eR: {'rot': [(1, z), (8, (-.45, 0, -.1)), (40, (-.45, 0, -.1)), (F, z)]}}
    elif kind in ('aoe', 'taunt'):  # дибки й удар лапами об землю (провокація — ще й рик угору)
        hoof = {'rot': [(1, z), (10, (-.6, 0, 0)), (14, (-.6, 0, 0)), (17, (.35, 0, 0)), (26, z), (F, z)]}
        hd = [(1, z), (10, (-.4, 0, 0)), (14, (-.42, 0, 0)), (17, (.3, 0, 0)), (30, z), (F, z)] if kind == 'aoe' else \
             [(1, z), (10, (-.45, 0, 0)), (22, (-.55, 0, .12)), (28, (-.5, 0, -.12)), (34, z), (F, z)]
        k = {'Base': {'rot': [(1, z), (10, (-.32, 0, 0)), (14, (-.32, 0, 0)), (17, (.1, 0, 0)), (28, z), (F, z)],
                      'loc': [(1, z), (10, UP(.1)), (14, UP(.1)), (17, UP(-.05)), (28, z), (F, z)]},
             'Head': {'rot': hd}, 'LegLF': hoof, 'LegRF': hoof, **E(10, 17)}
        if lids: k.update({l: {'rot': [(1, z), (16, z), (17, (BLINK, 0, 0)), (20, z), (F, z)]} for l in lids})
    elif kind == 'nova':  # присід і оберт на місці з хвилею
        k = {'Root': {'rot': [(1, z), (8, z), (24, (0, 0, TAU)), (F, (0, 0, TAU))]},
             'Base': {'loc': [(1, z), (8, UP(-.08)), (14, UP(.12)), (24, UP(.02)), (F, z)]},
             'Head': {'rot': [(1, z), (8, (.2, 0, 0)), (16, (-.25, 0, 0)), (30, z), (F, z)]}, **E(8, 16)}
    elif kind == 'dot':  # дряпає лапою й струшується
        k = {'LegRF': {'rot': [(1, z), (5, (-.9, 0, .2)), (9, (.4, 0, 0)), (13, (-.8, 0, .2)), (17, (.3, 0, 0)), (22, z), (F, z)]},
             'Base': {'loc': [(1, z), (5, FWD(.06)), (17, FWD(.08)), (F, z)]},
             'Chest': {'rot': alt(20, 2, 6, .1, 1, F)}, 'Head': {'rot': [(1, z), (5, (.2, 0, 0)), (17, (.25, 0, 0)), (F, z)]}, **E(5, 9)}
    elif kind == 'heal':  # підскоки, погляд угору
        k = {'Base': {'loc': [(1, UP(0)), (8, UP(.12)), (14, UP(0)), (20, UP(.1)), (26, UP(0)), (F, UP(0))]},
             'Head': {'rot': [(1, z), (8, (-.28, 0, .1)), (30, (-.25, 0, -.1)), (F, z)]},
             eL: {'rot': [(1, z), (8, (0, 0, .3)), (20, (0, 0, .1)), (F, z)]}, eR: {'rot': [(1, z), (8, (0, 0, -.3)), (20, (0, 0, -.1)), (F, z)]}}
    elif kind == 'shield':  # присідає й струшується
        k = {'Base': {'loc': [(1, UP(0)), (6, UP(-.07)), (28, UP(-.05)), (F, UP(0))]}, 'Chest': {'rot': alt(6, 2, 10, .14, 1, F)},
             'Head': {'rot': [(1, z), (6, (-.15, 0, 0)), (30, (-.12, 0, 0)), (F, z)]}, eL: {'rot': alt(6, 2, 10, .3, 2, F)}, eR: {'rot': alt(6, 2, 10, -.3, 2, F)}}
    if t1 and t1 not in k:
        k[t1] = {'rot': [(1 + i * 4, (0, 0, .35 * (1 if i % 2 else -1))) for i in range(F // 4)] + [(F, z)]}
    if extra: k.update(extra(kind, F))
    return F, k
