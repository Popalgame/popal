"""Testy planu humanoida: czysta matematyka, bez Blendera."""

import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest


MODULE = Path(__file__).resolve().parents[1] / "humanoid.py"
spec = importlib.util.spec_from_file_location("character_build_humanoid", MODULE)
humanoid = importlib.util.module_from_spec(spec)
sys.modules["character_build_humanoid"] = humanoid
spec.loader.exec_module(humanoid)


def measurements(height_mm=1800.0):
    return {
        "tool": "character-scan",
        "version": 1,
        "scale": {"height_mm": height_mm, "height_px": 1773, "mm_per_px": height_mm / 1773},
        "landmarks": [
            {"name": "top_of_head", "y": 203, "y_ratio": 0.0, "width_px": 0, "width_mm": 0.0},
            {"name": "head_max", "y": 563, "y_ratio": 0.2032, "width_px": 675, "width_mm": 685.28},
            {"name": "arm_span", "y": 995, "y_ratio": 0.4467, "width_px": 1037, "width_mm": 1052.79},
            {"name": "waist", "y": 1145, "y_ratio": 0.5313, "width_px": 389, "width_mm": 394.92},
            {"name": "hip", "y": 1237, "y_ratio": 0.5832, "width_px": 501, "width_mm": 508.63},
            {"name": "crotch", "y": 1400, "y_ratio": 0.6751, "width_px": 353, "width_mm": 358.38},
            {"name": "lower_leg_min", "y": 1576, "y_ratio": 0.7744, "width_px": 243, "width_mm": 246.70},
            {"name": "ground", "y": 1975, "y_ratio": 1.0, "width_px": 249, "width_mm": 252.79},
        ],
    }


def measurements_with_face():
    data = measurements()
    data["face"] = {
        "method": "hsv-skin+iris-pair",
        "face_width_px": 298,
        "face_width_y": 741,
        "eye_line_y": 765,
        "eye_centers_px": [505, 670],
        "iris_width_px": 59,
        "iris_height_px": 78,
        "chin_y": 891,
        "skin_top_y": 669,
        "visible_face_height_px": 222,
        "confidence": 0.95,
        "face_width_mm": 302.54,
        "face_width_y_ratio": 0.3036,
        "eye_line_y_ratio": 0.3172,
        "eye_spacing_px": 165,
        "eye_spacing_mm": 167.51,
        "iris_width_mm": 59.9,
        "iris_height_mm": 79.19,
        "chin_y_ratio": 0.3883,
        "skin_top_y_ratio": 0.263,
        "visible_face_height_mm": 225.38,
    }
    return data


class FacePlanTests(unittest.TestCase):
    def setUp(self):
        self.plan = humanoid.build_plan(measurements_with_face())

    def test_head_comes_from_face_not_hair(self):
        self.assertAlmostEqual(self.plan.face_width, 0.30254, places=6)
        self.assertAlmostEqual(self.plan.head_width, 0.30254 * 1.06, places=6)
        self.assertLess(self.plan.head_width, 0.36)
        self.assertEqual(self.plan.hair_width, 0.68528)

    def test_eye_line_and_chin_are_measured(self):
        self.assertAlmostEqual(
            self.plan.eye_z, 1.8 * (1.0 - 0.3172), places=6
        )
        self.assertAlmostEqual(
            self.plan.chin_z, 1.8 * (1.0 - 0.3883), places=6
        )
        self.assertGreater(self.plan.head_top, self.plan.eye_z)
        self.assertLess(self.plan.head_bottom, self.plan.eye_z)
        self.assertGreater(self.plan.mouth_z, self.plan.chin_z)
        self.assertLess(self.plan.mouth_z, self.plan.nose_z)

    def test_shoulders_sit_below_the_chin(self):
        self.assertLess(self.plan.shoulder_z, self.plan.chin_z)
        self.assertAlmostEqual(self.plan.shoulder_z, 1.8 * (1 - 0.4467), places=6)
        self.assertGreater(self.plan.shoulder_width, self.plan.head_width)

    def test_body_width_excludes_backpack_props(self):
        self.assertAlmostEqual(self.plan.hip_width, 0.50863 * 0.72, places=6)
        self.assertLess(self.plan.hip_width, self.plan.waist_width)

    def test_eye_geometry_is_inside_the_face(self):
        self.assertLess(self.plan.eye_x + self.plan.eye_width / 2, self.plan.head_width / 2)
        self.assertGreater(self.plan.eye_width, self.plan.iris_width)
        self.assertGreater(self.plan.eye_height, self.plan.iris_height)


class PlanTests(unittest.TestCase):
    def setUp(self):
        self.plan = humanoid.build_plan(measurements())

    def test_height_and_landmark_mapping(self):
        self.assertEqual(self.plan.height, 1.8)
        self.assertAlmostEqual(self.plan.head_max_z, 1.8 * (1 - 0.2032), places=6)
        self.assertAlmostEqual(self.plan.waist_z, 1.8 * (1 - 0.5313), places=6)
        self.assertAlmostEqual(self.plan.crotch_z, 1.8 * (1 - 0.6751), places=6)
        self.assertEqual(self.plan.head_top, 1.8)

    def test_widths_are_in_metres(self):
        self.assertAlmostEqual(self.plan.head_width, 0.68528, places=6)
        self.assertAlmostEqual(self.plan.waist_width, 0.39492, places=6)
        self.assertAlmostEqual(self.plan.hip_width, 0.50863, places=6)
        self.assertAlmostEqual(self.plan.arm_span, 1.05279, places=6)

    def test_chibi_proportions_are_plausible(self):
        self.assertGreater(self.plan.head_height, self.plan.height * 0.25)
        self.assertGreater(self.plan.head_bottom, self.plan.shoulder_z)
        self.assertLess(self.plan.crotch_z, self.plan.hip_z)
        self.assertLess(self.plan.hip_z, self.plan.waist_z)
        self.assertGreater(self.plan.arm_half, self.plan.shoulder_width / 2)

    def test_torso_rings_are_sorted_and_inside_height(self):
        z_values = [ring["z"] for ring in self.plan.torso_rings]
        self.assertEqual(z_values, sorted(z_values))
        self.assertTrue(all(0 < z < self.plan.height for z in z_values))
        for ring in self.plan.torso_rings:
            self.assertGreater(ring["width"], 0)
            self.assertGreater(ring["depth"], 0)

    def test_ring_vertices_and_faces(self):
        ring = self.plan.torso_rings[0]
        vertices = humanoid.ring_vertices(ring, segments=8)
        self.assertEqual(len(vertices), 8)
        self.assertTrue(all(abs(vertex[2] - ring["z"]) < 1e-9 for vertex in vertices))
        faces = humanoid.loft_faces(3, 8)
        self.assertEqual(len(faces), 2 * 8 + 2)
        self.assertTrue(all(len(face) == 4 for face in faces[:-2]))

    def test_explicit_height_overrides_file(self):
        plan = humanoid.build_plan(measurements(), height=2.0)
        self.assertEqual(plan.height, 2.0)
        self.assertAlmostEqual(plan.head_width, 0.68528, places=6)

    def test_rejects_bad_file(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "bad.json"
            path.write_text("{}", encoding="utf-8")
            with self.assertRaises(ValueError):
                humanoid.load_measurements(path)

    def test_as_dict_is_json_ready(self):
        document = self.plan.as_dict()
        json.dumps(document)
        self.assertIn("torso_rings", document)
        self.assertIn("head_max", document["landmarks"])


if __name__ == "__main__":
    unittest.main()
