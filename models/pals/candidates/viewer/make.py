import json, os, base64, re, sys
R = '/home/user/popal/models/pals/candidates'; O = os.path.dirname(os.path.abspath(__file__))
ORDER = [('bambuzl','Бамбузл','трава'),('grumrok','Грумрок','земля/кристал'),('ignis','Ігніс-Виверг','вогонь'),('mirazhbr','Міражбр','темрява'),
 ('pukhoklub','Пухоклуб','нормальний'),('krylosha','Крилоша','повітря'),('mororyh','Мороріг','лід'),('hrozovyk','Грозовик','електро'),
 ('khvylezub','Хвилезуб','вода'),('sontseklyv','Сонцеклюв','вогонь/повітря'),('popeliukh','Попелюх','вогонь/темрява'),('koralovyk','Кораловик','вода/земля'),('zemleryi','Землерий','земля')]
PUFF = [('atk_stusan','Пухнастий стусан',1),('atk_heal','Хмаринка здоров’я',2),('atk_shield','Пухова завіса',2),('atk_dash','Хмарний відскок',2),('atk_lullaby','Колискова',2),
        ('atk_bigheal','Велике зцілення',3),('atk_cocoon','Пуховий кокон',3),('atk_storm','Грозова хмара',3),('atk_rain','Дощ із хмаринок',3)]
def tris(f):
    b = open(f,'rb').read(); jl = int.from_bytes(b[12:16],'little'); j = json.loads(b[20:20+jl])
    return sum(j['accessors'][p['indices']]['count']//3 for m in j['meshes'] for p in m['primitives'])
man = []
for key, name, el in ORDER:
    D = os.path.join(R, key)
    if key == 'pukhoklub':
        src = {str(f): os.path.join(D, 'pukhoklub_form%d_candidate.glb' % f) for f in (1,2,3)}; src['fx'] = os.path.join(D, 'pukhoklub_fx.glb')
        atk = [{'clip': c, 'name': n, 'slot': s} for c, n, s in PUFF]
    else:
        src = {str(f): os.path.join(D, '%s_form%d.glb' % (key, f)) for f in (1,2,3)}; src['fx'] = os.path.join(D, '%s_fx.glb' % key)
        if not os.path.exists(src['fx']): print('skip', key); continue
        atk = [{'clip': a['clip'], 'name': a['name'], 'slot': a['slot']} for a in json.load(open(os.path.join(D, key + '_attacks.json')))]
    files = {}
    for k, p in src.items():
        n = '%s_%s' % (key, 'fx' if k == 'fx' else 'form' + k); open(os.path.join(O, n + '.glb.txt'), 'w').write(base64.b64encode(open(p,'rb').read()).decode()); files[k] = n
    man.append({'key': key, 'name': name, 'el': el, 'files': files, 'tris': [tris(src[str(f)]) for f in (1,2,3)], 'attacks': atk})
json.dump(man, open(os.path.join(O, 'manifest.json'), 'w'), ensure_ascii=False)
print(len(man), 'pals', sum(os.path.getsize(os.path.join(O,f)) for f in os.listdir(O) if f.endswith('.txt'))//1048576, 'MB')
