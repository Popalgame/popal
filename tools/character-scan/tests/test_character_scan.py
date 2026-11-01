"""Full workflow tests: missing semantics, conflicts, provenance and bundle integrity."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from zipfile import ZipFile

import numpy as np
from PIL import Image,ImageDraw

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import body_scan
import part_scan
import character_scan
import character_geometry
import package_addon


def figure():
    image=Image.new('RGBA',(240,320),(250,10,250,0));draw=ImageDraw.Draw(image)
    draw.ellipse((80,20,160,100),fill=(230,180,145,255))
    draw.rectangle((85,95,155,210),fill=(20,130,145,255))
    draw.rectangle((25,115,215,140),fill=(20,130,145,255))
    draw.rectangle((80,210,115,300),fill=(160,100,60,255))
    draw.rectangle((125,210,160,300),fill=(160,100,60,255))
    return image


class CharacterTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);self.path=self.root/'ref.png';figure().save(self.path)

    def test_body_dimensions_scale_and_missing_face(self):
        r,m,_,_=character_scan.analyse(self.path,1405,profile='silhouette-only')
        self.assertEqual(r['body']['height_px'],281)
        self.assertAlmostEqual(r['registration']['units_per_px'],.005)
        self.assertEqual(r['face']['status'],'unknown')
        self.assertEqual(r['modules']['clothing']['status'],'unknown')
        self.assertEqual(r['body']['bbox_px'],[25,20,216,301])
        self.assertEqual(r['coverage']['unresolved_px'],r['coverage']['foreground_px'])
        character_geometry.validate_report(r)

    def test_disconnected_legs_remain_separate_cross_section_runs(self):
        r,_,_,_=character_scan.analyse(self.path,profile='silhouette-only')
        section=next(x for x in r['body']['cross_sections'] if x['height_fraction']==.9)
        self.assertEqual(section['runs_px'],[(80,115),(125,160)])
        lines=character_geometry.body_lines(r)
        selected=[p for n,p in lines if '90%' in n]
        self.assertEqual(len(selected),2)
        self.assertFalse(any(a[0]<120<b[0] for a,b in selected))

    def test_transparent_rgb_never_becomes_part_evidence(self):
        r,m,_,_=character_scan.analyse(self.path)
        for mask in m.values():self.assertFalse(mask[0,0])
        self.assertTrue(np.all(~m['ambiguous']|m['unresolved']))

    def test_conflicts_are_unassigned_independent_of_definition_order(self):
        definition={'group':'clothing','region_px':[80,100,160,200],'palette':'teal'}
        hints={'parts':{'first':definition,'second':definition}}
        r,m,_,_=character_scan.analyse(self.path,hints=hints,profile='silhouette-only')
        self.assertTrue(m['ambiguous'][130,120])
        self.assertTrue(m['unresolved'][130,120])
        self.assertFalse(m['part_first'].any());self.assertFalse(m['part_second'].any())
        self.assertEqual(r['parts']['first']['status'],'unknown')
        hints['parts']=dict(reversed(list(hints['parts'].items())))
        _,n,_,_=character_scan.analyse(self.path,hints=hints,profile='silhouette-only')
        np.testing.assert_array_equal(m['ambiguous'],n['ambiguous'])

    def test_polygon_hint_retains_known_shape_and_provenance(self):
        hints={'parts':{'panel':{'group':'clothing','polygon_px':[[90,110],[150,110],[120,180]],'palette':'object'}},
               'notes':'Test annotation, not automatic semantics'}
        r,m,_,_=character_scan.analyse(self.path,hints=hints,profile='silhouette-only')
        self.assertTrue(m['part_panel'][120,120]);self.assertFalse(m['part_panel'][175,90])
        self.assertEqual(r['parts']['panel']['origin'],'input hint')
        self.assertEqual(r['input_hints'],hints)
        self.assertEqual(r['parts']['panel']['status'],'partial')

    def test_manual_registration_and_clipping(self):
        image=figure();ImageDraw.Draw(image).rectangle((0,115,40,140),fill=(20,130,145,255));image.save(self.path)
        hints={'registration':{'axis_x_px':120,'ground_y_px':300,'units_per_px':.002}}
        r,_,_,_=character_scan.analyse(self.path,hints=hints)
        self.assertTrue(r['body']['clipped']['left'])
        self.assertEqual(r['body']['status'],'partial')
        self.assertEqual(r['registration']['units_per_px'],.002)
        self.assertEqual(r['body']['scale']['mm_per_px'],2)

    def test_invalid_inputs_fail_instead_of_becoming_unknown(self):
        for hints in ({'unexpected':True},{'face':{'roi':[-1,0,10,10],'eye_centers_px':[[1,1],[15,1]]}},
                      {'registration':{'units_per_px':float('nan')}},
                      {'parts':{'bad/name':{}}},
                      {'parts':{'part':{'group':'clothing','palette':'object','polygon_px':[[0,0],[500,0],[0,200]]}}}):
            with self.assertRaises(ValueError):character_scan.analyse(self.path,hints=hints)
        with self.assertRaises(ValueError):character_scan.analyse(self.path,height_mm=-1)

    def test_nonuniform_background_requires_transparency(self):
        im=figure().convert('RGB');im.putpixel((0,0),(0,0,0));im.putpixel((239,319),(255,255,255));im.save(self.path)
        with self.assertRaisesRegex(ValueError,'Background'):body_scan.foreground(self.path)

    def test_empty_foreground_fails(self):
        Image.new('RGBA',(240,320),(240,100,120,0)).save(self.path)
        with self.assertRaisesRegex(ValueError,'foreground'):character_scan.analyse(self.path)

    def bundle(self):
        out=self.root/'scan';data=character_scan.analyse(self.path)
        character_scan.save_bundle(*data,out)
        return out

    def test_bundle_roundtrip_artifacts_and_no_overwrite(self):
        out=self.bundle();r=character_geometry.read_bundle(out/'character-scan.json')
        self.assertIn('masks/ambiguous.png',r['artifacts'])
        self.assertIn('modelling-evidence.json',r['artifacts'])
        self.assertEqual(r['face']['status'],'unknown')
        with self.assertRaises(FileExistsError):character_scan.save_bundle(*character_scan.analyse(self.path),out)

    def test_missing_or_modified_artifacts_and_source_rejected(self):
        out=self.bundle();p=out/'masks/foreground.png';original=p.read_bytes();p.write_bytes(b'corrupt')
        with self.assertRaisesRegex(ValueError,'artifact'):character_geometry.read_bundle(out/'character-scan.json')
        p.write_bytes(original);figure().convert('RGB').save(self.path)
        with self.assertRaisesRegex(ValueError,'Reference'):character_geometry.read_bundle(out/'character-scan.json')

    def test_external_artifact_and_cross_section_coordinates_rejected(self):
        out=self.bundle();p=out/'character-scan.json';r=json.loads(p.read_text())
        r['artifacts']['../ref.png']='fake';p.write_text(json.dumps(r))
        with self.assertRaisesRegex(ValueError,'path'):character_geometry.read_bundle(p)
        r['body']['cross_sections'][0]['runs_px']=[[0,1000]]
        with self.assertRaisesRegex(ValueError,'cross-section'):character_geometry.validate_report(r)

    def test_identity_and_scaled_comparison(self):
        a=self.bundle()
        same=character_scan.compare_bundles(a/'character-scan.json',a/'character-scan.json')
        self.assertEqual(same['silhouette_iou'],1)
        for f in same['parts'].values():self.assertEqual(f['width_delta_height_units'],0)
        p=self.root/'small.png';figure().resize((120,160),Image.Resampling.NEAREST).save(p)
        b=self.root/'small';character_scan.save_bundle(*character_scan.analyse(p),b)
        comparison=character_scan.compare_bundles(a/'character-scan.json',b/'character-scan.json')
        self.assertGreater(comparison['silhouette_iou'],.94)

    def test_distribution_contains_all_scanner_modules(self):
        path=package_addon.build(self.root/'addon.zip')
        with ZipFile(path) as z:
            for name in ('__init__.py','character_scan.py','character_geometry.py','body_scan.py','part_scan.py',
                         'face_scan.py','hair_scan.py','occlusion.py','requirements.txt','examples/aiko-registration.json',
                         'autopilot.py','outline_objective.py','blender_pipeline.py','blender_pipeline_worker.py','studio_bridge.py',
                         'automatic_camera.py','blender_landmarks.py'):
                self.assertIn('polpal_face_scan/'+name,z.namelist())
        with self.assertRaises(FileExistsError):package_addon.build(path)


if __name__=='__main__':unittest.main()
