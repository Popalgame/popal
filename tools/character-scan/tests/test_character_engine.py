import json
from pathlib import Path
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
import zipfile

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import character_recipe as recipe_lib
import engine
import reference_pack as rp

PALETTE = {'jacket': '#2E9CA6', 'top': '#FFFFFF', 'skin': '#FFEEDD', 'shorts': '#8B6F47', 'socks': '#D8C5A5',
           'boots': '#6B4F3A', 'hair': '#F7A8B8', 'fur': '#F5F5F0'}
DESCRIPTION = """Proporcje 1:3, oczy 30% twarzy
Włosy: wysoki kucyk, różowe #F7A8B8 u nasady, końcówki błękitne #7ED6DF
Kurtka puchowa cropped: kolor teal #2E9CA6, biały futrzany kołnierz #F5F5F0
Pod spodem: biały crop top #FFFFFF
Szorty: brązowe #8B6F47
Skarpety: beżowe #D8C5A5, do kolan
Buty: Trapery brązowe #6B4F3A
Plecak: #5C4033, 5x Pal Spheres niebiesko-białe #3A8DDE + #FFFFFF + beżowe #D8C5A5
Młotek: Drewniany #8B5A2B, runy świecące różowo #FF6EC7
Polycount target: 12k tris
"""


def tpose(path, held=True):
    """Front T-pose on magenta, 1000 px tall figure, known garment rows (fractions from the top)."""
    im = Image.new('RGB', (900, 1200), (248, 1, 246))
    d = ImageDraw.Draw(im)
    top, h, ax = 100, 1000, 450
    y = lambda f: top+int(f*h)  # noqa: E731
    d.ellipse([ax-160, y(0), ax+160, y(.34)], fill=PALETTE['hair'])
    d.rectangle([ax-130, y(.36), ax+130, y(.52)], fill=PALETTE['jacket'])       # jacket to .52
    d.rectangle([ax-40, y(.36), ax+40, y(.56)], fill=PALETTE['top'])            # crop top to .56
    d.rectangle([ax-70, y(.56), ax+70, y(.60)], fill=PALETTE['skin'])           # belly to .60
    d.rectangle([ax-120, y(.60), ax+120, y(.72)], fill=PALETTE['shorts'])       # shorts to .72
    d.rectangle([ax-370, y(.42), ax+370, y(.47)], fill=PALETTE['jacket'])       # arms
    if held:
        d.rectangle([ax-430, y(.38), ax-370, y(.52)], fill=(139, 90, 43))       # item in image-left hand
    for s in (-1, 1):
        x0 = ax+s*60-30 if s > 0 else ax-90
        d.rectangle([x0, y(.72), x0+60, y(.82)], fill=PALETTE['skin'])          # thighs to .82
        d.rectangle([x0, y(.82), x0+60, y(.90)], fill=PALETTE['socks'])         # socks to .90
        d.rectangle([x0-5, y(.90), x0+65, y(1.0)], fill=PALETTE['boots'])
    im.save(path)


class RecipeTests(unittest.TestCase):
    def test_default_recipe_is_valid_and_game_contract_is_fixed(self):
        recipe = recipe_lib.default()
        recipe_lib.validate(recipe)
        for change in ({'game': {'height': 1.55}}, {'game': {'clips': ['idle']}}, {'proportions': {'head_ratio': .9}},
                       {'palette': {'skin': 'pink'}}, {'parts': {'hair': {'style': 'mohawk'}}},
                       {'proportions': {'sock_top': .30, 'shorts_hem': .20}}, {'face': {'eye_width': .9}},
                       {'face': {'eye_spacing': .5, 'eye_width': .7}}):
            with self.assertRaises(ValueError):
                recipe_lib.validate(recipe_lib.merge(recipe, change))

    def test_hex_round_trip(self):
        self.assertEqual(recipe_lib.rgb_to_hex(recipe_lib.hex_to_rgb('#2E9CA6')), '#2E9CA6')


