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
