import copy
from pathlib import Path
import sys
import unittest

import numpy as np
from scipy.spatial.transform import Rotation

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from automatic_camera import align,correspondences,fit_fixed_orientation,reference_points
from metrology3d import project


def fixture():
    r=Rotation.from_euler('xyz',[75,0,4],degrees=True).as_matrix()
    xyz=np.array([[-70,-30,30],[70,-35,32],[0,90,5.]])@r
    pixels=(xyz@r[:2].T)*1.3+[240,310]
    names=['iris_center_left','iris_center_right','chin_bottom']
    points={n:{'point_px':xy.tolist(),'sigma_px':2,'visible':True,'origin':'fixture reference'} for n,xy in zip(names,pixels)}
    model={'world_unit':'mm','frame_id':'fixture','source_mesh_sha256':'mesh','landmarks':
           {n:{'point3d':x.tolist(),'method':'fixture marker'} for n,x in zip(names,xyz)},
           'orientation_prior':{'R':r.tolist(),'method':'fixture base orientation'}}
    view={'source_sha256':'image','landmarks':points,'camera_config':{'kind':'orthographic','frame_id':'fixture'},'width':600,'height':600}
    scan={'source_sha256':'image'}
    return view,scan,model


class AutomaticCameraTests(unittest.TestCase):
    def test_recovers_known_constrained_camera_and_heldout_points(self):
        view,scan,model=fixture();report=align(view,scan,model,'mesh');camera=report['camera']
        self.assertEqual(report['status'],'candidate');self.assertFalse(camera['rotation_estimated_from_reference'])
        self.assertEqual(len(camera['free_parameters']),3);self.assertLess(max(camera['leave_one_out_errors_px']),1e-8)
        heldout=np.array([[0,0,0],[30,20,10],[-50,75,20.]])
        expected=heldout@np.array(model['orientation_prior']['R'])[:2].T*1.3+[240,310]
        np.testing.assert_allclose(project(heldout,camera),expected,atol=1e-8)
        self.assertEqual(camera['source_mesh_sha256'],'mesh')

    def test_bad_pair_or_wrong_orientation_cannot_be_hidden_by_alignment(self):
        for defect in ('point','rotation','mirror'):
            view,scan,model=fixture()
            if defect=='point':view['landmarks']['chin_bottom']['point_px'][0]+=40
            if defect=='rotation':model['orientation_prior']['R']=Rotation.from_euler('z',35,degrees=True).as_matrix().tolist()
            if defect=='mirror':
                a,b=[view['landmarks'][n]['point_px'] for n in ('iris_center_left','iris_center_right')]
                a[0],b[0]=b[0],a[0]
            self.assertNotEqual(align(view,scan,model,'mesh')['status'],'candidate')

    def test_unknown_pose_and_invisible_anchors_remain_blocked(self):
        view,scan,model=fixture();model['orientation_prior']=None
        self.assertEqual(align(view,scan,model,'mesh')['status'],'blocked')
        view,scan,model=fixture();view['landmarks']['iris_center_left']['visible']=False
        scan['features']={'iris_left':{'status':'candidate','centroid_px':[150,200]}}
        self.assertFalse(reference_points(view,scan)['iris_center_left']['visible'])
        self.assertEqual(align(view,scan,model,'mesh')['status'],'blocked')

    def test_bad_frame_reference_and_rotation_rejected(self):
        view,scan,model=fixture();scan['source_sha256']='other'
        with self.assertRaisesRegex(ValueError,'identity'):correspondences(view,scan,model)
        view,scan,model=fixture();view['landmarks']['chin_bottom']['point3d']=[0,0,0];view['camera_config']['frame_id']='other'
        with self.assertRaisesRegex(ValueError,'frame'):correspondences(view,scan,model)
        view,scan,model=fixture();model['orientation_prior']['R'][0][0]=float('nan')
        self.assertEqual(align(view,scan,model,'mesh')['status'],'blocked')

    def test_detector_fallback_keeps_partial_iris_unknown(self):
        view,scan,model=fixture();view['landmarks']={}
        scan.update(features={'iris_left':{'status':'partial','centroid_px':[100,100]},
                              'iris_right':{'status':'candidate','centroid_px':[200,100]}},
                    face_shape={'chin_bottom':{'status':'partial','point_px':[150,200]}})
        points=reference_points(view,scan)
        self.assertNotIn('iris_center_left',points);self.assertIn('iris_center_right',points)
        self.assertIn('chin_bottom',points)

    def test_imported_scanner_points_are_refreshed_and_cannot_bypass_visibility_guards(self):
        view,scan,model=fixture()
        for point in view['landmarks'].values():point['origin']='mask centroid candidate'
        scan.update(features={'iris_left':{'status':'partial','centroid_px':[100,100]},
                              'iris_right':{'status':'candidate','centroid_px':[200,100],'touches_region_boundary':True}})
        self.assertEqual(reference_points(view,scan),{})
        self.assertEqual(align(view,scan,model,'mesh')['status'],'blocked')
        scan['features']['iris_left']['status']='candidate'
        self.assertEqual(reference_points(view,scan)['iris_center_left']['point_px'],[100,100])
        view['landmarks']['iris_center_left']['visible']=False
        self.assertFalse(reference_points(view,scan)['iris_center_left']['visible'])
        view['landmarks']['iris_center_right']['origin']='interactive annotation'
        self.assertEqual(reference_points(view,scan)['iris_center_right'],view['landmarks']['iris_center_right'])

    def test_six_correspondences_use_full_pose_without_downgrading_degenerate_data(self):
        view,scan,model=fixture()
        r=np.array(model['orientation_prior']['R'])
        for name,xyz in [('nose_tip',[0,30,55]),('mouth_left',[-25,60,12]),('mouth_right',[25,60,14])]:
            xyz=np.array(xyz)@r;xy=xyz@r[:2].T*1.3+[240,310]
            view['landmarks'][name]={'point_px':xy.tolist(),'sigma_px':2}
            model['landmarks'][name]={'point3d':xyz.tolist(),'method':'fixture marker'}
        report=align(view,scan,model,'mesh')
        self.assertEqual(report['status'],'candidate');self.assertEqual(report['camera']['method'],'automatic_full_pose')
        for item in model['landmarks'].values():item['point3d'][2]=0
        self.assertEqual(align(view,scan,model,'mesh')['status'],'blocked')


if __name__=='__main__':unittest.main()
