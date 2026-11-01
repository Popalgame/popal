import copy
from pathlib import Path
import sys
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from face_shape import analyse_shape
from automatic_camera import reference_points
from contour_evidence import chin_neck_context
from boundary_cases import make_case


class ChinContextTests(unittest.TestCase):
    def analyse(self,kind):
        report,masks,rgb,valid,label=make_case(kind,17)
        analyse_shape(report,masks,rgb,valid)
        return report,masks,rgb,valid,label

    def test_contact_keeps_measured_points_and_records_resolved_reasons(self):
        report,_,_,_,_=self.analyse('chin_neck_contact')
        shape=report['face_shape'];self.assertNotEqual(shape['chin_bottom']['status'],'unknown')
        contact=[o for o in shape['boundary_evidence']['observations'] if o['classification']=='chin_neck_contact_candidate']
        self.assertGreater(len(contact),20)
        self.assertTrue(any(o['local_reasons'] for o in contact))
        self.assertTrue(all(o['used_for_fit'] for o in contact))
        chin=next(s for s in shape['segments'] if s['region']=='chin')
        self.assertEqual(chin['points_px'],[o['point_px'] for o in contact])
        self.assertIn('chin_bottom',reference_points({'landmarks':{}},report))
        self.assertEqual(chin['boundary_evidence'],'chin_neck_contact_candidate')

    def test_curved_shadows_and_obstructions_do_not_gain_chin_identity(self):
        for kind in ('in_surface_shadow','disconnected_shadow','hair_occlusion','missing_contrast'):
            with self.subTest(kind=kind):
                report,*_=self.analyse(kind)
                self.assertEqual(report['face_shape']['chin_bottom']['status'],'unknown')
                self.assertNotIn('chin_bottom',reference_points({'landmarks':{}},report))

    def test_contact_requires_both_jaw_attachments_and_contiguous_samples(self):
        report,masks,_,valid,_=self.analyse('chin_neck_contact');evidence=report['face_shape']['boundary_evidence']
        observations=[copy.deepcopy(o) for o in evidence['observations'] if o['region']=='chin']
        for o in observations:o['reasons']=o.get('local_reasons',o['reasons'])
        points=[o['point_px'] for o in observations]
        jaws={side:[o['point_px'] for o in evidence['observations'] if o['region']=='jaw_'+side and o['eligible']] for side in ('left','right')}
        reg=report['registration'];args=(masks['skin'],valid,reg['eye_spacing_px'],reg['axis_x_px'])
        self.assertEqual(chin_neck_context(points,observations,jaws,*args)['status'],'candidate')
        missing=copy.deepcopy(jaws);missing['right']=[]
        self.assertIn('missing_supported_jaw_right',chin_neck_context(points,observations,missing,*args)['reasons'])
        self.assertIn('arc_has_missing_columns',chin_neck_context(points[:20]+points[24:],observations[:20]+observations[24:],jaws,*args)['reasons'])
        observations[len(observations)//2]['reasons']=['outward_hair_contact']
        self.assertIn('arc_has_hard_exclusion',chin_neck_context(points,observations,jaws,*args)['reasons'])


if __name__=='__main__':unittest.main()
