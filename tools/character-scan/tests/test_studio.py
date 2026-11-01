import base64
import copy
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
import threading
import urllib.request
import urllib.error

import numpy as np
from PIL import Image

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from metrology3d import camera_from_parameters,fit_camera,project,triangulate
from deviation import compare_masks,align_similarity
from mesh_fit import fit_mesh,mesh_digest,render_silhouette
from mesh_snapshot import verify_result,job_digest
import studio_project as studio


def camera(angle=0):
    c=camera_from_parameters([0,angle,0,np.log(25),64,64],'orthographic')
    c.update(status='calibrated',frame_id='fixture',world_unit='mm')
    return c


def fixture_job(root):
    vertices=np.array([[x,y,z] for x in (-1.,1.) for y in (-1.,1.) for z in (-1.,1.)])
    from scipy.spatial import ConvexHull
    triangles=ConvexHull(vertices).simplices.tolist()
    offsets=np.zeros_like(vertices);offsets[:,0]=vertices[:,0]*.2
    target=vertices+offsets
    views=[]
    for i,c in enumerate([camera(),camera(.65)]):
        path=Path(root)/f'target-{i}.png'
        Image.fromarray(render_silhouette(target,triangles,c,[128,128]).astype('uint8')*255).save(path)
        views.append({'name':str(i),'camera':c,'size':[128,128],'mask':str(path),'mask_sha256':studio.digest(path)})
    return {'mesh':{'vertices':vertices.tolist(),'triangles':triangles,'sha256':mesh_digest(vertices.tolist(),triangles)},
            'controls':[{'name':'width','offsets':offsets.tolist(),'min':0,'max':1}],
            'views':views,'max_displacement':.21,'iterations':8,'regularization':0},target


class CameraTests(unittest.TestCase):
    def setUp(self):self.x=np.random.default_rng(3).uniform(-1,1,(30,3))
    def test_orthographic_and_perspective_recovery_on_heldout_points(self):
        k=[[600,0,320],[0,610,240],[0,0,1]]
        for kind,params in [('orthographic',[.1,.4,-.2,np.log(120),320,240]),('perspective',[.1,.4,-.2,.2,-.1,6])]:
            true=camera_from_parameters(params,kind,k)
            recovered=fit_camera(self.x[:20],project(self.x[:20],true),kind,intrinsics=k)
            self.assertEqual(recovered['status'],'candidate')
            np.testing.assert_allclose(project(self.x[20:],recovered),project(self.x[20:],true),atol=1e-5)
    def test_coplanar_calibration_is_rejected(self):
        self.x[:,2]=0
        with self.assertRaisesRegex(ValueError,'coplanar'):fit_camera(self.x,project(self.x,camera()))
    def test_incompatible_correspondences_cannot_enable_fitting(self):
        pixels=project(self.x,camera());pixels=np.roll(pixels,7,axis=0)
        self.assertNotEqual(fit_camera(self.x,pixels)['status'],'candidate')
    def test_triangulation_baseline_and_noise_uncertainty(self):
        p=np.array([.2,.3,.4]);cams=[camera(),camera(.65)]
        obs=[{'camera':c,'point_px':project([p],c)[0].tolist(),'sigma_px':.5} for c in cams]
        result=triangulate(obs);np.testing.assert_allclose(result['point'],p,atol=1e-10)
        high=copy.deepcopy(obs)
        for o in high:o['sigma_px']=2
        np.testing.assert_allclose(np.array(triangulate(high)['std_xyz']),np.array(result['std_xyz'])*4,rtol=1e-8)
        self.assertEqual(triangulate([obs[0],obs[0]])['status'],'unknown')
        high[1]['camera']['frame_id']='other'
        with self.assertRaisesRegex(ValueError,'frames'):triangulate(high)


class DeviationTests(unittest.TestCase):
    def test_signed_error_and_conditional_uncertainty(self):
        a=np.zeros((80,80),bool);a[20:60,20:60]=True
        r,e=compare_masks(a,a);self.assertEqual(r['boundary_mean_px'],0);self.assertFalse(e.any())
        b=np.zeros_like(a);b[15:65,15:65]=True
        r,e=compare_masks(a,b,mm_per_px=.5,segmentation_sigma_px=1,camera_sigma_px=2,scale_relative_sigma=.02)
        self.assertEqual(r['uncertainty']['status'],'conditional');self.assertGreater(r['candidate_outward_mean_px'],4)
        self.assertEqual(r['boundary_mean_mm'],r['boundary_mean_px']*.5)
        r,e=compare_masks(b,a);self.assertGreater(r['candidate_inward_mean_px'],4)
        valid=np.zeros_like(a);valid[:10]=True
        self.assertEqual(compare_masks(a,b,valid)[0]['status'],'unknown')
    def test_similarity_recovers_rotation_without_reflection(self):
        a=np.array([[1,2],[3,5],[7,2],[9,4]])
        r=np.array([[0,-1],[1,0]]);b=a@r*2+[40,10]
        result=align_similarity(a,b);m=np.array(result['matrix'])
        np.testing.assert_allclose(np.c_[a,np.ones(4)]@m.T,b,atol=1e-12)
        with self.assertRaises(ValueError):align_similarity([[0,0],[1,0],[2,0]],[[0,0],[1,0],[2,0]])