class PackTests(unittest.TestCase):
    def test_zip_extraction_skips_scripts_and_escapes(self):
        with tempfile.TemporaryDirectory() as root:
            root = Path(root)
            pack = root/'pack.zip'
            with zipfile.ZipFile(pack, 'w') as z:
                z.writestr('a/front.png', b'x')
                z.writestr('../evil.png', b'x')
                z.writestr('blender_import.py', b'import os')
                z.writestr('__MACOSX/._front.png', b'x')
                z.writestr('OPIS.md', 'tekst')
            files, ignored = rp.extract(pack, root/'out')
            self.assertEqual(sorted(p.name for p in files), ['OPIS.md', 'front.png'])
            self.assertIn('blender_import.py', ignored)
            self.assertIn('../evil.png', ignored)
            self.assertFalse((root/'evil.png').exists())
            with self.assertRaises(FileExistsError):
                rp.extract(pack, root/'out')

    def test_description_colours_styles_and_hints(self):
        palette, provenance, hints = rp.parse_description(DESCRIPTION)
        self.assertEqual(palette['hair_root'], '#F7A8B8')
        self.assertEqual(palette['hair_tip'], '#7ED6DF')
        self.assertEqual(palette['jacket'], '#2E9CA6')
        self.assertEqual(palette['fur'], '#F5F5F0')
        self.assertEqual(palette['backpack'], '#5C4033')
        self.assertEqual([palette[k] for k in ('sphere_primary', 'sphere_secondary', 'sphere_tertiary')],
                         ['#3A8DDE', '#FFFFFF', '#D8C5A5'])
        self.assertEqual(palette['hammer_wood'], '#8B5A2B')
        self.assertEqual(palette['rune_glow'], '#FF6EC7')
        self.assertEqual(provenance['palette.jacket']['source'], 'description')
        self.assertAlmostEqual(hints['proportions.head_ratio'][0], 1/3, places=3)
        self.assertAlmostEqual(hints['face.eye_height'][0], .453*30/24, places=3)
        self.assertEqual(hints['parts.hair.style'][0], 'ponytail_high')
        self.assertEqual(hints['parts.back.spheres_described'][0], 5)
        self.assertEqual(hints['target_triangles'][0], 12000)

    def test_tpose_measurement_and_garment_bands(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root)/'tpose.png'
            tpose(path)
            with Image.open(path) as im:
                m, fg = rp.measure(im)
                bands = rp.garment_bands(im, fg, m, {**recipe_lib.default()['palette'], **{
                    k: v for k, v in PALETTE.items() if k in recipe_lib.PALETTE_SLOTS}})
        self.assertAlmostEqual(m['crotch_from_top'], .72, delta=.02)  # thighs part where the shorts end
        self.assertAlmostEqual(m['arm_row_from_top'], .42, delta=.06)
        self.assertEqual(m['held_item_side'], 'right')
        for key, expected in (('jacket_hem', .52), ('top_hem', .56), ('waist', .60), ('sock_top', .82), ('boot_top', .90)):
            self.assertAlmostEqual(bands[key], expected, delta=.025, msg=key)

    def test_draft_records_provenance_and_stays_valid(self):
        with tempfile.TemporaryDirectory() as root:
            root = Path(root)
            src = root/'src'
            src.mkdir()
            tpose(src/'hero_tpose.png')
            (src/'OPIS.md').write_text(DESCRIPTION)
            recipe, report = rp.analyse(src, root/'run', name='Test')
            self.assertTrue((root/'run/recipe.json').is_file())
            self.assertEqual(recipe['provenance']['proportions.head_ratio']['source'], 'description')
            self.assertEqual(recipe['provenance']['proportions.sock_top']['source'], 'image')
            self.assertEqual(recipe['parts']['back']['spheres'], 5)
            self.assertEqual(recipe['game']['weapon_hand'], 'right')
            self.assertTrue(recipe['references'][0]['primary'])
            recipe_lib.validate(recipe)

    def test_no_description_and_busy_background_are_reported(self):
        with tempfile.TemporaryDirectory() as root:
            root = Path(root)
            src = root/'src'
            src.mkdir()
            noisy = Image.effect_noise((400, 600), 120).convert('RGB')
            noisy.save(src/'photo.png')
            recipe, report = rp.analyse(src, root/'run')
            self.assertTrue(any('No description' in w for w in report['warnings']))
            self.assertTrue(any('not measured' in w for w in report['warnings']))
            self.assertEqual(recipe['proportions'], recipe_lib.default()['proportions'])


