import json
from pathlib import Path
import sys
import tempfile
import unittest

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from autopilot import prepare_job, run
from mesh_fit import render_silhouette
from metrology3d import project
from outline_objective import edge_shear
from test_autopilot import fixture


def partial_fixture():
    snapshot, scan, camera = fixture()
    scan['face_shape']['segments'] = [s for s in scan['face_shape']['segments'] if s['region'] != 'cheek_right']
    return snapshot, scan, camera


class LocalControlTests(unittest.TestCase):
    def test_partial_mode_uses_several_bands_per_fragment(self):
        snapshot, scan, camera = partial_fixture()
        job, _ = prepare_job(snapshot, scan, camera, {'coverage_mode': 'auto'})
        names = [c['name'] for c in job['controls']]
        self.assertGreater(sum(n.startswith('jaw_right_') for n in names), 1)
        self.assertGreater(sum(n.startswith('jaw_left_') for n in names), 1)

    def test_each_band_stays_inside_its_own_fragment(self):
        snapshot, scan, camera = fixture()
        scan['face_shape']['segments'] = [s for s in scan['face_shape']['segments'] if s['region'] not in ('cheek_right', 'jaw_right')]
        scan['face_shape']['segments'] += [
            {'region': 'jaw_right', 'status': 'partial', 'points_px': [[100, y] for y in range(68, 78)]},
            {'region': 'jaw_right', 'status': 'partial', 'points_px': [[100, y] for y in range(87, 97)]}]
        job, _ = prepare_job(snapshot, scan, camera, {'coverage_mode': 'auto'})
        y = project(np.array(snapshot['mesh']['vertices'], float), camera)[:, 1]
        for control in job['controls']:
            if not control['name'].startswith('jaw_right_'):
                continue
            moved = np.any(np.array(control['offsets']) != 0, axis=1)
            rows = y[moved]
            self.assertTrue(np.all((rows >= 68) & (rows <= 77)) or np.all((rows >= 87) & (rows <= 96)), control['name'])

    def test_band_motion_is_bounded_by_eye_spacing(self):
        snapshot, scan, camera = partial_fixture()
        job, _ = prepare_job(snapshot, scan, camera, {'coverage_mode': 'auto'})
        ceiling = scan['registration']['eye_spacing_px']*.25
        for control in job['controls']:
            self.assertLessEqual(np.linalg.norm(np.array(control['offsets']), axis=1).max(), ceiling+1e-9)
            self.assertLessEqual(control['edge_px_per_unit'], ceiling+1e-9)

    def test_bands_express_widening_above_and_narrowing_below(self):
        snapshot, scan, camera = partial_fixture()
        mesh = snapshot['mesh']
        mask = render_silhouette(np.array(mesh['vertices']), mesh['triangles'], camera, [128, 128])
        for segment in scan['face_shape']['segments']:
            if segment['region'] != 'jaw_right':
                continue
            points = []
            for _, row in segment['points_px']:
                edge = np.flatnonzero(mask[int(row)])[-1]+.5
                points.append([edge+(2 if row < 80 else -2), row])
            segment['points_px'] = points
        results = {}
        with tempfile.TemporaryDirectory() as root:
            for layout in ('regional', 'local'):
                report = run(snapshot, scan, camera, Path(root)/layout,
                             {'coverage_mode': 'auto', 'control_layout': layout, 'target_p95_px': 100})
                results[layout] = report['regions']['jaw_right']['after']['mean_px']
                self.assertEqual(report['frozen_outline']['right']['max_error_px'], 0)
            job = json.loads((Path(root)/'local/fit-job.json').read_text())
            fitted = json.loads((Path(root)/'local/fit/fit-result.json').read_text())['parameters']
        right = [fitted[c['name']] for c in job['controls'] if c['name'].startswith('jaw_right_')]
        self.assertGreater(max(right), 0)
        self.assertLess(min(right), 0)
        self.assertLess(results['local'], results['regional'])

    def test_local_layout_requires_visible_fragment_mode(self):
        snapshot, scan, camera = fixture()
        with self.assertRaises(ValueError):
            prepare_job(snapshot, scan, camera, {'control_layout': 'local'})

    def test_short_gap_is_bridged_and_labelled_long_gap_stays_frozen(self):
        snapshot, scan, camera = fixture()
        scan['face_shape']['segments'] = [s for s in scan['face_shape']['segments'] if s['region'] not in ('cheek_right', 'jaw_right')]
        scan['face_shape']['segments'] += [
            {'region': 'jaw_right', 'status': 'partial', 'points_px': [[100, y] for y in range(68, 78)]},
            {'region': 'jaw_right', 'status': 'partial', 'points_px': [[100, y] for y in range(80, 86)]},
            {'region': 'jaw_right', 'status': 'partial', 'points_px': [[100, y] for y in range(95, 97)]+[[100, 97]]}]
        job, _ = prepare_job(snapshot, scan, camera, {'coverage_mode': 'auto'})
        # sep 38: bridge limit max(2*2, 2.28)=4 rows; 77->80 bridged, 85->95 not.
        self.assertEqual(job['coverage']['interpolated_gaps_px']['right'], [[77, 80]])
        self.assertEqual(job['views'][0]['mutable_outline_intervals_px']['right'], [[68, 85], [95, 97]])
        y = project(np.array(snapshot['mesh']['vertices'], float), camera)[:, 1]
        long_gap = (np.array(snapshot['mesh']['vertices'])[:, 0] >= 64) & (y > 85) & (y < 95)
        for control in job['controls']:
            self.assertTrue(np.all(np.array(control['offsets'])[long_gap] == 0))

    def test_bridging_can_be_disabled(self):
        snapshot, scan, camera = fixture()
        scan['face_shape']['segments'] = [s for s in scan['face_shape']['segments'] if s['region'] not in ('cheek_right', 'jaw_right')]
        scan['face_shape']['segments'] += [
            {'region': 'jaw_right', 'status': 'partial', 'points_px': [[100, y] for y in range(68, 78)]},
            {'region': 'jaw_right', 'status': 'partial', 'points_px': [[100, y] for y in range(80, 90)]}]
        job, _ = prepare_job(snapshot, scan, camera, {'coverage_mode': 'auto', 'bridge_gap_px': 0})
        self.assertEqual(job['coverage']['interpolated_gaps_px']['right'], [])
        self.assertEqual(len(job['views'][0]['mutable_outline_intervals_px']['right']), 2)

    def test_edge_shear_limit_holds_in_result_and_rejects_notches(self):
        snapshot, scan, camera = partial_fixture()
        with tempfile.TemporaryDirectory() as root:
            report = run(snapshot, scan, camera, Path(root)/'fit', {'coverage_mode': 'auto', 'target_p95_px': 100})
        self.assertLessEqual(max(report['edge_shear']['max_px_per_row'].values()), report['edge_shear']['limit_px_per_row'])
        before = np.zeros((10, 10), bool); before[:, 2:8] = True
        after = before.copy(); after[5, 2:5] = False
        self.assertEqual(edge_shear(before, after)['left'], 3)
        self.assertEqual(edge_shear(before, after)['right'], 0)

    def test_invalid_shear_limit_is_refused(self):
        snapshot, scan, camera = partial_fixture()
        with tempfile.TemporaryDirectory() as root:
            with self.assertRaises(ValueError):
                run(snapshot, scan, camera, Path(root)/'fit', {'coverage_mode': 'auto', 'max_edge_shear_px_per_row': .2})


if __name__ == '__main__':
    unittest.main()
