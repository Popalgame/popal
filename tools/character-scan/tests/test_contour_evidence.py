import copy
from pathlib import Path
import sys
import unittest

import numpy as np

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from contour_evidence import classify_boundary
from face_shape import analyse_shape
from automatic_camera import reference_points


class BoundaryTests(unittest.TestCase):
    def setUp(self):
        self.rgb=np.full((100,140,3),[25,35,50],np.uint8)
        self.skin=np.zeros((100,140),bool);self.skin[:,50:]=True;self.rgb[self.skin]=[230,180,150]
        self.valid=np.ones_like(self.skin);self.hair=np.zeros_like(self.skin)

    def classify(self):return classify_boundary(self.rgb,self.valid,self.skin,self.hair,[50,50],'cheek_left',100)

    def test_clear_boundary_retained_without_semantic_certainty(self):
        item=self.classify();self.assertTrue(item['eligible'])
        self.assertEqual(item['classification'],'contrast_boundary_candidate')

    def test_hair_beyond_old_proximity_is_rejected(self):
        self.hair[:,40:45]=True
        item=self.classify();self.assertFalse(item['eligible'])
        self.assertEqual(item['classification'],'hair_contact_candidate')
        self.assertIn('outward_hair_contact',item['reasons'])

    def test_shadow_and_weak_colour_steps_do_not_become_silhouettes(self):
        self.rgb[:,:50]=[115,90,75]
        item=self.classify();self.assertFalse(item['eligible']);self.assertEqual(item['classification'],'shadow_ambiguous')
        self.rgb[:,:50]=[228,178,148]
        self.assertIn('weak_boundary_contrast',self.classify()['reasons'])

    def test_transparent_colour_is_ignored_and_crop_unknown(self):
        self.valid[:,:50]=False;self.rgb[:,:50]=[230,180,150]
        item=self.classify();self.assertTrue(item['eligible']);self.assertNotIn('contrast_rgb',item)
        self.rgb[:,:50]=[0,0,0]
        self.assertEqual(item,self.classify())
        item=classify_boundary(self.rgb,self.valid,self.skin,self.hair,[2,50],'cheek_left',100)
        self.assertEqual(item['reasons'],['probe_outside_image'])

    def test_missing_inward_support_and_continuing_skin_rejected(self):
        self.skin[:,50:]=False
        self.assertIn('inward_skin_unsupported',self.classify()['reasons'])
        self.skin[:]=True
        self.assertIn('skin_continues_outward',self.classify()['reasons'])

    def test_rejected_chin_cannot_feed_camera_or_widths_and_annotations_keep_provenance(self):
        rgb=np.full((170,160,3),[25,35,50],np.uint8);skin=np.zeros((170,160),bool)
        skin[20:102,30:131]=True;rgb[skin]=[230,180,150]
        skin[102:160,55:106]=True;rgb[102:160,55:106]=[115,90,75]
        valid=np.ones_like(skin);masks={'skin':skin,'hair':np.zeros_like(skin)}
        rows=[{'y':y,'left':30,'right':130,'fit_checks':{s:{'eligible':True,'reasons':[]} for s in ('left','right')}} for y in range(55,102)]
        report={'source_sha256':'fixture','image':{'width':160,'height':170},'roi_px':[10,10,150,165],
            'registration':{'axis_x_px':80,'eye_line_y_px':55,'eye_spacing_px':50},
            'ocular_metrology':{'calibration':{'status':'unknown'}},'features':{'visible_skin_contour':{'rows':rows}}}
        original=rgb.copy();analyse_shape(report,masks,rgb,valid)
        self.assertEqual(report['face_shape']['chin_bottom']['status'],'unknown')
        self.assertTrue(any('skin_continues_outward' in p['reasons'] for p in report['face_shape']['boundary_evidence']['observations']))
        self.assertNotIn('chin_bottom',reference_points({'landmarks':{}},report))
        self.assertFalse(any(s['region']=='chin' for s in report['face_shape']['segments']))
        self.assertFalse(any(w['name'].startswith('above_chin') for w in report['face_shape']['width_samples']))
        annotation={'source_sha256':'fixture','segments':[{'region':'chin','status':'partial','points_px':[[x,101] for x in range(65,96)]}]}
        analyse_shape(report,masks,rgb,valid,copy.deepcopy(annotation))
        chin=next(s for s in report['face_shape']['segments'] if s['region']=='chin')
        self.assertEqual(chin['points_px'],annotation['segments'][0]['points_px'])
        self.assertEqual(chin['boundary_evidence'],'source_annotation')
        self.assertGreater(report['face_shape']['region_diagnostics']['chin']['boundary_evidence']['annotation_warning_samples'],0)
        np.testing.assert_array_equal(original,rgb)


if __name__=='__main__':unittest.main()
