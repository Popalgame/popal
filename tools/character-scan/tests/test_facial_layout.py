"""Known spacing landmarks, missing evidence, ear occlusion and independent profiles."""
import copy
import hashlib
from pathlib import Path
import sys
import tempfile
import unittest

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import face_scan
import face_geometry
import facial_layout
import head_profile
from test_eye_scan import fixture


class FacialLayoutTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);self.image=self.root/'front.png'
        fixture().save(self.image)
        self.hints={'eye_centers_px':[[130,200],[270,200]],'roi':[30,80,370,350],
                    'head_roi':[40,40,360,360],'feature_masks':{}}

    def annotation(self,name,bounds,status='candidate'):
        mask=np.zeros((400,400),np.uint8);x0,y0,x1,y1=bounds;mask[y0:y1,x0:x1]=255
        path=self.root/(name+'.png');Image.fromarray(mask).save(path)
        self.hints['feature_masks'][name]={'path':str(path),'status':status,
                                         'source_sha256':hashlib.sha256(self.image.read_bytes()).hexdigest()}

    def scan(self):
        return face_scan.scan_face(self.image,hints=self.hints,calibration={'mm_per_px':.5,'origin_px':[200,350]})

    def test_exact_signed_spacing_and_anatomical_ambiguity(self):
        for name,bounds in {'nose':[190,250,210,260],'mouth':[180,280,220,286],
                            'eye_left':[90,170,150,220],'eye_right':[240,170,300,220],
                            'brow_left':[80,130,160,140],'brow_right':[230,130,310,140]}.items():self.annotation(name,bounds)
        r,m,_=self.scan();relations=r['facial_layout']['relations']
        self.assertEqual(relations['nose_mouth_vertical']['edge_gap_px'],20)
        self.assertEqual(relations['nose_mouth_vertical']['centroid_separation_px'],28)
        self.assertEqual(relations['nose_mouth_vertical']['edge_gap_mm'],10)
        self.assertEqual(relations['eyes_horizontal']['edge_gap_px'],90)
        self.assertEqual(relations['brows_horizontal']['edge_gap_px'],70)
        self.assertEqual(relations['brow_eye_left_vertical']['edge_gap_px'],30)
        self.assertEqual(relations['brow_eye_left_vertical']['edge_projection_segment_px'][0][1],139.5)
        self.assertIn('not anatomical',relations['nose_mouth_vertical']['landmark_note'])
        face_geometry.validate_report(r)
        self.annotation('brow_left',[80,200,160,230],'partial')
        r,_,_=self.scan();rel=r['facial_layout']['relations']['brow_eye_left_vertical']
        self.assertEqual(rel['edge_gap_px'],-60)
        self.assertEqual(rel['status'],'partial')

    def test_unknown_propagates_without_zero_measurement(self):
        self.annotation('nose',[0,0,0,0])
        r,_,_=self.scan();rel=r['facial_layout']['relations']['nose_mouth_vertical']
        self.assertEqual(rel['status'],'unknown');self.assertNotIn('edge_gap_px',rel)
        self.assertEqual(r['head_profile']['status'],'unknown')

    def test_partial_ear_geometry_and_head_registration(self):
        self.annotation('ear_right',[365,190,385,240],'partial')
        self.hints['regions']={'ear_right':[350,180,395,250]}
        r,_,_=self.scan();g=r['features']['ear_right']['geometry_2d']
        self.assertEqual(g['mm']['width'],10);self.assertEqual(g['mm']['height'],25)
        ear=r['facial_layout']['ears']['right']
        self.assertEqual(ear['status'],'partial')
        self.assertEqual(ear['head_relative']['width_ratio'],20/320)
        self.assertAlmostEqual(ear['head_relative']['center_uv'][0],(374.5-40)/320)
        del self.hints['head_roi'];r,_,_=self.scan()
        self.assertEqual(r['facial_layout']['ears']['right']['head_relative']['status'],'unknown')

    def test_lateral_cheek_not_cropped_into_ear(self):
        skin=np.zeros((400,400),bool);skin[120:270,70:330]=True
        f,m=facial_layout.ear_candidates(skin,np.ones_like(skin),[30,80,370,350],[[130,200],[270,200]],{})
        self.assertEqual(f['ear_right']['status'],'unknown')
        skin[180:230,350:370]=True
        f,m=facial_layout.ear_candidates(skin,np.ones_like(skin),[30,80,370,350],[[130,200],[270,200]],{})
        self.assertEqual(f['ear_right']['status'],'partial')
        self.assertEqual(int(m['ear_right'].sum()),1000)

    def test_detail_signal_is_contrast_not_depth_and_neck_excluded(self):
        image=fixture();draw=ImageDraw.Draw(image)
        draw.line((100,247,155,247),fill=(110,80,65),width=2)
        draw.line((180,340,220,340),fill=(110,80,65),width=2);image.save(self.image)
        r,m,_=self.scan();observations=r['facial_details']['observations']
        found=[p for p in observations if p['geometry_2d']['bbox_px'][1]<=247<p['geometry_2d']['bbox_px'][3]]
        self.assertTrue(found)
        self.assertTrue(all(p['depth_status']=='unknown' for p in found))
        self.assertFalse(m['facial_details'][340].any())
        # A flat colour patch does not create a depression candidate by itself.
        r,m,rgb=self.scan();rgb=rgb.copy();rgb[:]=[200,150,110]
        detail=facial_layout.add_details(r,m,rgb,np.ones((400,400),bool))
        self.assertFalse(detail.any())

    def test_outputs_comparison_and_guides(self):
        self.annotation('nose',[190,250,210,260]);self.annotation('mouth',[180,280,220,286])
        r,m,rgb=self.scan();out=self.root/'out';face_scan.save_scan(r,m,rgb,out)
        for name in ('facial-spacing.csv','ear-measurements.csv','facial-layout-overlay.png','facial-details-overlay.png'):
            self.assertTrue((out/name).is_file())
        delta=face_scan.compare_scans(r,r)['facial_spacing']['nose_mouth_vertical']
        self.assertEqual(delta['edge_gap_delta_mm'],0)
        lines=face_geometry.polylines(r)
        self.assertTrue(any(n.startswith('spacing.nose_mouth') for n,_,_ in lines))
        bad=copy.deepcopy(r);bad['facial_layout']['relations']['nose_mouth_vertical']['edge_gap_mm']=999
        with self.assertRaisesRegex(ValueError,'Spacing'):face_geometry.validate_report(bad)


class ProfileTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)

    def spec(self,name,width=100,scale=.5,scope='head_surface'):
        image=Image.new('RGBA',(240,300),(0,0,0,0));d=ImageDraw.Draw(image)
        d.rectangle((50,50,50+width-1,249),fill=(200,150,110,255))
        path=self.root/(name+'.png');image.save(path)
        mask=self.root/(name+'-mask.png');image.getchannel('A').save(mask)
        return {'image':str(path),'source_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                'mask':str(mask),'head_roi':[20,20,220,280],'view':'right-facing','scope':scope,
                'status':'candidate','calibration':{'mm_per_px':scale}}

    def test_profile_ratio_independent_scale_and_shallower_comparison(self):
        a=head_profile.analyse_profile(self.spec('a'))
        b=head_profile.analyse_profile(self.spec('b',80,2))
        self.assertEqual(a['depth_height_ratio'],.5)
        self.assertEqual(a['geometry_2d']['mm']['width'],50)
        self.assertEqual(b['geometry_2d']['mm']['width'],160)
        c=head_profile.compare_profiles(a,b)
        self.assertAlmostEqual(c['depth_height_ratio_delta'],-.1)
        self.assertAlmostEqual(c['relative_depth_height_ratio'],.8)
        self.assertEqual(c['status'],'candidate')

    def test_scope_mismatch_partial_crop_and_missing_view(self):
        a=head_profile.analyse_profile(self.spec('a'));b=head_profile.analyse_profile(self.spec('b',scope='hair_envelope'))
        self.assertEqual(head_profile.compare_profiles(a,b)['status'],'unknown')
        spec=self.spec('c');del spec['mask'];r=head_profile.analyse_profile(spec)
        self.assertEqual(r['status'],'partial')
        spec=self.spec('d');spec['head_roi']=[50,50,150,250]
        self.assertTrue(head_profile.analyse_profile(spec)['touches_roi_boundary'])
        self.assertEqual(head_profile.analyse_profile(None)['status'],'unknown')
        del spec['view']
        with self.assertRaises(ValueError):head_profile.analyse_profile(spec)

    def test_stale_sources_mask_validation_and_overlay(self):
        spec=self.spec('a');r=head_profile.analyse_profile(spec)
        head_profile.save_profile(r,self.root);self.assertTrue((self.root/'head-profile-overlay.png').is_file())
        face_geometry.validate_profile_source({'head_profile':r})
        Path(spec['mask']).write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError,'Side mask'):face_geometry.validate_profile_source({'head_profile':r})
        spec=self.spec('b');spec['source_sha256']='stale'
        with self.assertRaisesRegex(ValueError,'sha256'):head_profile.analyse_profile(spec)
        spec=self.spec('c');Image.new('L',(240,300),128).save(spec['mask'])
        with self.assertRaisesRegex(ValueError,'binary'):head_profile.analyse_profile(spec)

    def test_side_profile_survives_front_bundle_with_independent_units(self):
        spec=self.spec('side');del spec['calibration']
        front=self.root/'front.png';fixture().save(front)
        hints={'eye_centers_px':[[130,200],[270,200]],'roi':[30,80,370,350],'side_profile':spec}
        r,m,rgb=face_scan.scan_face(front,hints=hints,calibration={'mm_per_px':.25})
        self.assertEqual(r['head_profile']['calibration']['status'],'uncalibrated')
        self.assertNotIn('mm',r['head_profile']['geometry_2d'])
        out=self.root/'bundle';face_scan.save_scan(r,m,rgb,out)
        self.assertTrue((out/'head-profile-overlay.png').exists())
        self.assertEqual(face_scan.compare_scans(r,r)['head_profile']['depth_height_ratio_delta'],0)


if __name__=='__main__':unittest.main()
