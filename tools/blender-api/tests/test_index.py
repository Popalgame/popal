"""Testy indeksu API: wyłącznie syntetyczne rekordy, bez Blendera i sieci."""

import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest


MODULE = Path(__file__).resolve().parents[1] / "blender_api.py"
spec = importlib.util.spec_from_file_location("blender_api", MODULE)
blender_api = importlib.util.module_from_spec(spec)
sys.modules["blender_api"] = blender_api
spec.loader.exec_module(blender_api)


def record(path, kind, name, description="", signature="", body=None, **extra):
    item = {
        "path": path,
        "kind": kind,
        "name": name,
        "description": description,
        "signature": signature,
        "version": "5.2.2",
    }
    item.update(extra)
    item["body"] = body if body is not None else description
    return item


RECORDS = [
    record(
        "bpy.types.BevelModifier",
        "type",
        "BevelModifier",
        "Bevel modifier to make edges and vertices more rounded",
        properties=[{"identifier": "width", "description": "Bevel amount"}],
    ),
    record(
        "bpy.types.BevelModifier.width",
        "property",
        "width",
        "Bevel amount",
        owner="bpy.types.BevelModifier",
    ),
    record(
        "bpy.ops.mesh.primitive_cube_add",
        "operator",
        "primitive_cube_add",
        "Construct a cube mesh that consists of six square faces",
        "(size, location, rotation)",
        parameters=[{"identifier": "size", "description": "Size of the cube"}],
    ),
    record(
        "bpy.types.ShaderNodeBsdfPrincipled",
        "type",
        "ShaderNodeBsdfPrincipled",
        "Physically-based surface shader",
    ),
]


class IndexTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.directory = Path(self.temporary.name)
        self.input = self.directory / "api.jsonl"
        self.db = self.directory / "api.sqlite"
        self.input.write_text(
            "\n".join(json.dumps(item) for item in RECORDS) + "\n", encoding="utf-8"
        )

    def tearDown(self):
        self.temporary.cleanup()

    def build(self):
        return blender_api.build_index(self.input, self.db)

    def test_alias_tokens_split_camel_case_and_paths(self):
        self.assertEqual(
            blender_api.alias_tokens("ShaderNodeBsdfPrincipled"),
            "Shader Node Bsdf Principled",
        )
        self.assertEqual(
            blender_api.alias_tokens("bpy.ops.mesh.primitive_cube_add"),
            "bpy ops mesh primitive cube add",
        )

    def test_build_and_stats(self):
        result = self.build()
        self.assertEqual(result["records"], len(RECORDS))
        stats = blender_api.stats(self.db)
        self.assertEqual(stats["records"], len(RECORDS))
        self.assertEqual(stats["kinds"]["operator"], 1)
        self.assertEqual(stats["kinds"]["property"], 1)
        self.assertEqual(stats["versions"], ["5.2.2"])

    def test_query_finds_description(self):
        self.build()
        results = blender_api.query_index(self.db, "rounded edges")
        self.assertTrue(results)
        self.assertEqual(results[0]["path"], "bpy.types.BevelModifier")

    def test_query_finds_camel_case_name(self):
        self.build()
        results = blender_api.query_index(self.db, "principled")
        self.assertIn(
            "bpy.types.ShaderNodeBsdfPrincipled", [item["path"] for item in results]
        )

    def test_query_filters_kind(self):
        self.build()
        results = blender_api.query_index(self.db, "bevel", kind="property")
        self.assertEqual([item["path"] for item in results], ["bpy.types.BevelModifier.width"])

    def test_query_prefers_prefix(self):
        self.build()
        results = blender_api.query_index(self.db, "primitive_cube", limit=5)
        self.assertEqual(results[0]["path"], "bpy.ops.mesh.primitive_cube_add")

    def test_show_exact_and_suffix(self):
        self.build()
        exact = blender_api.show_record(self.db, "bpy.types.BevelModifier.width")
        self.assertEqual(exact["name"], "width")
        suffix = blender_api.show_record(self.db, "BevelModifier.width")
        self.assertEqual(suffix["path"], "bpy.types.BevelModifier.width")
        self.assertIsNone(blender_api.show_record(self.db, "does.not.exist"))

    def test_rebuild_replaces_previous_records(self):
        self.build()
        smaller = self.directory / "smaller.jsonl"
        smaller.write_text(json.dumps(RECORDS[0]) + "\n", encoding="utf-8")
        blender_api.build_index(smaller, self.db)
        self.assertEqual(blender_api.stats(self.db)["records"], 1)
        self.assertIsNone(blender_api.show_record(self.db, "bpy.ops.mesh.primitive_cube_add"))

    def test_missing_input_fails(self):
        with self.assertRaises(SystemExit) as raised:
            blender_api.build_index(self.directory / "missing.jsonl", self.db)
        self.assertEqual(raised.exception.code, 1)


if __name__ == "__main__":
    unittest.main()
