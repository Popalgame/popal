"""Known face/chin curves, scale, missing coverage and quantitative deviations."""
import copy
import hashlib
from pathlib import Path
import sys
import tempfile
import unittest

import numpy as np
from PIL import Image

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import face_scan
import face_geometry
import face_shape
from test_eye_scan import fixture


def shape(shift=0):
    cal={'status':'supplied','mm_per_px':.5,'origin_px':[200,350]}
    segments=[face_shape.describe('jaw_left',[[100+shift,y] for y in range(220,281)],'partial','known curve',cal)]
    return {'registration':{'axis_x_px':200,'eye_line_y_px':200,'eye_spacing_px':100},
            'calibration':cal,'segments':segments}


class ShapeTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);self.path=self.root/'front.png';fixture().save(self.path)
        self.hints={'eye_centers_px':[[130,200],[270,200]],'roi':[30,80,370,380]}

    def annotation(self):
        segments=[]
        for region,x in (('jaw_left',90),('jaw_right',310)):
            segments.append({'region':region,'status':'candidate','points_px':[[x,y] for y in range(260,350)]})
        segments.append({'region':'chin','status':'candidate','points_px':[[x,350-((x-200)/25)**2] for x in range(180,221)]})
        self.hints['face_outline']={'source_sha256':hashlib.sha256(self.path.read_bytes()).hexdigest(),'segments':segments}

    def scan(self):return face_scan.scan_face(self.path,hints=self.hints,calibration={'mm_per_px':.5,'origin_px':[200,350]})

    def test_known_annotated_chin_width_length_and_calibrated_points(self):
        self.annotation();r,m,rgb=self.scan();s=r['face_shape']
        self.assertEqual(s['chin_bottom']['point_px'],[200,350])
        self.assertEqual(s['chin_bottom']['eye_line_to_chin_mm'],75)
        widths={v['name']:v for v in s['width_samples']}
        self.assertEqual(widths['above_chin_10pct']['width_mm'],110)
        self.assertEqual(widths['above_chin_10pct']['center_offset_px'],0)
        chin=next(v for v in s['segments'] if v['region']=='chin')
        self.assertEqual(chin['points_xz_mm'][20],[0,0])
        face_geometry.validate_report(r)
        out=self.root/'out';face_scan.save_scan(r,m,rgb,out)
        self.assertTrue((out/'face-shape-overlay.png').exists())
        self.assertTrue((out/'face-shape-points.csv').exists())
        self.assertTrue(any(name.startswith('shape.chin.') for name,_,_ in face_geometry.polylines(r)))

    def test_source_and_order_guard_and_gaps_not_closed(self):
        self.annotation();self.hints['face_outline']['source_sha256']='stale'
        with self.assertRaisesRegex(ValueError,'source_sha256'):self.scan()
        self.annotation();self.hints['face_outline']['segments'][0]['points_px'][2][1]=1
        with self.assertRaisesRegex(ValueError,'top-to-bottom'):self.scan()
        self.assertEqual(len(face_shape.runs([[1,1],[2,2],[3,3],[9,9],[10,10],[11,11]],1,3)),2)

    def test_known_deviation_and_zero_not_a_likeness_score(self):
        a=shape();b=shape(10);r=face_shape.compare_shapes(a,b)
        jaw=r['regions']['jaw_left']
        self.assertAlmostEqual(jaw['mean_distance_eye_units'],.1)
        self.assertAlmostEqual(jaw['max_distance_reference_mm'],5)
        self.assertEqual(jaw['reference_coverage'],1)
        self.assertFalse(r['accuracy_100_percent_verified'])
        self.assertEqual(face_shape.compare_shapes(a,a)['regions']['jaw_left']['max_distance_eye_units'],0)
        self.assertEqual(r['regions']['chin']['status'],'unknown')
        face_shape.save_comparison(a,b,self.root/'comparison.png')
        self.assertTrue((self.root/'comparison.png').is_file())

    def test_occlusion_reduces_coverage_without_inventing_deviation(self):
        a=shape();b=shape();b['segments'][0]['points_px']=b['segments'][0]['points_px'][:31]
        r=face_shape.compare_shapes(a,b)['regions']['jaw_left']
        self.assertLess(r['reference_coverage'],.55)
        self.assertAlmostEqual(r['max_distance_eye_units'],0,delta=.005)
        self.assertEqual(r['candidate_coverage'],1)

    def test_scale_translation_registration_invariance(self):
        a=shape();b=copy.deepcopy(a)
        for s in b['segments']:s['points_px']=[[x*2+30,y*2+10] for x,y in s['points_px']]
        b['registration']={'axis_x_px':430,'eye_line_y_px':410,'eye_spacing_px':200}
        self.assertAlmostEqual(face_shape.compare_shapes(a,b)['regions']['jaw_left']['max_distance_eye_units'],0)

    def test_flat_colour_does_not_manufacture_chin(self):
        r,m,rgb=self.scan();rgb=np.full_like(rgb,[230,180,150]);valid=np.ones(m['skin'].shape,bool)
        face_shape.analyse_shape(r,m,rgb,valid)
        self.assertEqual(r['face_shape']['chin_bottom']['status'],'unknown')
        self.assertFalse(any(s['region']=='chin' for s in r['face_shape']['segments']))

    def test_occlusion_diagnostic_reports_rejection_without_creating_contours(self):
        r,m,rgb=self.scan();valid=np.ones(m['skin'].shape,bool)
        reg=r['registration'];lo=reg['eye_line_y_px'];hi=lo+reg['eye_spacing_px']*.45
        rows=[row for row in r['features']['visible_skin_contour']['rows'] if lo<=row['y']<hi]
        self.assertGreater(len(rows),0)
        for row in rows:row['fit_checks']['right']={'eligible':False,'reasons':['near_hair_candidate']}
        face_shape.analyse_shape(r,m,rgb,valid)
        d=r['face_shape']['region_diagnostics']['cheek_right']
        self.assertEqual(d['eligible_rows'],0)
        self.assertEqual(d['rejected_reasons']['near_hair_candidate'],len(rows))
        self.assertEqual(r['face_shape']['sample_counts']['cheek_right'],0)

    def test_isolated_off_axis_neck_edge_is_not_chin(self):
        r,m,rgb=self.scan();rgb=np.full_like(rgb,210);valid=np.ones(m['skin'].shape,bool)
        # Strong collar-like step on one side, with no central head boundary.
        rgb[330:,220:245]=40;m['skin'][:]=True;m['hair'][:]=False
        face_shape.analyse_shape(r,m,rgb,valid)
        self.assertEqual(r['face_shape']['chin_bottom']['status'],'unknown')
        self.assertFalse(any(s['region']=='chin' for s in r['face_shape']['segments']))

    def test_tampered_guide_physical_coordinates_rejected(self):
        self.annotation();r,_,_=self.scan()
        r['face_shape']['segments'][0]['points_xz_mm'][0][0]+=1
        with self.assertRaisesRegex(ValueError,'millimetres'):face_geometry.validate_report(r)


if __name__=='__main__':unittest.main()
