from pathlib import Path
import sys
import tempfile
import unittest

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from surface_quality import check, intersecting_pairs
from mesh_fit import fit_mesh
from mesh_snapshot import mesh_digest


def grid(n=8):
    """Flat n x n quad grid in the XY plane, split into triangles."""
    xs, ys = np.meshgrid(np.arange(n, dtype=float), np.arange(n, dtype=float))
    vertices = np.c_[xs.ravel(), ys.ravel(), np.zeros(n*n)]
    triangles = []
    for y in range(n-1):
        for x in range(n-1):
            a, b, c, d = y*n+x, y*n+x+1, (y+1)*n+x, (y+1)*n+x+1
            triangles += [[a, b, d], [a, d, c]]
    return vertices, np.asarray(triangles)


class SurfaceQualityTests(unittest.TestCase):
    def test_unchanged_and_smooth_bend_pass(self):
        vertices, triangles = grid()
        self.assertEqual(check(vertices, vertices, triangles)['status'], 'pass')
        bent = vertices.copy()
        bent[:, 2] = .02*(bent[:, 0]-3.5)**2
        self.assertEqual(check(vertices, bent, triangles)['status'], 'pass')

    def test_sharp_crease_is_reported(self):
        vertices, triangles = grid()
        creased = vertices.copy()
        creased[:, 2] = np.where(creased[:, 0] > 3, (creased[:, 0]-3)*1.5, 0)
        result = check(vertices, creased, triangles)
        self.assertEqual(result['status'], 'fail')
        self.assertIn('new_crease', result['failures'])

    def test_stretch_is_reported(self):
        vertices, triangles = grid()
        stretched = vertices.copy()
        stretched[stretched[:, 0] == 7, 0] += 4
        self.assertIn('stretch', check(vertices, stretched, triangles)['failures'])

    def test_new_intersection_counted_but_source_intersection_ignored(self):
        vertices, triangles = grid(6)
        # A separate flap above the grid, folded down through it by the "fit".
        flap = np.array([[2.2, 2.2, 1.], [2.8, 2.2, 1.], [2.5, 2.8, 1.]])
        source = np.vstack([vertices, flap])
        faces = np.vstack([triangles, [[36, 37, 38]]])
        result = source.copy()
        result[36, 2] = -1.
        self.assertGreater(len(intersecting_pairs(result, faces, range(len(faces)))), 0)
        report = check(source, result, faces, {'max_crease_change_deg': 180, 'max_normal_rotation_deg': 180})
        self.assertEqual(report['metrics']['new_intersections'], len(intersecting_pairs(result, faces, range(len(faces)))))
        self.assertIn('self_intersection', report['failures'])
        # Already crossing in the source: not a new defect.
        report = check(result, result, faces)
        self.assertEqual(report['metrics']['new_intersections'], 0)

    def test_fit_search_rejects_crease_trials(self):
        vertices, triangles = grid()
        mesh = {'vertices': vertices.tolist(), 'triangles': triangles.tolist(), 'frame_id': 'f', 'world_unit': 'mm'}
        mesh['sha256'] = mesh_digest(mesh['vertices'], mesh['triangles'])
        offsets = np.zeros_like(vertices)
        offsets[vertices[:, 0] > 3, 2] = vertices[vertices[:, 0] > 3, 0]-3
        camera = {'P': [[10, 0, 0, 5], [0, 10, 0, 5], [0, 0, 0, 1]], 'status': 'candidate', 'frame_id': 'f', 'world_unit': 'mm'}
        segments = [{'region': 'jaw_left', 'status': 'partial', 'points_px': [[4.5, y] for y in range(10, 70)]}]
        job = {'mesh': mesh, 'controls': [{'name': 'lift', 'offsets': offsets.tolist()}], 'max_displacement': 10,
               'views': [{'target_kind': 'visible_outline', 'segments': segments, 'camera': camera, 'size': [90, 90], 'source_sha256': 'test'}],
               'surface_limits': {'max_normal_rotation_deg': 25, 'max_crease_change_deg': 10, 'min_area_ratio': .5, 'max_area_ratio': 2}}
        with tempfile.TemporaryDirectory() as root:
            result = fit_mesh(job, Path(root)/'fit')
        self.assertIn('surface_quality', result['search_diagnostics']['trial_reasons'])
        self.assertEqual(result['accepted_steps'], 0)

    def test_switched_quad_diagonal_is_reported_not_counted_as_crease(self):
        vertices, triangles = grid()
        folded = vertices.copy()
        folded[9, 2] = 3.
        flipped = triangles.copy()
        flipped[0], flipped[1] = [0, 1, 8], [1, 9, 8]
        report = check(folded, folded, flipped, source_triangles=triangles)
        self.assertEqual(report['metrics']['retessellated_triangles'], 2)
        self.assertEqual(report['status'], 'pass')


if __name__ == '__main__':
    unittest.main()
