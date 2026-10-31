"""Testy skanera postaci: wyłącznie syntetyczne sylwetki, bez modeli i sieci."""

import contextlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest

import numpy as np
from PIL import Image, ImageDraw


MODULE = Path(__file__).resolve().parents[1] / "scan.py"
spec = importlib.util.spec_from_file_location("character_scan", MODULE)
scan = importlib.util.module_from_spec(spec)
sys.modules["character_scan"] = scan
spec.loader.exec_module(scan)

WIDTH, HEIGHT = 240, 320
TOP, BOTTOM = 30, 300
HEIGHT_PX = BOTTOM - TOP + 1


def silhouette() -> Image.Image:
    """Prosta, symetryczna postać: głowa, tors, biodra, ręce i dwie nogi."""
    image = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    color = (200, 80, 60, 255)
    draw.ellipse([80, TOP, 160, 110], fill=color)  # głowa
    draw.rectangle([80, 100, 160, 169], fill=color)  # tors
    draw.rectangle([65, 170, 175, 189], fill=color)  # biodra
    draw.rectangle([20, 120, 220, 140], fill=color)  # ręce
    draw.rectangle([60, 190, 115, BOTTOM], fill=color)  # lewa noga
    draw.rectangle([125, 190, 180, BOTTOM], fill=color)  # prawa noga
    return image


def faced_silhouette() -> Image.Image:
    """Sylwetka z twarzą: skóra, różowe włosy i para turkusowych tęczówek."""
    image = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    skin = (238, 196, 172, 255)
    hair = (232, 140, 168, 255)
    jacket = (20, 90, 96, 255)
    shorts = (92, 62, 38, 255)
    draw.ellipse([76, 24, 164, 118], fill=hair)  # włosy wokół głowy
    draw.ellipse([82, 36, 158, 114], fill=skin)  # twarz
    draw.rectangle([82, 100, 158, 150], fill=skin)  # szyja
    draw.rectangle([80, 150, 160, 200], fill=jacket)  # tors
    draw.rectangle([20, 152, 220, 172], fill=jacket)  # ręce
    draw.rectangle([65, 200, 175, 220], fill=shorts)  # biodra
    draw.rectangle([60, 220, 115, BOTTOM], fill=skin)  # lewa noga
    draw.rectangle([125, 220, 180, BOTTOM], fill=skin)  # prawa noga
    draw.ellipse([96, 64, 112, 88], fill=(20, 140, 150, 255))  # lewa tęczówka
    draw.ellipse([128, 64, 144, 88], fill=(20, 140, 150, 255))  # prawa tęczówka
    return image


def save(image: Image.Image, directory: str, name: str) -> Path:
    path = Path(directory) / name
    image.save(path)
    return path


class RowTests(unittest.TestCase):
    def test_row_runs_splits_on_gaps(self):
        row = np.array([0, 1, 1, 0, 0, 1, 1, 0], dtype=bool)
        self.assertEqual(scan.row_runs(row), [(1, 2), (5, 6)])

    def test_row_runs_empty(self):
        self.assertEqual(scan.row_runs(np.zeros(10, dtype=bool)), [])

    def test_median_smooth_keeps_absolute_indexes(self):
        # Regresja: wynik musi mieć pełną wysokość, bo indeksujemy go przez y.
        values = np.zeros(200)
        values[50:150] = 100
        result = scan.median_smooth(values, 50, 149, window=11)
        self.assertEqual(result.shape, values.shape)
        self.assertEqual(result[0], 0)
        self.assertEqual(result[199], 0)
        self.assertEqual(result[100], 100)