class BaseLibraryTests(unittest.TestCase):
    def test_matching_base_is_selected_only_for_the_same_character(self):
        with tempfile.TemporaryDirectory() as root:
            root = Path(root)
            tpose(root/'ref_tpose.png')
            blend = root/'base.blend'
            blend.write_bytes(b'not really a blend')
            entry = engine.register_base(root/'bases', 'hero-base', blend, root/'ref_tpose.png', 'Hero base')
            self.assertEqual(entry['blend_sha256'], __import__('hashlib').sha256(b'not really a blend').hexdigest())
            with self.assertRaises(FileExistsError):
                engine.register_base(root/'bases', 'hero-base', blend, root/'ref_tpose.png', 'Hero base')
            eng = engine.Engine(root/'runs', blender=root/'missing', bridge_check=False, bases=root/'bases')
            same = root/'same'
            same.mkdir()
            tpose(same/'again_tpose.png')
            recipe, _ = eng.analyse(same, 'same-run')
            self.assertEqual(recipe['base']['kind'], 'sculpted')
            self.assertEqual(recipe['base']['id'], 'hero-base')
            self.assertGreaterEqual(recipe['base']['score'], engine.MATCH_THRESHOLD)
            other = root/'other'
            other.mkdir()
            im = Image.new('RGB', (600, 1200), (248, 1, 246))
            ImageDraw.Draw(im).rectangle([220, 150, 380, 1100], fill=(200, 50, 50))
            im.save(other/'someone_tpose.png')
            recipe, _ = eng.analyse(other, 'other-run')
            self.assertEqual(recipe['base']['kind'], 'parametric')
            self.assertLess(recipe['base_candidates'][0]['score'], engine.MATCH_THRESHOLD)
            with self.assertRaises(ValueError):
                eng.build('same-run')  # no Blender here: the run must say so
            self.assertEqual(json.loads((root/'runs/same-run/state.json').read_text())['status'], 'failed')

    def test_changed_base_file_is_refused(self):
        with tempfile.TemporaryDirectory() as root:
            root = Path(root)
            tpose(root/'ref_tpose.png')
            blend = root/'base.blend'
            blend.write_bytes(b'v1')
            engine.register_base(root/'bases', 'hero-base', blend, root/'ref_tpose.png', 'Hero base')
            blend.write_bytes(b'v2')
            eng = engine.Engine(root/'runs', blender=Path(sys.executable), bridge_check=False, bases=root/'bases')
            src = root/'src'
            src.mkdir()
            tpose(src/'x_tpose.png')
            eng.analyse(src, 'run-a')
            with self.assertRaisesRegex(ValueError, 'changed'):
                eng.build('run-a')

    def test_recipe_base_validation(self):
        recipe = recipe_lib.default()
        recipe_lib.validate(recipe_lib.merge(recipe, {'base': {'kind': 'sculpted', 'id': 'aiko-v16'}}))
        for bad in ({'kind': 'magic'}, {'kind': 'sculpted'}, {'kind': 'sculpted', 'id': '../x'}):
            with self.assertRaises(ValueError):
                recipe_lib.validate(recipe_lib.merge(recipe, {'base': bad}))


PROFILE = {'materials': [
    {'name': 'Pink hair with blue tips', 'triangles': 100, 'images': [], 'factor': [1, 1, 1], 'factor_linked': True,
     'median': [.6, .2, .3], 'ends': [[.2, .45, .5], [.75, .25, .33]], 'spread': .6},
    {'name': 'Rose pink brow', 'triangles': 10, 'images': [], 'factor': [1, 1, 1], 'factor_linked': True, 'median': [.57, .1, .18]},
    {'name': 'Shorts • saddle brown canvas', 'triangles': 50, 'images': [], 'factor': [1, 1, 1], 'factor_linked': True,
     'median': [.17, .085, .04]},
    {'name': 'Jacket • deep petrol nylon', 'triangles': 80, 'images': [], 'factor': [1, 1, 1], 'factor_linked': True,
     'median': [.006, .17, .195]},
    {'name': 'Collar • warm ivory fibres', 'triangles': 40, 'images': [], 'factor': [.8, .77, .66], 'factor_linked': False},
    {'name': 'Aiko v14 • fibrous teal iris L', 'triangles': 5, 'images': ['iris.png'], 'factor': [1, 1, 1], 'factor_linked': True},
    {'name': 'Hammer • walnut grain', 'triangles': 5, 'images': [], 'factor': [1, 1, 1], 'factor_linked': True, 'median': [.1, .03, .01]},
    {'name': 'Capsule • ivory ceramic', 'triangles': 5, 'images': [], 'factor': [.5, .47, .3], 'factor_linked': False},
    {'name': 'Warm porcelain skin', 'triangles': 90, 'images': [], 'factor': [.9, .6, .5], 'factor_linked': False},
    {'name': 'Aiko v16 • warmer skin and freckles', 'triangles': 30, 'images': ['skin.png'], 'factor': [1, 1, 1],
     'factor_linked': True},
    {'name': 'Leg L • warm knee tones', 'triangles': 20, 'images': [], 'factor': [.89, .57, .38], 'factor_linked': True,
     'median': [.89, .57, .38]},
    {'name': 'Ear blush 1', 'triangles': 4, 'images': [], 'factor': [.64, .2, .13], 'factor_linked': False}]}


