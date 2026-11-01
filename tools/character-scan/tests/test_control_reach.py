from pathlib import Path
import sys
import tempfile
import unittest

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from autopilot import prepare_job, run
from control_reach import control_reach
from fit_diagnosis import diagnose
from mesh_fit import render_silhouette
from outline_objective import measure_outline
from test_autopilot import fixture


def reach_for(snapshot, scan, camera, config=None):
    job, _ = prepare_job(snapshot, scan, camera, config)
    view = job['views'][0]
    mask = render_silhouette(np.asarray(job['mesh']['vertices']), np.asarray(job['mesh']['triangles']), camera, view['size'])
    return control_reach(job, snapshot['protected_vertices'], mask, measure_outline(mask, view['segments']))


class ControlReachTests(unittest.TestCase):
    def test_unprotected_outline_is_reachable(self):
        snapshot, scan, camera = fixture()
        reach = reach_for(snapshot, scan, camera)
        jaw = reach['regions']['jaw_left']
        self.assertGreater(jaw['outline_vertices'], 0)
        self.assertGreater(jaw['categories']['effective'], 0)
        self.assertEqual(jaw['categories']['source_protected'], 0)
        self.assertEqual(reach['locked_by_protection'], [])
        # Overlapping bands: either left-side control may move the jaw edge most.
        self.assertTrue(jaw['driving_control'].endswith('_left'))

    def test_user_protection_over_measured_edge_is_named_not_retried(self):
        snapshot, scan, camera = fixture()
        vertices = np.asarray(snapshot['mesh']['vertices'])
        # A full-width lower band, like a row threshold, also covers the jaw sides.
        snapshot['protected_vertices'] = np.flatnonzero(vertices[:, 1] >= 66).tolist()
        with tempfile.TemporaryDirectory() as root:
            report = run(snapshot, scan, camera, Path(root)/'fit')
            self.assertTrue((Path(root)/'fit/control-reach.png').exists())
        reach = report['control_reach']
        self.assertIn('jaw_left', reach['locked_by_protection'])
        self.assertIn('jaw_right', reach['locked_by_protection'])
        self.assertEqual(reach['regions']['jaw_left']['max_reach_px'], 0)
        diagnosis = report['diagnosis']
        # Cheeks may still yield a candidate; the locked jaw must be named either way.
        if report['status'] in ('stalled', 'blocked'):
            self.assertEqual(diagnosis['next_action'], 'resolve_protection_conflict')
        else:
            self.assertIn('jaw_left', diagnosis['summary'])
        self.assertFalse(diagnosis['automatic_retry'])
        locked = next(f for f in diagnosis['findings'] if f['code'] == 'outline_locked_by_protection')
        self.assertIn('jaw_left', locked['detail'])

    def test_subpixel_first_step_is_reported(self):
        snapshot, scan, camera = fixture()
        reach = reach_for(snapshot, scan, camera, {'max_move_eye_fraction': .01})
        self.assertIn('jaw_left', reach['first_step_below_raster'])
        self.assertIn('jaw_left', reach['reach_below_error'] + reach['first_step_below_raster'])
        d = diagnose({'status': 'stalled', 'control_reach': reach})
        self.assertTrue(any(f['code'] == 'step_below_raster_resolution' for f in d['findings']))
        self.assertNotEqual(d['next_action'], 'resolve_protection_conflict')

    def test_locked_region_beside_candidate_is_named_not_escalated(self):
        reach = {'regions': {'chin': {'categories': {'source_protected': 3}}}, 'locked_by_protection': ['chin']}
        d = diagnose({'status': 'partial_candidate', 'control_reach': reach})
        self.assertNotEqual(d['next_action'], 'resolve_protection_conflict')
        self.assertIn('chin', d['summary'])

    def test_locked_conflict_mentions_missing_evidence_too(self):
        reach = {'regions': {'jaw_left': {'categories': {'source_protected': 3}}}, 'locked_by_protection': ['jaw_left']}
        d = diagnose({'status': 'stalled', 'control_reach': reach}, {'missing_regions': ['cheek_left']})
        self.assertEqual(d['next_action'], 'resolve_protection_conflict')
        self.assertIn('cheek_left', d['summary'])


if __name__ == '__main__':
    unittest.main()