class ImageTests(unittest.TestCase):
    def test_transparent_image_uses_alpha(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = save(silhouette(), temporary, "alpha.png")
            rgb, mask, mode = scan.load_image(path)
        self.assertEqual(mode, "alpha")
        self.assertEqual(rgb.shape, (HEIGHT, WIDTH, 3))
        self.assertTrue(mask[TOP, 120])
        self.assertFalse(mask[0, 0])

    def test_opaque_rgba_falls_back_to_background(self):
        # Render zapisany jako RGBA, ale bez przezroczystości, ma użyć tła.
        plate = Image.new("RGBA", (WIDTH, HEIGHT), (255, 255, 255, 255))
        plate.alpha_composite(silhouette())
        with tempfile.TemporaryDirectory() as temporary:
            path = save(plate.convert("RGBA"), temporary, "opaque.png")
            _, mask, mode = scan.load_image(path)
        self.assertEqual(mode, "background")
        self.assertTrue(mask[TOP, 120])
        self.assertFalse(mask[0, 0])

    def test_fully_transparent_image_fails(self):
        empty = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
        with tempfile.TemporaryDirectory() as temporary:
            path = save(empty, temporary, "empty.png")
            with contextlib.redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit) as raised:
                    scan.load_image(path)
        self.assertEqual(raised.exception.code, 1)


class MeasureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory()
        cls.path = save(silhouette(), cls.temporary.name, "figure.png")
        cls.data, cls.rgb, cls.mask = scan.measure(cls.path, 1800.0)
        cls.landmarks = {item["name"]: item for item in cls.data["landmarks"]}

    @classmethod
    def tearDownClass(cls):
        cls.temporary.cleanup()

    def test_bbox_and_scale(self):
        character = self.data["character"]
        self.assertEqual(character["bbox_px"], [20, TOP, 220, BOTTOM])
        self.assertEqual(character["height_px"], HEIGHT_PX)
        self.assertEqual(character["axis_x"], 120)
        self.assertFalse(any(character["clipped"].values()))
        self.assertEqual(self.data["scale"]["height_px"], HEIGHT_PX)
        self.assertAlmostEqual(
            self.data["scale"]["mm_per_px"], 1800.0 / HEIGHT_PX, places=4
        )

    def test_landmarks(self):
        arm_span = self.landmarks["arm_span"]
        self.assertGreaterEqual(arm_span["y"], 120)
        self.assertLessEqual(arm_span["y"], 140)
        self.assertEqual(arm_span["width_px"], 201)

        crotch = self.landmarks["crotch"]
        self.assertEqual(crotch["y"], 190)

        waist = self.landmarks["waist"]
        self.assertEqual(waist["width_px"], 81)

        hip = self.landmarks["hip"]
        self.assertGreaterEqual(hip["y"], 170)
        self.assertEqual(hip["width_px"], 111)

        ground = self.landmarks["ground"]
        self.assertEqual(ground["width_px"], 121)

    def test_millimetres_follow_scale(self):
        arm_span = self.landmarks["arm_span"]
        expected = 201 * 1800.0 / HEIGHT_PX
        self.assertAlmostEqual(arm_span["width_mm"], expected, places=1)

    def test_symmetry_is_complete(self):
        self.assertEqual(self.data["symmetry"]["iou_central"], 1.0)

    def test_palette_contains_fill_colour(self):
        self.assertTrue(self.data["palette"])
        self.assertIn("#c8503c", [item["hex"] for item in self.data["palette"]])

    def test_figure_without_eyes_has_no_face_guess(self):
        self.assertIsNone(self.data["face"])

    def test_no_warnings_for_clean_reference(self):
        self.assertEqual(self.data["warnings"], [])

    def test_clipping_is_reported(self):
        image = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        draw.rectangle([0, TOP, WIDTH - 1, BOTTOM], fill=(200, 80, 60, 255))
        with tempfile.TemporaryDirectory() as temporary:
            path = save(image, temporary, "clipped.png")
            data, _, _ = scan.measure(path, 1800.0)
        self.assertTrue(data["character"]["clipped"]["left"])
        self.assertTrue(data["character"]["clipped"]["right"])
        self.assertTrue(any("przycina" in item for item in data["warnings"]))