class MeshTests(unittest.TestCase):
    def test_javascript_numeric_roundtrip_and_result_tampering(self):
        self.assertEqual(mesh_digest([[1.,0.,-2.]],[[0,0,0]]),mesh_digest([[1,0,-2]],[[0,0,0]]))
        with tempfile.TemporaryDirectory() as root:
            job,_=fixture_job(root);result=fit_mesh(job,Path(root)/'fit');self.assertTrue(verify_result(job,result))
            result['vertices'][0][0]+=.001
            with self.assertRaisesRegex(ValueError,'bounded controls'):verify_result(job,result)
    def test_bounded_fit_improves_both_views_and_preserves_source(self):
        with tempfile.TemporaryDirectory() as root:
            job,target=fixture_job(root);before=copy.deepcopy(job)
            result=fit_mesh(job,Path(root)/'fit')
            self.assertEqual(job,before);self.assertGreater(result['accepted_steps'],0)
            self.assertTrue(all(a<b for a,b in zip(result['after_scores'],result['before_scores'])))
            np.testing.assert_allclose(result['vertices'],target)
            job['protected_vertices']=[0,1]
            result=fit_mesh(job,Path(root)/'pinned')
            np.testing.assert_array_equal(np.array(result['vertices'])[:2],np.array(job['mesh']['vertices'])[:2])
            self.assertLessEqual(result['max_displacement'],job['max_displacement'])
            job['mesh']['vertices'][0][0]+=.1
            with self.assertRaisesRegex(ValueError,'checksum'):fit_mesh(job,Path(root)/'bad')


class ProjectTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)/'project'
        source=Path(self.temp.name)/'source.png';Image.new('RGBA',(64,80),'white').save(source)
        studio.create(self.root);studio.import_view(self.root,'front',source)
    def tearDown(self):self.temp.cleanup()
    def action(self,**payload):return studio.action(self.root,{'revision':studio.read(self.root)['revision'],'view':'front',**payload})
    def test_revision_conflicts_and_camera_invalidation(self):
        p=studio.read(self.root);v=p['views']['front']
        v['landmarks']={'nose_tip':{'point_px':[20,30],'sigma_px':1,'point3d':[1,2,3]}};v['camera']=camera()
        studio.commit(self.root,p,p['revision'])
        original=studio.read(self.root);landmarks=copy.deepcopy(original['views']['front']['landmarks'])
        p=self.action(action='save',landmarks=landmarks)
        self.assertEqual(p['views']['front']['camera'],camera())
        landmarks['nose_tip']['point_px'][0]+=1
        p=self.action(action='save',landmarks=landmarks);self.assertIsNone(p['views']['front']['camera'])
        self.assertEqual(json.loads((self.root/'revisions'/f"{original['revision']:06}.json").read_text()),original)
        with self.assertRaisesRegex(ValueError,'Revision conflict'):studio.action(self.root,{'action':'save','revision':1,'view':'front'})
    def test_mask_edits_keep_immutable_history_and_detect_tampering(self):
        mask=Image.new('RGBA',(64,80));mask.putpixel((30,40),(255,255,255,255));buf=io.BytesIO();mask.save(buf,format='PNG')
        p=self.action(action='save',mask_name='iris_left',mask_png=base64.b64encode(buf.getvalue()).decode())
        entry=p['views']['front']['masks']['iris_left'];path=self.root/entry['path']
        self.assertEqual(np.count_nonzero(np.asarray(Image.open(path))),1)
        self.assertFalse(entry['reviewed']);studio.validate_view(self.root,p['views']['front'])
        path.write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError,'changed'):self.action(action='save')
    def test_invalid_annotations_and_paths(self):
        with self.assertRaisesRegex(ValueError,'outside'):self.action(action='save',landmarks={'nose_tip':{'point_px':[100,20],'sigma_px':1}})
        with self.assertRaises(ValueError):studio.safe_path(self.root,'../outside')
    def test_http_roundtrip_conflict_and_revision_restore(self):
        from studio import Server
        server=Server(('127.0.0.1',0),self.root,None);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        base=f'http://127.0.0.1:{server.server_port}'
        def post(payload,origin=None):
            headers={'Content-Type':'application/json'}
            if origin:headers['Origin']=origin
            request=urllib.request.Request(base+'/api/action',json.dumps(payload).encode(),headers)
            with urllib.request.urlopen(request) as response:return json.load(response)
        try:
            with urllib.request.urlopen(base+'/api/project') as response:p=json.load(response)
            before=p['revision']
            p=post({'action':'save','view':'front','revision':before,'landmarks':{'nose_tip':{'point_px':[12,20],'sigma_px':2}}})
            self.assertEqual(p['revision'],before+1)
            with self.assertRaises(urllib.error.HTTPError) as conflict:post({'action':'save','view':'front','revision':before})
            self.assertEqual(conflict.exception.code,409)
            with self.assertRaises(urllib.error.HTTPError):post({'action':'save','view':'front','revision':p['revision']},'https://example.com')
            p=post({'action':'restore','revision':p['revision'],'restore_revision':before})
            self.assertEqual(p['views']['front']['landmarks'],{});self.assertEqual(p['revision'],before+2)
        finally:server.shutdown();server.server_close();thread.join()


if __name__=='__main__':unittest.main()