class VariantTests(unittest.TestCase):
    def setUp(self):
        regions = engine.regions_from_profile(PROFILE)
        self.slots = {r['material']: (r['slot'], r['mode']) for r in regions}
        self.entry = {'regions': regions, 'palette': recipe_lib.default()['palette'],
                      'profile_materials': [{'material': m['name']} for m in PROFILE['materials']]}

    def test_region_map_uses_whole_words_and_modes(self):
        self.assertEqual(self.slots['Shorts • saddle brown canvas'], ('shorts', 'vertex'))  # "brown" is not "brow"
        self.assertEqual(self.slots['Rose pink brow'], ('brows', 'vertex'))
        self.assertEqual(self.slots['Pink hair with blue tips'], ('hair_root', 'gradient'))
        self.assertEqual(self.slots['Collar • warm ivory fibres'], ('fur', 'factor'))
        self.assertEqual(self.slots['Aiko v14 • fibrous teal iris L'], ('eyes', 'texture'))
        self.assertEqual(self.slots['Warm porcelain skin'], ('skin', 'factor'))
        self.assertEqual(self.slots['Aiko v16 • warmer skin and freckles'], ('skin', 'texture'))
        self.assertEqual(self.slots['Leg L • warm knee tones'], ('skin', 'vertex'))
        self.assertEqual(self.slots['Ear blush 1'], ('skin', 'factor'))

    def test_unchanged_recipe_gives_empty_variant(self):
        self.assertEqual(engine.variant_spec(self.entry, recipe_lib.default()), {'remove': [], 'recolor': []})

    def test_recolour_keeps_brightness_relation_and_hair_gradient_order(self):
        recipe = recipe_lib.merge(recipe_lib.default(), {'palette': {'jacket': '#F2B134', 'hair_root': '#2C2C34'}})
        spec = engine.variant_spec(self.entry, recipe)
        items = {i['material']: i for i in spec['recolor']}
        jacket = items['Jacket • deep petrol nylon']
        expected = engine.lum(jacket['from'])*engine.lum(engine.srgb_hex_to_linear('#F2B134'))/engine.lum(engine.srgb_hex_to_linear('#2E9CA6'))
        self.assertAlmostEqual(engine.lum(jacket['to']), expected, places=4)
        self.assertGreater(jacket['to'][0], jacket['to'][2])  # now warm, not teal
        hair = items['Pink hair with blue tips']
        self.assertEqual(hair['mode'], 'gradient')
        self.assertEqual(hair['from'], [.75, .25, .33])  # the pink end is the root
        self.assertLess(engine.lum(hair['to']), .05)
        self.assertNotIn('Shorts • saddle brown canvas', items)

    def test_skin_shifts_every_skin_material_by_the_same_ratio(self):
        recipe = recipe_lib.merge(recipe_lib.default(), {'palette': {'skin': '#8D5A3B'}})
        items = {i['material']: i for i in engine.variant_spec(self.entry, recipe)['recolor']}
        # Measured against the largest skin material (the body), not the palette's nominal colour.
        ratio = [t/b for t, b in zip(engine.srgb_hex_to_linear('#8D5A3B'), [.9, .6, .5])]
        for name in ('Warm porcelain skin', 'Aiko v16 • warmer skin and freckles', 'Leg L • warm knee tones', 'Ear blush 1'):
            for got, want in zip(items[name]['ratio'], ratio):
                self.assertAlmostEqual(got, want, places=6)
        body, blush = items['Warm porcelain skin']['to'], items['Ear blush 1']['to']
        for got, want in zip(body, engine.srgb_hex_to_linear('#8D5A3B')):
            self.assertAlmostEqual(got, want, places=6)  # the body is exactly the chosen colour
        # The blush stays redder than the skin around it.
        self.assertGreater(blush[0]/max(blush[1], 1e-6), body[0]/body[1])

    def test_registered_base_follows_current_region_rules(self):
        with tempfile.TemporaryDirectory() as root:
            folder = Path(root)
            (folder/'base.json').write_text(json.dumps({'id': 'b', 'regions': []}))
            (folder/'profile.json').write_text(json.dumps(PROFILE))
            slots = {r['material']: r['slot'] for r in engine.read_base(folder)['regions']}
        self.assertEqual(slots['Warm porcelain skin'], 'skin')

    def test_parts_removed_by_material_name(self):
        recipe = recipe_lib.merge(recipe_lib.default(), {'parts': {'weapon': {'style': 'none'}, 'top': {'collar': 'none'},
                                                                   'back': {'spheres': 0}}})
        spec = engine.variant_spec(self.entry, recipe)
        self.assertEqual(sorted(spec['remove']), ['Capsule • ivory ceramic', 'Collar • warm ivory fibres', 'Hammer • walnut grain'])

    def test_scaled_never_exceeds_one(self):
        self.assertEqual(max(engine.scaled([.6, .3, .1], 3)), 1.0)


