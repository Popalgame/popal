# Збирання попала: python build_pal.py -- <ключ> <форма 1|2|3|fx|all> <тека>
# Тіло: базові кліпи + 9 атак (рух за видом атаки). Ефекти: окремий GLB. Маніфест <ключ>_attacks.json — назви атак для перегляду.
import sys, os, json, importlib
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, 'lib')); sys.path.insert(0, os.path.join(HERE, 'specs'))
args = sys.argv[sys.argv.index('--') + 1:]; key, what, out = args[0], args[1], args[2]
import pal_lib, body_clips
KS = {1: 1.0, 2: 1.06, 3: 1.12}
spec = importlib.import_module(key)
A = pal_lib.attacks(key)
def body(form):
    P0 = spec.build(form, KS[form]); P = P0.build(ao_k=getattr(P0, 'ao', .68))
    extra = getattr(spec, 'extra_clip', None)
    eb = getattr(spec, 'extra_base', None)
    for name, (F, keys) in body_clips.base_clips(**getattr(spec, 'RIG', {})).items():
        if eb: keys.update(eb(name, F))
        P.clip(name, F, keys)
    for i, a in enumerate(A, 1):
        F, keys = body_clips.attack_clip(body_clips.kind_of(a), extra=extra, **getattr(spec, 'RIG', {})); P.clip('atk_%d' % i, F, keys)
    return P.export(out, '%s_form%d' % (key, form))
def fx():
    import fx_lib
    X = fx_lib.Fx(key); man = [X.build_attack(i, a) for i, a in enumerate(A, 1)]
    g = X.export(out, '%s_fx' % key)
    json.dump(man, open(os.path.join(out, '%s_attacks.json' % key), 'w'), ensure_ascii=False, indent=1); return g
if what == 'fx': fx()
elif what == 'all':
    for f in (1, 2, 3): body(f)
    fx()
else: body(int(what))
