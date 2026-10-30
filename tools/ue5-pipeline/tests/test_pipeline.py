"""Test pre-import integrity and environment gates without pretending to run UE."""
import copy
import contextlib
import hashlib
import importlib.util
import json
import io
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[3]


def module_at(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


bootstrap = module_at("polpal_bootstrap", ROOT / "unreal/PolpalUE/Content/Python/bootstrap_project.py")
pipeline = module_at("polpal_pipeline", ROOT / "tools/ue5-pipeline/run.py")


class ManifestIntegrityTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.source = json.loads((ROOT / bootstrap.MANIFEST_PATH).read_text())
        # Fixtures check the manifest/hash boundary, not the validity of FBX data.
        for item in self.source["archetypes"]:
            for path, key in ((item["blend"], "blend_sha256"), (item["mesh_fbx"], "mesh_sha256")):
                file = self.root / path
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_bytes(path.encode())
                item[key] = hashlib.sha256(file.read_bytes()).hexdigest()
            for asset in item["animations"] + item["lods"]:
                file = self.root / asset["fbx"]
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_bytes(asset["fbx"].encode())
                asset["sha256"] = hashlib.sha256(file.read_bytes()).hexdigest()
            if item.get("outline_fbx"):
                self.fixture_file(item, "outline_fbx", "outline_sha256")
            for pose in (item.get("aim_offset") or {}).get("poses", []):
                self.fixture_file(pose, "pose_fbx", "sha256")
        for item in self.source.get("environment", []):
            self.fixture_file(item, "mesh_fbx", "sha256")
        if self.source.get("landscape"):
            self.fixture_file(self.source["landscape"], "heightmap_png", "sha256")
        self.write()

    def fixture_file(self, item, key, digest_key):
        file = self.root / item[key]
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_bytes(item[key].encode())
        item[digest_key] = hashlib.sha256(file.read_bytes()).hexdigest()

    def write(self):
        path = self.root / bootstrap.MANIFEST_PATH
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.source))

    def test_complete_manifest_passes_without_importing_unreal(self):
        result = bootstrap.validate_manifest(self.root)
        self.assertEqual(len(result["archetypes"]), 5)
        self.assertEqual(sum(len(item["animations"]) for item in result["archetypes"]), 85)

    def test_tampered_asset_is_rejected_before_import(self):
        (self.root / self.source["archetypes"][0]["mesh_fbx"]).write_bytes(b"tampered")
        with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
            bootstrap.validate_manifest(self.root)

    def test_path_escape_is_rejected(self):
        self.source["archetypes"][0]["mesh_fbx"] = "../outside.fbx"
        self.write()
        with self.assertRaises(ValueError):
            bootstrap.validate_manifest(self.root)

    def test_wrong_scale_contract_is_rejected(self):
        self.source["export_settings"]["global_scale"] = 100
        self.write()
        with self.assertRaisesRegex(ValueError, "export setting"):
            bootstrap.validate_manifest(self.root)

    def test_duplicate_archetype_is_rejected(self):
        self.source["archetypes"].append(copy.deepcopy(self.source["archetypes"][0]))
        self.write()
        with self.assertRaisesRegex(ValueError, "Duplicate archetype"):
            bootstrap.validate_manifest(self.root)

    def test_missing_lod_is_rejected(self):
        del self.source["archetypes"][0]["lods"][1]
        self.write()
        with self.assertRaises(ValueError):
            bootstrap.validate_manifest(self.root)

    def test_tampered_aim_pose_is_rejected(self):
        pose = self.source["archetypes"][0]["aim_offset"]["poses"][0]
        (self.root / pose["pose_fbx"]).write_bytes(b"wrong reference pose")
        with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
            bootstrap.validate_manifest(self.root)

    def test_tampered_heightmap_is_rejected(self):
        (self.root / self.source["landscape"]["heightmap_png"]).write_bytes(b"changed terrain")
        with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
            bootstrap.validate_manifest(self.root)


class EngineGateTests(unittest.TestCase):
    def test_sources_without_engine_evidence_cannot_complete_plan(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(pipeline, "PROJECT", Path(directory)), patch.object(pipeline, "source_digest", return_value="current"), contextlib.redirect_stdout(io.StringIO()):
                result = pipeline.status()
        self.assertFalse(result["overall_plan_complete"])
        self.assertIn("engine_build", result["missing"])

    def test_stale_build_evidence_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            project = Path(directory)
            path = project / "Saved/Polpal/build-receipt.json"
            path.parent.mkdir(parents=True)
            path.write_text(json.dumps({"ok": True, "source_sha256": "old"}))
            with patch.object(pipeline, "PROJECT", project), patch.object(pipeline, "source_digest", return_value="current"), contextlib.redirect_stdout(io.StringIO()):
                result = pipeline.status()
        self.assertFalse(result["evidence"]["engine_build"]["verified_current_sources"])
        self.assertFalse(result["overall_plan_complete"])

    def test_missing_engine_does_not_report_success(self):
        with patch.object(pipeline, "find_engine", return_value=None):
            with self.assertRaisesRegex(RuntimeError, "No Unreal stage was run"):
                pipeline.require_engine(None)

    def test_explicit_missing_engine_does_not_fall_back(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.dict(os.environ, {"UE_ROOT": "/some-other-engine"}):
                self.assertIsNone(pipeline.find_engine(directory))

    def test_wrong_engine_version_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            file = root / "Engine/Build/Build.version"
            file.parent.mkdir(parents=True)
            file.write_text(json.dumps({"MajorVersion": 5, "MinorVersion": 3}))
            with self.assertRaisesRegex(RuntimeError, "targets UE 5.8"):
                pipeline.require_engine(directory)


class EditorOwnershipTests(unittest.TestCase):
    def test_changed_editor_source_requires_explicit_force(self):
        registry = {"editor_assets": ["/Game/Core/AI/BT_Pal"], "editor_source_fingerprint": "old"}
        with self.assertRaisesRegex(RuntimeError, "source changed"):
            bootstrap._check_editor_source_revision(registry, "new", False)
        bootstrap._check_editor_source_revision(registry, "new", True)

    def test_unowned_registry_entry_prevents_all_deletions(self):
        deleted = []
        class Library:
            @staticmethod
            def does_asset_exist(path):
                return True
            @staticmethod
            def delete_asset(path):
                deleted.append(path)
                return True
        owned = "/Game/Core/Maps/L_Prototype"
        manual = "/Game/Characters/Pals/manual/ABP_HandAuthored"
        with self.assertRaisesRegex(RuntimeError, "unowned"):
            bootstrap._remove_owned_editor_assets(Library, {owned, manual}, {owned}, lambda: None)
        self.assertEqual(deleted, [])


if __name__ == "__main__":
    unittest.main()
