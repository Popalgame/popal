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


class ManualIndexTests(unittest.TestCase):
    PAGE = (
        "# Weight Paint — Editing\n\n"
        "URL: https://docs.blender.org/manual/en/5.2/sculpt_paint/weight_paint/editing.html\n"
        "Source: Blender 5.2 Manual (CC-BY-SA; blender.org)\n\n"
        "Normalize All\n\n"
        "For each vertex, this tool makes sure that the sum of the weights "
        "across all vertex groups is equal to 1.\n"
    )

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.directory = Path(self.temporary.name)
        self.manual = self.directory / "manual"
        self.manual.mkdir()
        (self.manual / "weight-paint-editing.md").write_text(
            self.PAGE, encoding="utf-8"
        )
        self.db = self.directory / "api.sqlite"

    def tearDown(self):
        self.temporary.cleanup()

    def test_parse_manual_file_reads_title_url_body(self):
        page = blender_api.parse_manual_file(
            self.manual / "weight-paint-editing.md"
        )
        self.assertEqual(page["title"], "Weight Paint — Editing")
        self.assertIn("editing.html", page["url"])
        self.assertIn("Normalize All", page["body"])

    def test_index_and_search_manual(self):
        result = blender_api.index_manual(self.manual, self.db)
        self.assertEqual(result["pages"], 1)
        self.assertEqual(blender_api.stats(self.db)["manual_pages"], 1)
        results = blender_api.query_manual(self.db, "normalize weights sum")
        self.assertTrue(results)
        self.assertIn("editing.html", results[0]["url"])
        self.assertIn("Normalize", results[0]["snippet"])

    def test_search_without_index_fails(self):
        with self.assertRaises(SystemExit) as raised:
            blender_api.query_manual(self.db, "anything")
        self.assertEqual(raised.exception.code, 1)

    def test_index_missing_directory_fails(self):
        with self.assertRaises(SystemExit) as raised:
            blender_api.index_manual(self.directory / "missing", self.db)
        self.assertEqual(raised.exception.code, 1)

    def test_manual_index_survives_api_build(self):
        records = self.directory / "api.jsonl"
        records.write_text(
            json.dumps(
                {
                    "path": "bpy.types.Mesh",
                    "kind": "type",
                    "name": "Mesh",
                    "description": "Mesh datablock",
                    "signature": "",
                    "version": "5.2.2",
                }
            )
            + "\n",
            encoding="utf-8",
        )
        blender_api.index_manual(self.manual, self.db)
        blender_api.build_index(records, self.db)
        # build tworzy świeżą bazę, więc wymaga ponownego indeksu manuala
        self.assertEqual(blender_api.stats(self.db)["records"], 1)
        blender_api.index_manual(self.manual, self.db)
        self.assertEqual(blender_api.stats(self.db)["manual_pages"], 1)


if __name__ == "__main__":
    unittest.main()