class FaceTests(unittest.TestCase):
    def test_face_measurements_from_synthetic_eyes(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = save(faced_silhouette(), temporary, "face.png")
            data, _, _ = scan.measure(path, 1800.0)
        face = data["face"]
        self.assertIsNotNone(face)
        self.assertEqual(face["eye_centers_px"], [104, 136])
        self.assertGreaterEqual(face["face_width_px"], 70)
        self.assertLessEqual(face["face_width_px"], 90)
        self.assertGreater(face["face_width_mm"], 400)
        self.assertLess(face["eye_line_y"], face["chin_y"])
        self.assertGreater(face["visible_face_height_px"], 40)
        self.assertAlmostEqual(
            face["eye_line_y_ratio"],
            (face["eye_line_y"] - data["character"]["bbox_px"][1])
            / (data["character"]["height_px"] - 1),
            places=4,
        )

    def test_report_and_overlay_include_face(self):
        with tempfile.TemporaryDirectory() as temporary:
            source = save(faced_silhouette(), temporary, "face.png")
            out = Path(temporary) / "out"
            with contextlib.redirect_stdout(io.StringIO()):
                scan.main(["scan", str(source), "--out", str(out)])
            report = (out / "report.md").read_text(encoding="utf-8")
            document = json.loads((out / "measurements.json").read_text())
        self.assertIn("## Twarz", report)
        self.assertIn("face_width_mm", document["face"])


class CommandTests(unittest.TestCase):
    def test_scan_writes_report_and_overlay(self):
        with tempfile.TemporaryDirectory() as temporary:
            source = save(silhouette(), temporary, "figure.png")
            out = Path(temporary) / "out"
            with contextlib.redirect_stdout(io.StringIO()):
                code = scan.main(
                    ["scan", str(source), "--out", str(out), "--height-mm", "1800"]
                )
            self.assertEqual(code, 0)
            self.assertTrue((out / "measurements.json").is_file())
            self.assertTrue((out / "width-profile.csv").is_file())
            self.assertTrue((out / "overlay.png").is_file())
            self.assertTrue((out / "report.md").is_file())
            document = json.loads((out / "measurements.json").read_text())
            self.assertEqual(document["tool"], "character-scan")

    def test_compare_identical_images_is_perfect(self):
        with tempfile.TemporaryDirectory() as temporary:
            source = save(silhouette(), temporary, "figure.png")
            out = Path(temporary) / "compare"
            with contextlib.redirect_stdout(io.StringIO()):
                code = scan.main(
                    ["compare", str(source), str(source), "--out", str(out)]
                )
            self.assertEqual(code, 0)
            result = json.loads((out / "compare.json").read_text())
            self.assertEqual(result["silhouette_iou"], 1.0)
            self.assertEqual(result["height_ratio"], 1.0)
            for row in result["width_at_fraction"]:
                self.assertEqual(row["delta"], 0.0)
            self.assertTrue((out / "compare.png").is_file())

    def test_compare_detects_scaled_candidate(self):
        with tempfile.TemporaryDirectory() as temporary:
            source = save(silhouette(), temporary, "figure.png")
            smaller = silhouette().resize((WIDTH // 2, HEIGHT // 2))
            candidate = save(smaller, temporary, "smaller.png")
            out = Path(temporary) / "compare"
            with contextlib.redirect_stdout(io.StringIO()):
                scan.main(["compare", str(source), str(candidate), "--out", str(out)])
            result = json.loads((out / "compare.json").read_text())
            # Porównanie normalizuje wysokość, więc mniejszy obraz ma nadal
            # pełne dopasowanie sylwetki (z dokładnością do rasteryzacji).
            self.assertGreater(result["silhouette_iou"], 0.9)
            self.assertAlmostEqual(result["height_ratio"], 0.5, places=2)


if __name__ == "__main__":
    unittest.main()
