"""Regresje tensora ONNX, maskowania i jawnej heurystyki — bez sieci/GPU."""

import importlib.util
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest import mock

import numpy as np
from PIL import Image

MODULE = Path(__file__).resolve().parents[1] / "depth_estimation.py"
spec = importlib.util.spec_from_file_location("depth_estimation", MODULE)
depth = importlib.util.module_from_spec(spec)
spec.loader.exec_module(depth)


class OutputTests(unittest.TestCase):
    def test_bhw_keeps_both_spatial_axes(self):
        field = np.arange(24, dtype=np.float32).reshape(4, 6)
        np.testing.assert_array_equal(depth.output_field(field[None]), field)

    def test_bchw_keeps_both_spatial_axes(self):
        field = np.arange(24, dtype=np.float32).reshape(4, 6)
        np.testing.assert_array_equal(depth.output_field(field[None, None]), field)

    def test_rejects_batch_channels_nan_and_flattened_arrays(self):
        for shape in ((2, 4, 6), (1, 3, 4, 6), (1, 6), (1, 1, 6)):
            with self.subTest(shape=shape), self.assertRaises(ValueError):
                depth.output_field(np.zeros(shape))
        with self.assertRaises(ValueError):
            depth.output_field(np.full((1, 4, 6), np.nan))

    def test_preprocessing_preserves_aspect_ratio_and_multiple_of_14(self):
        tensor = depth.prepare_input(np.zeros((2240, 1120, 3), dtype=np.uint8))
        self.assertEqual(tensor.shape, (1, 3, 1036, 518))
        self.assertEqual(tensor.dtype, np.float32)

    def test_inference_preserves_lateral_detail_not_just_a_row(self):
        class Session:
            def __init__(self, *args, **kwargs):
                pass

            def get_inputs(self):
                return [types.SimpleNamespace(name="pixel_values")]

            def run(self, *args):
                # Każdy wiersz jest inny, również w obrębie tego wiersza.
                return [np.arange(24, dtype=np.float32).reshape(1, 4, 6)]

        with mock.patch.dict(sys.modules, {"onnxruntime": types.SimpleNamespace(InferenceSession=Session)}):
            restored, shapes = depth.run_depth(np.zeros((8, 12, 3), dtype=np.uint8), Path("unused"))
        self.assertEqual(restored.shape, (8, 12))
        self.assertEqual(shapes["output_shape"], [1, 4, 6])
        self.assertGreater(float(restored[:, 5].std()), 1)
        self.assertGreater(float(restored[4].std()), 1)


class MaskAndQualityTests(unittest.TestCase):
    def fixture(self):
        mask = np.zeros((240, 160), dtype=bool)
        mask[10:230, 40:120] = True
        field = np.zeros(mask.shape, dtype=np.float32)
        x = np.linspace(-1, 1, 80)
        field[10:230, 40:120] = 1 - x**2
        return field, mask

    def test_band_statistics_exclude_background(self):
        field, mask = self.fixture()
        first = depth.band_statistics(field, mask)
        field[~mask] = 10000
        second = depth.band_statistics(field, mask)
        self.assertEqual(first, second)
        self.assertGreater(first["waist"]["samples"], 0)

    def test_monocular_depth_is_not_automatically_geometry(self):
        field, mask = self.fixture()
        report = depth.assess_depth(field, mask)
        self.assertTrue(report["technical_usable"])
        self.assertFalse(report["usable"])
        self.assertIsNone(report["depth_hints"])

    def test_explicit_relief_policy_has_bounded_multipliers(self):
        field, mask = self.fixture()
        report = depth.assess_depth(field, mask, derive_hints=True)
        self.assertTrue(report["usable"])
        self.assertEqual(report["hint_policy"], "lateral-relief-v1")
        self.assertTrue(all(1 <= value <= 1.15 for value in report["depth_hints"].values()))

    def test_pure_vertical_gradient_is_rejected_without_tuning_to_aiko(self):
        _, mask = self.fixture()
        field = np.broadcast_to(np.arange(240)[:, None], mask.shape).astype(float)
        report = depth.assess_depth(field, mask, derive_hints=True)
        self.assertFalse(report["usable"])
        self.assertIsNone(report["depth_hints"])

    def test_constant_depth_and_empty_mask_are_rejected(self):
        _, mask = self.fixture()
        report = depth.assess_depth(np.ones(mask.shape), mask, derive_hints=True)
        self.assertFalse(report["usable"])
        with self.assertRaises(ValueError):
            depth.band_statistics(np.ones(mask.shape), np.zeros_like(mask))

    def test_transparent_source_uses_alpha_and_neutral_background(self):
        rgba = np.zeros((20, 20, 4), dtype=np.uint8)
        rgba[5:15, 5:15] = (255, 20, 20, 255)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "source.png"
            Image.fromarray(rgba).save(path)
            rgb, mask = depth.load_source(path)
        self.assertEqual(int(mask.sum()), 100)
        np.testing.assert_array_equal(rgb[0, 0], [128, 128, 128])


if __name__ == "__main__":
    unittest.main()
