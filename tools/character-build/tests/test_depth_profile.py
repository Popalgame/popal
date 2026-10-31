"""Testy profilu głębokości z widoku bocznego i planu z profilem."""

import importlib.util
import contextlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest

import numpy as np
from PIL import Image, ImageDraw


BUILD = Path(__file__).resolve().parents[1]
SCAN = BUILD.parent / "character-scan" / "scan.py"


def load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


depth_from_side = load("character_build_depth_from_side", BUILD / "depth_from_side.py")
humanoid = load("character_build_humanoid", BUILD / "humanoid.py")


def side_silhouette() -> Image.Image:
    """Boczny widok: głębokości w px znane z rysowania (kadr 300x600).

    Postać skierowana w lewo; środek ciała w x=150. Głowa ma głębokość 100 px
    (100..200), tors w talii 90 px, w biodrach 120 px.
    """
    image = Image.new("RGBA", (300, 600), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    skin = (238, 196, 172, 255)
    draw.ellipse([100, 40, 200, 140], fill=skin)  # głowa: 100 px głębokości
    draw.rectangle([110, 130, 190, 380], fill=skin)  # tors: 80 px
    draw.rectangle([90, 250, 210, 380], fill=skin)  # biodra: 120 px
    draw.rectangle([135, 380, 165, 560], fill=skin)  # nogi
    return image


class DepthFromSideTests(unittest.TestCase):
    def test_run_containing_center_beats_nearest_edge(self):
        row = np.zeros(100, dtype=bool)
        row[10:70] = True
        row[80:90] = True
        self.assertEqual(depth_from_side.row_run_near_center(row, 65, max_gap=1), (10, 69))

    def test_missing_first_row_does_not_use_undefined_image_variable(self):
        module = depth_from_side._load_scan()
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "side.png"
            image = side_silhouette()
            ImageDraw.Draw(image).rectangle((0, 190, 299, 210), fill=(0, 0, 0, 0))
            image.save(path)
            result = depth_from_side.measure_depths(module, path, {"empty": .3077}, 1.8)
        self.assertIsNone(result["landmarks"]["empty"]["depth_m"])

    def test_clipped_cross_section_does_not_become_measured_depth(self):
        module = depth_from_side._load_scan()
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "side.png"
            image = side_silhouette()
            ImageDraw.Draw(image).rectangle((0, 190, 190, 210), fill=(238, 196, 172, 255))
            image.save(path)
            result = depth_from_side.measure_depths(module, path, {"waist": .3077}, 1.8)
        self.assertTrue(result["landmarks"]["waist"]["clipped"])
        self.assertIsNone(result["landmarks"]["waist"]["depth_m"])

    def test_cli_height_override_stays_in_millimeters(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            image, measurements = root / "side.png", root / "measurements.json"
            side_silhouette().save(image)
            measurements.write_text(json.dumps({"scale": {"height_mm": 1800},
                "landmarks": [{"name": "waist", "y_ratio": 0.3077}]}))
            with contextlib.redirect_stdout(io.StringIO()):
                depth_from_side.main(["--image", str(image), "--measurements", str(measurements),
                                     "--out", str(root), "--height-mm", "1800"])
            report = json.loads((root / "depth-profile.json").read_text())
        self.assertEqual(report["height_mm"], 1800)
        self.assertLess(report["landmarks"]["waist"]["depth_m"], 1)

    def test_rejects_vertical_clipping_and_bad_height(self):
        module = depth_from_side._load_scan()
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "side.png"
            image = side_silhouette()
            ImageDraw.Draw(image).line([(150, 0), (150, 60)], fill=(255, 0, 0, 255))
            image.save(path)
            with self.assertRaises(ValueError):
                depth_from_side.measure_depths(module, path, {"waist": .5}, 1.8)
            with self.assertRaises(ValueError):
                depth_from_side.measure_depths(module, path, {"waist": .5}, float("nan"))

    def test_measures_known_depths(self):
        module = depth_from_side._load_scan()
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "side.png"
            side_silhouette().save(path)
            result = depth_from_side.measure_depths(
                module,
                path,
                rows={
                    # Rzędy przez środek figur: głowa y=90, talia y=200,
                    # biodra y=315 (kadr 600 px, postać 40..560).
                    "head_max": 0.09615,
                    "waist": 0.3077,
                    "hip": 0.5288,
                    "crotch": 0.7,
                },
                height_m=1.8,
            )
        landmarks = result["landmarks"]
        mm_per_px = result["mm_per_px"]
        # Głowa: elipsa 100..200 → 101 px szerokości w środkowym rzędzie.
        self.assertAlmostEqual(
            landmarks["head_max"]["depth_m"], 101 * mm_per_px / 1000.0, places=3
        )
        # Talia: prostokąt 110..190 → 81 px.
        self.assertAlmostEqual(
            landmarks["waist"]["depth_m"], 81 * mm_per_px / 1000.0, places=3
        )
        # Biodra: prostokąt 90..210 → 121 px.
        self.assertAlmostEqual(
            landmarks["hip"]["depth_m"], 121 * mm_per_px / 1000.0, places=3
        )


class PlanWithDepthProfileTests(unittest.TestCase):
    def measurements(self) -> dict:
        data = {
            "tool": "character-scan",
            "version": 1,
            "scale": {"height_mm": 1800.0, "height_px": 1773, "mm_per_px": 1.0152},
            "landmarks": [
                {"name": "head_max", "y_ratio": 0.2032, "width_mm": 685.28},
                {"name": "arm_span", "y_ratio": 0.4467, "width_mm": 1052.79},
                {"name": "waist", "y_ratio": 0.5313, "width_mm": 394.92},
                {"name": "hip", "y_ratio": 0.5832, "width_mm": 508.63},
                {"name": "crotch", "y_ratio": 0.6751, "width_mm": 358.38},
                {"name": "lower_leg_min", "y_ratio": 0.7744, "width_mm": 246.70},
                {"name": "ground", "y_ratio": 1.0, "width_mm": 252.79},
            ],
            "face": {
                "face_width_px": 298,
                "face_width_mm": 302.54,
                "eye_line_y_ratio": 0.3172,
                "chin_y_ratio": 0.3883,
                "eye_spacing_mm": 167.51,
                "iris_width_mm": 59.9,
                "iris_height_mm": 79.19,
            },
        }
        return data

    def rings(self, plan) -> dict:
        return {ring["name"]: ring for ring in plan.torso_rings}

    def test_profile_overrides_torso_depths(self):
        plan = humanoid.build_plan(self.measurements())
        baseline = self.rings(plan)
        profile = {
            "source_label": "generated",
            "landmarks": {
                "hip": {"depth_m": 0.30},
                "waist": {"depth_m": 0.26},
            },
        }
        plan_profiled = humanoid.build_plan(
            self.measurements(), depth_profile=profile
        )
        profiled = self.rings(plan_profiled)
        self.assertAlmostEqual(profiled["hip"]["depth"], 0.30, places=6)
        self.assertAlmostEqual(profiled["waist"]["depth"], 0.26, places=6)
        self.assertGreater(profiled["hip"]["depth"], baseline["hip"]["depth"])
        # Klatka wynika z talii i bioder.
        self.assertAlmostEqual(
            profiled["chest"]["depth"],
            max(0.26 * 1.05, 0.30 * 0.95),
            places=6,
        )

    def test_profile_depths_are_clamped_to_width(self):
        profile = {
            "landmarks": {
                "hip": {"depth_m": 1.5},
                "waist": {"depth_m": 0.02},
            },
        }
        plan = humanoid.build_plan(self.measurements(), depth_profile=profile)
        rings = self.rings(plan)
        hip_width = rings["hip"]["width"]
        waist_width = rings["waist"]["width"]
        self.assertLessEqual(rings["hip"]["depth"], hip_width * 1.10 + 1e-9)
        self.assertGreaterEqual(rings["waist"]["depth"], waist_width * 0.40 - 1e-9)

    def test_head_depth_clamped_from_measured_profile(self):
        plan = humanoid.build_plan(self.measurements())
        profile = {"landmarks": {"eye_line": {"depth_m": 1.0}}}
        plan_profiled = humanoid.build_plan(
            self.measurements(), depth_profile=profile
        )
        self.assertGreater(plan_profiled.head_depth, plan.head_depth)
        self.assertLessEqual(
            plan_profiled.head_depth, plan_profiled.head_width * 1.35 + 1e-9
        )

    def test_profile_without_depths_changes_nothing(self):
        baseline = humanoid.build_plan(self.measurements())
        profiled = humanoid.build_plan(
            self.measurements(), depth_profile={"landmarks": {}}
        )
        self.assertEqual(baseline.as_dict(), profiled.as_dict())

    def test_invalid_profile_and_scale_mismatch_fail(self):
        for value in (float("nan"), float("inf"), -1, 0, True):
            with self.subTest(value=value), self.assertRaises(ValueError):
                humanoid.build_plan(self.measurements(), depth_profile={
                    "landmarks": {"hip": {"depth_m": value}}})
        with self.assertRaises(ValueError):
            humanoid.build_plan(self.measurements(), depth_profile={"height_mm": 1800000})

    def test_hints_really_modify_depth_without_modifying_front_dimensions(self):
        hints = {"version": 2, "usable": True, "hint_policy": "lateral-relief-v1",
                 "depth_hints": {"chest": 1.1, "waist": 1.05, "hip": 1.15}}
        baseline = humanoid.build_plan(self.measurements())
        modified = humanoid.build_plan(self.measurements(), depth_hints=hints)
        before, after = self.rings(baseline), self.rings(modified)
        for name in ("chest", "waist", "hip"):
            self.assertAlmostEqual(after[name]["depth"], before[name]["depth"] * hints["depth_hints"][name])
            self.assertEqual(after[name]["width"], before[name]["width"])
            self.assertEqual(after[name]["z"], before[name]["z"])

    def test_legacy_rejected_or_unbounded_hints_never_apply(self):
        for hints in ({"version": 1, "usable": True}, {"version": 2, "usable": False},
                      {"version": 2, "usable": True, "hint_policy": "lateral-relief-v1",
                       "depth_hints": {"chest": 2, "waist": 1, "hip": 1}}):
            with self.subTest(hints=hints), self.assertRaises(ValueError):
                humanoid.build_plan(self.measurements(), depth_hints=hints)
        with self.assertRaises(ValueError):
            humanoid.build_plan(self.measurements(), depth_profile={}, depth_hints={})


if __name__ == "__main__":
    unittest.main()
