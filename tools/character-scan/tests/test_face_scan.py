"""Known synthetic face geometry, occlusion, failure and fit invariants."""
import copy
import json
import math
from pathlib import Path
import sys
import tempfile
import unittest

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import face_scan
import face_geometry


def reference(scale=1,occluded=False,eyes=True):
    im=Image.new('RGBA',(300,300),(24,25,30,255));d=ImageDraw.Draw(im)
    d.ellipse((40,35,260,265),fill=(240,194,157,255))
    if eyes:
        for x in (100,200):
            d.ellipse((x-18,130,x+18,170),fill=(15,140,150,255))
    # Fully visible brows within the automatic search band; outer ends rise.
    d.polygon([(69,94),(127,105),(127,113),(69,102)],fill=(180,65,105,255))
    d.polygon([(173,105),(231,94),(231,102),(173,113)],fill=(180,65,105,255))
    if occluded:d.rectangle((65,80,85,120),fill=(180,65,105,255))
    d.line((130,207,170,207),fill=(150,90,65,255),width=3)
    for x,y in ((84,185),(110,192),(190,189),(213,194)):
        d.ellipse((x-1,y-1,x+1,y+1),fill=(150,90,65,255))
    return im.resize((300*scale,300*scale),Image.Resampling.NEAREST)


def hints(scale=1):
    return {"eye_centers_px":[[100*scale,150*scale],[200*scale,150*scale]],
            "roi":[25*scale,50*scale,275*scale,260*scale]}


class FaceScanTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.path=Path(self.temp.name)/'ref.png'

    def run_scan(self,**kwargs):
        scale=kwargs.get('scale',1)
        reference(**kwargs).save(self.path)
        return face_scan.scan_face(self.path,hints=hints(scale))

    def test_known_eye_centres_and_colours(self):
        report,masks,_=self.run_scan()
        for side,x in (('left',100),('right',200)):
            f=report['features']['iris_'+side]
            self.assertEqual(f['status'],'candidate')
            self.assertAlmostEqual(f['centroid_px'][0],x,delta=.1)
            self.assertEqual(f['colour']['median_srgb'],[15,140,150])
        face_geometry.validate_report(report)

    def test_brow_direction_thickness_and_generation(self):
        r,_,_=self.run_scan()
        for side in ('left','right'):
            f=r['features']['brow_'+side]
            self.assertEqual(f['status'],'candidate')
            self.assertGreater(f['outer_rise_px'],8)
            self.assertLess(f['outer_rise_px'],15)
            self.assertAlmostEqual(f['median_thickness_px'],8,delta=1.5)
            vs,fs=face_geometry.brow_mesh(f,150,260,.001,-.1)
            self.assertTrue(fs)
            self.assertTrue(all(p[1]==-.1 for p in vs))

    def test_hair_colour_occlusion_is_partial_and_not_full_brow(self):
        r,_,_=self.run_scan(occluded=True)
        f=r['features']['brow_left']
        self.assertEqual(f['status'],'partial')
        self.assertLess(f['max_thickness_px'],12)
        comparison=face_scan.compare_scans(r,r)
        self.assertIn('brow_left',comparison['skipped'])

    def test_absent_iris_stays_unknown(self):
        r,m,_=self.run_scan(eyes=False)
        self.assertEqual(r['features']['iris_left']['status'],'unknown')
        self.assertFalse(m['iris_left'].any())

    def test_transparent_rgb_is_not_evidence(self):
        im=reference();a=np.array(im);a[130:171,82:119,3]=0
        Image.fromarray(a).save(self.path)
        r,m,_=face_scan.scan_face(self.path,hints=hints())
        self.assertEqual(r['features']['iris_left']['status'],'unknown')

    def test_blank_auto_scan_fails_without_fabricating_face(self):
        Image.new('RGBA',(100,100),(0,140,150,0)).save(self.path)
        with self.assertRaisesRegex(ValueError,'Transparent'):
            face_scan.scan_face(self.path)

    def test_invalid_hint_region_and_nan_rejected(self):
        reference().save(self.path)
        for override in ({'roi':[-1,0,300,300]}, {'eye_centers_px':[[float('nan'),150],[200,150]]},
                         {'regions':{'brow_left':[0,0,10,10]}}):
            h=hints();h.update(override)
            with self.assertRaises(ValueError):face_scan.scan_face(self.path,hints=h)

    def test_eye_normalized_scale_comparison(self):
        a,_,_=self.run_scan();b,_,_=self.run_scan(scale=2)
        d=face_scan.compare_scans(a,b)['features']['iris_left']['centroid_delta_eye_units']
        self.assertLess(max(map(abs,d)),.01)

    def test_output_is_reproducible_and_does_not_overwrite(self):
        r,m,rgb=self.run_scan()
        out=Path(self.temp.name)/'scan'
        face_scan.save_scan(r,m,rgb,out)
        loaded=json.loads((out/'face-scan.json').read_text())
        self.assertEqual(loaded['source_sha256'],r['source_sha256'])
        self.assertTrue((out/'face-overlay.png').is_file())
        with self.assertRaises(FileExistsError):face_scan.save_scan(r,m,rgb,out)

    def test_unsupported_schema_and_bad_coordinates(self):
        r,_,_=self.run_scan();r['schema']='future'
        with self.assertRaises(ValueError):face_geometry.validate_report(r)
        r['schema']=face_scan.SCHEMA;r['features']['brow_left']['centerline_px'][0][0]=-5
        with self.assertRaises(ValueError):face_geometry.validate_report(r)

    def test_hair_crossing_cheek_excludes_only_affected_side(self):
        im=reference();d=ImageDraw.Draw(im)
        d.rectangle((35,60,75,205),fill=(190,80,120,255))
        im.save(self.path)
        r,m,_=face_scan.scan_face(self.path,hints=hints())
        self.assertTrue(m['hair'][180,60])
        self.assertFalse(m['hair'][150,200])  # teal iris is not a hair tip
        row=next(row for row in r['features']['visible_skin_contour']['rows'] if row['y']==180)
        self.assertFalse(row['fit_checks']['left']['eligible'])
        self.assertIn('near_hair_candidate',row['fit_checks']['left']['reasons'])
        self.assertTrue(row['fit_checks']['right']['eligible'])

    def test_isolated_brows_and_transparent_hair_are_not_hair(self):
        r,m,_=self.run_scan()
        self.assertFalse(m['hair'].any())
        im=reference();d=ImageDraw.Draw(im)
        d.rectangle((35,60,75,205),fill=(190,80,120,0));im.save(self.path)
        r,m,_=face_scan.scan_face(self.path,hints=hints())
        self.assertFalse(m['hair'].any())

    def test_manual_exclusion_handles_palette_unknown_occluder(self):
        reference().save(self.path)
        h=hints();h['exclude_fit_regions']=[[25,175,90,210]]
        r,_,_=face_scan.scan_face(self.path,hints=h)
        row=next(row for row in r['features']['visible_skin_contour']['rows'] if row['y']==190)
        self.assertEqual(row['fit_checks']['left']['reasons'],['user_excluded_region'])
        self.assertTrue(row['fit_checks']['right']['eligible'])
        self.assertEqual(r['input_hints']['exclude_fit_regions'],h['exclude_fit_regions'])

    def test_new_hint_bounds_are_validated(self):
        reference().save(self.path)
        for extra in ({'hair_roi':[-1,0,250,250]}, {'exclude_fit_regions':[[0,0,400,300]]}):
            h=hints();h.update(extra)
            with self.assertRaises(ValueError):face_scan.scan_face(self.path,hints=h)

    def test_separate_rose_equipment_below_eyes_does_not_seed_hair(self):
        im=reference();d=ImageDraw.Draw(im)
        d.rectangle((5,200,30,270),fill=(190,80,120,255));im.save(self.path)
        _,m,_=face_scan.scan_face(self.path,hints=hints())
        self.assertFalse(m['hair'][210,20])