class StudioMountTests(unittest.TestCase):
    def test_engine_is_tab_05_of_the_studio_server(self):
        import studio
        import studio_project
        with tempfile.TemporaryDirectory() as root:
            root = Path(root)
            tpose(root/'front.png')
            studio_project.create(root/'project')
            studio_project.import_view(root/'project', 'front', root/'front.png')
            server = studio.Server(('127.0.0.1', 0), root/'project', None)
            threading.Thread(target=server.serve_forever, daemon=True).start()
            try:
                base = f'http://127.0.0.1:{server.server_port}'
                with urllib.request.urlopen(base+'/engine/') as r:
                    self.assertIn(b'silnik postaci', r.read())
                with urllib.request.urlopen(base+'/engine/api/runs') as r:
                    self.assertEqual(json.loads(r.read())['runs'], [])
                req = urllib.request.Request(base+'/engine/api/runs', data=b'x', headers={'Content-Type': 'image/png'})
                with self.assertRaises(urllib.error.HTTPError) as caught:
                    urllib.request.urlopen(req)
                caught.exception.close()
                self.assertEqual(caught.exception.code, 400)
                with urllib.request.urlopen(base+'/') as r:
                    self.assertIn(b'data-tab="engine"', r.read())
            finally:
                server.shutdown()
                server.server_close()


class ServerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.engine = engine.Engine(Path(self.tmp.name)/'runs', blender=Path(self.tmp.name)/'missing-blender', bridge_check=False)
        self.server = engine.Server(('127.0.0.1', 0), self.engine)
        self.port = self.server.server_port
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.tmp.cleanup()

    def request(self, path, data=None, headers=None):
        req = urllib.request.Request(f'http://127.0.0.1:{self.port}{path}', data=data, headers=headers or {})
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as error:
            with error:
                return error.code, error.read()

    def test_upload_analyses_and_failed_build_is_reported(self):
        src = Path(self.tmp.name)/'hero_tpose.png'
        tpose(src)
        status, body = self.request('/api/runs', src.read_bytes(),
                                    {'Content-Type': 'image/png', 'X-Polpal-Engine': '1', 'X-Pack-Name': 'hero_tpose.png'})
        self.assertEqual(status, 202)
        run = json.loads(body)['id']
        for _ in range(50):
            status, body = self.request('/api/runs/'+run)
            state = json.loads(body)
            if state['status'] not in ('analysing', 'building', 'analysed'):
                break
            threading.Event().wait(.1)
        self.assertEqual(state['status'], 'failed')
        self.assertIn('Blender not found', state['message'])
        self.assertIsNotNone(state['recipe'])
        status, _ = self.request(f'/runs/{run}/reference/hero_tpose.png')
        self.assertEqual(status, 200)
        self.assertFalse(any(Path(self.tmp.name, 'runs', '.incoming').iterdir()))

    def test_guards(self):
        self.assertEqual(self.request('/api/runs', b'x', {'Content-Type': 'image/png'})[0], 400)
        self.assertEqual(self.request('/api/runs', b'x', {'Content-Type': 'text/html', 'X-Polpal-Engine': '1'})[0], 400)
        self.assertEqual(self.request('/api/runs', headers={'Origin': 'http://evil.example'})[0], 400)
        self.assertEqual(self.request('/runs/abc/../../x')[0], 400)
        self.assertEqual(self.request('/api/runs/NOT_VALID')[0], 400)
        self.assertEqual(self.request('/api/runs/missing-run')[0], 404)
        self.assertEqual(self.request('/')[0], 200)
        self.assertEqual(self.request('/vendor/three.min.js')[0], 200)


if __name__ == '__main__':
    unittest.main()
