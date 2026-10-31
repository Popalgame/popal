"""Sprawdź analizę kanałów GLB bez uruchamiania Blendera."""

import importlib.util
from pathlib import Path
import struct
import sys
import types
import unittest
from unittest import mock

spec = importlib.util.spec_from_file_location(
    "verify_glb", Path(__file__).resolve().parents[1] / "verify_glb.py")
verify = importlib.util.module_from_spec(spec)
with mock.patch.dict(sys.modules, {"bpy": types.ModuleType("bpy"),
                                  "mathutils": types.SimpleNamespace(Vector=object)}):
    spec.loader.exec_module(verify)


class MotionTests(unittest.TestCase):
    def fixture(self, moving):
        document = {
            "animations": [{"name": "jump", "channels": [{"sampler": 0}],
                            "samplers": [{"output": 0}]}],
            "accessors": [{"componentType": 5126, "type": "VEC3", "count": 2, "bufferView": 0}],
            "bufferViews": [{"byteOffset": 0}],
        }
        binary = struct.pack("<6f", 0, 0, 0, 0, .22 if moving else 0, 0)
        return document, binary

    def test_name_alone_is_not_proof_of_animation(self):
        document, payload = self.fixture(False)
        self.assertEqual(verify.moving_channel_counts(document, payload, 0)["jump"]["moving"], 0)

    def test_binary_translation_varies(self):
        document, payload = self.fixture(True)
        self.assertEqual(verify.moving_channel_counts(document, payload, 0)["jump"]["moving"], 1)

    def test_negative_and_nan_weights_are_not_filtered_away(self):
        mesh = types.SimpleNamespace(vertices=[types.SimpleNamespace(groups=[
            types.SimpleNamespace(weight=1.2), types.SimpleNamespace(weight=-.2)])])
        self.assertEqual(verify.max_influences(mesh)["vertices_negative_weight"], 1)
        mesh.vertices[0].groups[0].weight = float("nan")
        self.assertEqual(verify.max_influences(mesh)["vertices_bad_weight_sum"], 1)


if __name__ == "__main__":
    unittest.main()
