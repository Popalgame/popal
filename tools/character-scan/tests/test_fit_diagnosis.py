import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from fit_diagnosis import diagnose
from autopilot import run
from test_autopilot import fixture


class DiagnosisTests(unittest.TestCase):
    def test_camera_and_constraint_blocks_have_distinct_actions(self):
        for code,action in [('camera_error','resolve_camera_evidence'),('constraints_lock_face','retain_constraints')]:
            d=diagnose({'status':'blocked','stop_reason':code,'message':'known cause'})
            self.assertEqual(d['next_action'],action);self.assertFalse(d['automatic_retry'])
            self.assertEqual(d['findings'][0]['code'],code)

    def test_evidence_gap_is_not_reported_as_shape_or_zero_error(self):
        d=diagnose({'status':'partial_candidate'}, {'missing_regions':['cheek_right'],'regions':{
            'cheek_left':{'scanner':{'boundary_evidence':{'rejected_reasons':{'outward_hair_contact':17}}}}}})
        self.assertEqual(d['next_action'],'resolve_boundary_evidence')
        self.assertTrue(any(f['code']=='ambiguous_boundaries_rejected' for f in d['findings']))
        self.assertFalse(any(f['category']=='shape_or_controls' for f in d['findings']))

    def test_search_rejections_are_recorded_without_claiming_unique_shape_cause(self):
        snapshot,scan,camera=fixture()
        with tempfile.TemporaryDirectory() as root:
            report=run(snapshot,scan,camera,Path(root)/'fit',{'max_move_eye_fraction':.01})
            result=json.loads((Path(root)/'fit/fit/fit-result.json').read_text())
            d=report['diagnosis'];search=result['search_diagnostics']
            self.assertEqual(sum(search['trial_reasons'].values()),len(result['history']))
            self.assertTrue(all(t.get('reason') for t in result['history']))
            self.assertEqual(d,json.loads((Path(root)/'fit/diagnosis.json').read_text()))
            self.assertFalse(d['automatic_retry']);self.assertFalse(d['likeness_approved'])
            residual=next(f for f in d['findings'] if f['code']=='remaining_observed_error')
            self.assertIn('undetermined',residual['detail']['cause'])
            self.assertTrue(any(f['code']=='subpixel_control_range' for f in d['findings']))

    def test_failed_or_stale_result_never_recommends_candidate_review(self):
        for status in ('failed','stale','rejected','cancelled'):
            self.assertEqual(diagnose({'status':status})['next_action'],'stop_and_inspect')

    def test_missing_camera_due_to_rejected_chin_points_to_evidence(self):
        evidence={'missing_regions':['chin'],'regions':{'chin':{'scanner':{'boundary_evidence':{'rejected_reasons':{'skin_continues_outward':10}}}}}}
        d=diagnose({'status':'blocked','stop_reason':'camera_required'},evidence)
        self.assertEqual(d['next_action'],'resolve_boundary_evidence')
        self.assertTrue(any(f['category']=='camera' for f in d['findings']))


if __name__=='__main__':unittest.main()