class FittingTests(unittest.TestCase):
    def report(self):
        return {'schema':face_geometry.SCHEMA,'image':{'width':300,'height':300},
                'occlusion_guard':{'version':'hair-contact/1'},
                'registration':{'axis_x_px':150,'eye_line_y_px':100,'eye_spacing_px':100},
                'features':{'visible_skin_contour':{'status':'partial',
                'rows':[{'y':y,'left':80,'right':220,
                         'fit_checks':{s:{'eligible':True,'reasons':[]} for s in ('left','right')}}
                        for y in range(160,221)]}}}

    def points(self):
        return [(x*.001,-.1,(250-y)*.001) for y in range(150,231,2) for x in (-60,-40,-10,0,10,40,60)]

    def test_fit_reduces_known_width_error_and_preserves_centre_depth_height(self):
        points=self.points();original=list(points)
        fitted,stats=face_geometry.fit_face_points(points,self.report(),150,250,.001,160,220,5)
        self.assertEqual(points,original)
        self.assertGreater(stats['moved_vertices'],0)
        self.assertLessEqual(stats['maximum_step_px'],5)
        for a,b in zip(points,fitted):
            self.assertEqual(a[1:],b[1:])
            if abs(a[0])<=.01:self.assertEqual(a,b)
        before=[abs(abs(p[0])-.07) for p in points if abs(p[0])==.06 and abs(p[2]-.06)<1e-6]
        after=[abs(abs(b[0])-.07) for a,b in zip(points,fitted) if abs(a[0])==.06 and abs(a[2]-.06)<1e-6]
        self.assertLess(sum(after),sum(before))

    def test_fit_preserves_gaps_and_rejects_misregistration(self):
        r=self.report();r['features']['visible_skin_contour']['rows']=[v for v in r['features']['visible_skin_contour']['rows'] if not 180<v['y']<190]
        fitted,stats=face_geometry.fit_face_points(self.points(),r,150,250,.001,160,220)
        for a,b in zip(self.points(),fitted):
            if 180<250-a[2]/.001<190:self.assertEqual(a,b)
        with self.assertRaisesRegex(ValueError,'axis'):
            face_geometry.fit_face_points(self.points(),self.report(),0,250,.001,160,220)

    def test_occluded_samples_never_influence_fit_or_move_hidden_side(self):
        r=self.report()
        for row in r['features']['visible_skin_contour']['rows']:
            if 180<=row['y']<=200:
                row['fit_checks']['left']={'eligible':False,'reasons':['near_hair_candidate']}
        points=self.points()
        fitted,stats=face_geometry.fit_face_points(points,r,150,250,.001,160,220)
        altered=copy.deepcopy(r)
        for row in altered['features']['visible_skin_contour']['rows']:
            if not row['fit_checks']['left']['eligible']:row['left']=120
        refit,_=face_geometry.fit_face_points(points,altered,150,250,.001,160,220)
        self.assertEqual(fitted,refit)
        for a,b in zip(points,fitted):
            if a[0]<0 and 180<=round(250-a[2]/.001)<=200:self.assertEqual(a,b)
        self.assertEqual(stats['excluded_samples']['left'],21)
        self.assertEqual(stats['fitted_intervals_px']['right'],[[160,220]])

    def test_all_occluded_and_legacy_reports_cannot_fit(self):
        r=self.report();del r['occlusion_guard']
        with self.assertRaisesRegex(ValueError,'rescan'):
            face_geometry.fit_face_points(self.points(),r,150,250,.001,160,220)
        r=self.report()
        for row in r['features']['visible_skin_contour']['rows']:
            for side in ('left','right'):row['fit_checks'][side]={'eligible':False,'reasons':['near_hair_candidate']}
        with self.assertRaisesRegex(ValueError,'eligible'):
            face_geometry.fit_face_points(self.points(),r,150,250,.001,160,220)

    def test_short_visible_island_does_not_create_a_full_size_skin_ridge(self):
        r=self.report()
        for row in r['features']['visible_skin_contour']['rows']:
            if not 180<=row['y']<=190:
                row['fit_checks']['left']={'eligible':False,'reasons':['near_hair_candidate']}
        points=self.points()
        fitted,_=face_geometry.fit_face_points(points,r,150,250,.001,160,220,10)
        moves=[abs(b[0]-a[0])/.001 for a,b in zip(points,fitted) if a[0]<0]
        self.assertGreater(max(moves),0)
        self.assertLess(max(moves),.2)

    def test_malformed_guard_and_guide_gaps(self):
        r=self.report()
        r['features']['visible_skin_contour']['rows'][20]['fit_checks']['left']['eligible']='false'
        with self.assertRaisesRegex(ValueError,'eligibility'):face_geometry.validate_report(r)
        r=self.report()
        for row in r['features']['visible_skin_contour']['rows']:
            if 180<=row['y']<=190:row['fit_checks']['left']={'eligible':False,'reasons':['near_hair_candidate']}
        for name,points,_ in face_geometry.polylines(r):
            if name.endswith('.left'):
                self.assertFalse(any(180<=p[1]<=190 for p in points))

    def test_generated_ribbons_do_not_bridge_missing_columns(self):
        f={'status':'partial','column_runs':[[[10,10,13],[11,10,13]],[[20,10,13],[21,10,13]]]}
        vs,fs=face_geometry.brow_mesh(f,0,30,.001,0)
        self.assertEqual(len(fs),2)
        self.assertTrue(all(max(face)-min(face)==3 for face in fs))
        self.assertEqual(len(vs),8)

    def test_pixel_stair_steps_do_not_become_skin_ripples(self):
        r=self.report()
        for row in r['features']['visible_skin_contour']['rows']:
            noise=3 if row['y']%2 else -3
            row['left']+=noise;row['right']-=noise
        points=[(x*.001,-.1,(250-y)*.001) for y in range(150,231) for x in (-60,60)]
        fitted,_=face_geometry.fit_face_points(points,r,150,250,.001,160,220,10)
        deltas=[(b[0]-a[0])/.001 for a,b in zip(points,fitted)
                if a[0]>0 and 175<=250-a[2]/.001<=205]
        curvature=[abs(c-2*b+a) for a,b,c in zip(deltas,deltas[1:],deltas[2:])]
        self.assertLess(max(curvature),.08)


if __name__=='__main__':unittest.main()
