import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

import numpy as np
from PIL import Image

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import studio_project as project
from blender_pipeline import Jobs, bind, validate_renders
from autopilot import run
from test_autopilot import fixture


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)/'project';project.create(self.root)
        image=Path(self.temp.name)/'image.png';Image.new('RGB',(128,128),'white').save(image)
        project.import_view(self.root,'front',image)
        self.blend=Path(self.temp.name)/'source.blend';self.blend.write_bytes(b'bound-source-fixture')
        bind(self.root,self.blend,'face','fixture')

    def test_manifest_survives_rebinding_and_worker_cannot_drop_pins(self):
        snapshot,_,_=fixture()
        manifest={'schema':'polpal.mesh-protection/1','source_blend_sha256':project.digest(self.blend),
            'source_mesh_sha256':snapshot['mesh']['sha256'],'object':'face','frame_id':'fixture','protected_vertices':[0,1]}
        path=Path(self.temp.name)/'protection.json';project.write_json(path,manifest)
        bind(self.root,self.blend,'face','fixture',path)
        p=bind(self.root,self.blend,'face','fixture')
        self.assertEqual(p['blender_source']['protection'],manifest)
        jobs=Jobs(self.root,'/unused/blender')
        def worker(stage,blend,out):project.write_json(out/'snapshot.json',snapshot)
        with patch.object(jobs,'worker',side_effect=worker),patch.object(project,'scan_view') as scanner:
            state=jobs.start({'revision':p['revision'],'view':'front'},background=False)
        scanner.assert_not_called();self.assertEqual(state['status'],'failed')
        self.assertIn('omitted required protected vertices',state['message'])
        self.blend.write_bytes(b'new source')
        with self.assertRaisesRegex(ValueError,'Protection source mismatch'):bind(self.root,self.blend,'face','fixture')

    def test_source_change_blocks_before_blender_execution(self):
        self.blend.write_bytes(b'changed')
        jobs=Jobs(self.root,'/unused/blender')
        with patch.object(jobs,'worker') as worker:
            state=jobs.start({'revision':project.read(self.root)['revision'],'view':'front'},background=False)
        worker.assert_not_called();self.assertEqual(state['status'],'blocked');self.assertEqual(state['stop_reason'],'source_changed')
        diagnosis=json.loads((self.root/state['diagnosis']).read_text())
        self.assertEqual(diagnosis['next_action'],'resolve_input_contract')

    def test_diagnosis_failure_releases_project_lease(self):
        self.blend.write_bytes(b'changed');jobs=Jobs(self.root,'/unused/blender')
        with patch('blender_pipeline.diagnose',side_effect=ValueError('diagnostic failure')):
            state=jobs.start({'revision':project.read(self.root)['revision'],'view':'front'},background=False)
        self.assertEqual(state['status'],'failed');self.assertNotIn('candidate',state)
        self.assertEqual(state['diagnosis_error'],'diagnostic failure')
        lease=jobs.lease();lease.close()

    def test_exclusive_runner_and_interrupted_recovery(self):
        jobs=Jobs(self.root,'/unused/blender');lease=jobs.lease()
        out=jobs.folder/'old';out.mkdir();project.write_json(out/'state.json',{'status':'running','source_revision':1})
        try:
            other=Jobs(self.root,'/unused/blender')
            with self.assertRaisesRegex(ValueError,'already running'):other.lease()
            self.assertEqual(json.loads((out/'state.json').read_text())['status'],'running')
        finally:lease.close()
        Jobs(self.root,'/unused/blender')
        self.assertEqual(json.loads((out/'state.json').read_text())['status'],'interrupted')

    def test_no_candidate_download_after_revision_change(self):
        jobs=Jobs(self.root,None);out=jobs.folder/'old';out.mkdir()
        project.write_json(out/'state.json',{'status':'target_met','source_revision':project.read(self.root)['revision'],'candidate':'candidate.blend'})
        self.assertIn('candidate',jobs.states()[0]);p=project.read(self.root);project.commit(self.root,p,p['revision'])
        self.assertNotIn('candidate',jobs.states()[0]);self.assertFalse(jobs.states()[0]['current'])

    def test_render_gate_rejects_displaced_blender_geometry(self):
        snapshot,scan,camera=fixture();out=Path(self.temp.name)/'render';out.mkdir()
        report=run(snapshot,scan,camera,out/'autopilot')
        for label in ('before','after'):
            gray=np.asarray(Image.open(out/f'autopilot/fit/{label}-view-0.png').convert('L'))
            pixels=np.zeros((*gray.shape,4),np.uint8);pixels[:,:,3]=gray
            Image.fromarray(pixels).save(out/f'{label}-silhouette.png')
        self.assertIn(validate_renders(out,report)['status'],('candidate','target_met'))
        pixels=np.roll(pixels,9,axis=1);Image.fromarray(pixels).save(out/'after-silhouette.png')
        bad=validate_renders(out,report)
        self.assertEqual(bad['status'],'rejected');self.assertFalse(bad['raster_agreement_passed'])

    def test_partial_render_cannot_claim_full_target_and_rejects_hidden_edge_change(self):
        snapshot,scan,camera=fixture();out=Path(self.temp.name)/'render';out.mkdir()
        scan['face_shape']['segments']=[s for s in scan['face_shape']['segments'] if s['region']!='cheek_right']
        report=run(snapshot,scan,camera,out/'autopilot',{'coverage_mode':'auto','target_p95_px':100})
        for label in ('before','after'):
            gray=np.asarray(Image.open(out/f'autopilot/fit/{label}-view-0.png').convert('L'))
            pixels=np.zeros((*gray.shape,4),np.uint8);pixels[:,:,3]=gray
            Image.fromarray(pixels).save(out/f'{label}-silhouette.png')
        measured=validate_renders(out,report)
        self.assertEqual(measured['status'],'partial_candidate');self.assertFalse(measured['full_target_met'])
        self.assertTrue(measured['supported_target_met']);self.assertEqual(measured['regions']['cheek_right']['status'],'unknown')
        # Alter only a hidden right-cheek row by two pixels. Global raster
        # agreement tolerates this, but the independent frozen-row gate must not.
        y=60;edge=np.flatnonzero(pixels[y,:,3])[-1];pixels[y,edge+1:edge+3,3]=255
        Image.fromarray(pixels).save(out/'after-silhouette.png')
        bad=validate_renders(out,report)
        self.assertTrue(bad['raster_agreement_passed']);self.assertEqual(bad['status'],'rejected')
        self.assertEqual(bad['frozen_outline']['right']['max_error_px'],2)

    def test_missing_camera_collects_evidence_and_blocks_without_correspondences(self):
        jobs=Jobs(self.root,'/unused/blender')
        snapshot,scan,_=fixture();scan['source_sha256']=project.read(self.root)['views']['front']['source_sha256']
        def worker(stage,blend,out):
            self.assertEqual(stage,'snapshot');project.write_json(out/'snapshot.json',snapshot)
            project.write_json(out/'model-landmarks.json',{'world_unit':'mm','frame_id':'fixture','landmarks':{},
                'source_mesh_sha256':snapshot['mesh']['sha256'],'source_blend_sha256':project.digest(self.blend)})
        with patch.object(jobs,'worker',side_effect=worker) as called,patch.object(project,'scan_view',return_value=scan):
            state=jobs.start({'revision':project.read(self.root)['revision'],'view':'front'},background=False)
        called.assert_called_once();self.assertEqual(state['stop_reason'],'camera_required')
        self.assertIn('automatic_camera',state)
        diagnosis=json.loads((self.root/state['diagnosis']).read_text())
        self.assertEqual(diagnosis['next_action'],'resolve_camera_evidence')

    def test_cancel_at_stage_boundary_retains_report_and_releases_lease(self):
        snapshot,scan,camera=fixture();p=project.read(self.root)
        camera['source_sha256']=p['views']['front']['source_sha256'];p['views']['front']['camera']=camera
        project.commit(self.root,p,p['revision']);jobs=Jobs(self.root,'/unused/blender')
        def snapshot_and_cancel(stage,blend,out):
            project.write_json(out/'snapshot.json',snapshot);jobs.cancel_event.set()
        with patch.object(jobs,'worker',side_effect=snapshot_and_cancel):
            state=jobs.start({'revision':project.read(self.root)['revision'],'view':'front'},background=False)
        self.assertEqual(state['status'],'cancelled');self.assertNotIn('candidate',state)
        lease=jobs.lease();lease.close()

    def test_edit_during_render_does_not_publish_candidate(self):
        snapshot,scan,camera=fixture();p=project.read(self.root)
        camera['source_sha256']=scan['source_sha256']=p['views']['front']['source_sha256'];p['views']['front']['camera']=camera
        project.commit(self.root,p,p['revision']);jobs=Jobs(self.root,'/unused/blender')
        def worker(stage,blend,out):
            if stage=='snapshot':project.write_json(out/'snapshot.json',snapshot)
            elif stage=='render':
                (out/'candidate.blend').write_bytes(b'candidate')
                changed=project.read(self.root);project.commit(self.root,changed,changed['revision'])
        with patch.object(jobs,'worker',side_effect=worker),patch.object(project,'scan_view',return_value=scan),patch('blender_pipeline.validate_renders',return_value={'status':'target_met'}):
            state=jobs.start({'revision':project.read(self.root)['revision'],'view':'front'},background=False)
        self.assertEqual(state['status'],'stale');self.assertNotIn('candidate',state)


if __name__=='__main__':unittest.main()
