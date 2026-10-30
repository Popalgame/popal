"""UE 5.8 editor bootstrap. Also supports CPython --check-manifest without Unreal.

Only assets listed in Saved/Polpal/bootstrap-generated.json may be replaced by
--force. Ownership is recorded as soon as an asset exists; input hashes and LOD
checkpoints are recorded only after successful saves. Native editor assets are
tracked separately and rebuilt when editor source changes under --force.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import traceback


MANIFEST_PATH = Path("tools/ue5-pipeline/manifests/pipeline.json")
IDENT = re.compile(r"^[A-Za-z][A-Za-z0-9_]*$")
SHA = re.compile(r"^[0-9a-f]{64}$")
REQUIRED_EXPORT = {
    "axis_forward": "-Y", "axis_up": "Z", "global_scale": 1.0,
    "apply_unit_scale": True, "add_leaf_bones": False,
    "use_armature_deform_only": False, "apply_scale_options": "FBX_SCALE_UNITS",
    "unreal_import_uniform_scale": 1.0, "unreal_convert_scene_unit": True,
}
ELEMENTS = {"Neutral", "Fire", "Water", "Grass", "Electric", "Ice", "Ground", "Dark", "Dragon"}
PALETTE = {
    "Fire": (.95, .23, .08), "Water": (.09, .62, .90), "Electric": (.98, .73, .10),
    "Grass": (.24, .72, .25), "Ice": (.65, .89, .96), "Ground": (.42, .28, .12),
    "Neutral": (.65, .65, .65), "Dark": (.22, .17, .35), "Dragon": (.64, .28, .62),
    "Air": (.38, .72, .84),
}
MATERIAL_RECIPE = "pal-toon-v2-skeletal-usage"
OUTLINE_RECIPE = "pal-outline-v1-reversed-hull-vertex-g"
SPECIES_PROFILE = "prototype-work-v1:Handiwork1;FireKindling2;WaterWatering2;GroundMining2;AirTransporting2;ElectricHandiwork2"


def repo_root() -> Path:
    if os.environ.get("POLPAL_REPO_ROOT"):
        return Path(os.environ["POLPAL_REPO_ROOT"]).expanduser().resolve()
    return Path(__file__).resolve().parents[4]


def checked_file(root: Path, relative: str, digest: str) -> Path:
    root = root.resolve()
    if not isinstance(relative, str) or not relative or Path(relative).is_absolute() or "\\" in relative:
        raise ValueError(f"Invalid repository-relative path: {relative!r}")
    path = (root / relative).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise ValueError(f"Missing or escaping file: {relative}")
    if not isinstance(digest, str) or not SHA.fullmatch(digest):
        raise ValueError(f"Invalid SHA-256 for {relative}")
    actual = hashlib.sha256(path.read_bytes()).hexdigest()
    if actual != digest:
        raise ValueError(f"SHA-256 mismatch for {relative}: {actual}")
    return path


def validate_manifest(root: Path) -> dict:
    manifest = json.loads((root / MANIFEST_PATH).read_text(encoding="utf-8"))
    if manifest.get("schema_version") != 1:
        raise ValueError("Expected pipeline schema_version 1")
    settings = manifest.get("export_settings")
    if not isinstance(settings, dict):
        raise ValueError("Missing export_settings")
    for key, value in REQUIRED_EXPORT.items():
        if settings.get(key) != value:
            raise ValueError(f"Unsupported export setting {key}: {settings.get(key)!r}")
    archetypes = manifest.get("archetypes")
    if not isinstance(archetypes, list) or not archetypes:
        raise ValueError("Manifest has no archetypes")
    seen = set()
    for item in archetypes:
        ident = item.get("id")
        name = item.get("asset_name")
        if not all(isinstance(x, str) and IDENT.fullmatch(x) for x in (ident, name)):
            raise ValueError(f"Invalid archetype id/name: {ident!r}/{name!r}")
        if ident in seen:
            raise ValueError(f"Duplicate archetype id: {ident}")
        seen.add(ident)
        if item.get("prototype") is not True or item.get("rig") != name:
            raise ValueError(f"Invalid prototype/rig for {ident}")
        bones = item.get("bones")
        if not isinstance(bones, list) or len(bones) != len(set(bones)) or not {"root", "pelvis"}.issubset(bones):
            raise ValueError(f"Invalid root/pelvis bones for {ident}")
        chains = item.get("retarget_chains")
        if not isinstance(chains, dict) or not chains:
            raise ValueError(f"Missing retarget chains for {ident}")
        for chain, endpoints in chains.items():
            if not IDENT.fullmatch(chain) or not isinstance(endpoints, list) or len(endpoints) != 2 or any(b not in bones for b in endpoints):
                raise ValueError(f"Invalid chain {chain} for {ident}")
        if item.get("element") not in PALETTE and item.get("element") != "Earth":
            raise ValueError(f"Missing element for {ident}")
        checked_file(root, item["blend"], item["blend_sha256"])
        checked_file(root, item["mesh_fbx"], item["mesh_sha256"])
        if "outline_fbx" in item:
            checked_file(root, item["outline_fbx"], item["outline_sha256"])
        animations = item.get("animations")
        if not isinstance(animations, list) or not animations:
            raise ValueError(f"No animations for {ident}")
        clips = set()
        for clip in animations:
            if not isinstance(clip.get("name"), str) or not IDENT.fullmatch(clip["name"]) or clip["name"] in clips:
                raise ValueError(f"Duplicate/invalid clip for {ident}")
            clips.add(clip["name"])
            if clip.get("fps", 0) <= 0 or not isinstance(clip.get("frames"), list) or len(clip["frames"]) != 2 or clip["frames"][1] <= clip["frames"][0] or not isinstance(clip.get("loop"), bool):
                raise ValueError(f"Invalid timing for {ident}/{clip['name']}")
            checked_file(root, clip["fbx"], clip["sha256"])
        levels = set()
        for lod in item.get("lods", []):
            level = lod.get("level")
            if not isinstance(level, int) or level < 0 or level in levels:
                raise ValueError(f"Invalid LOD level for {ident}")
            levels.add(level)
            checked_file(root, lod["fbx"], lod["sha256"])
        if levels and levels != set(range(max(levels) + 1)):
            raise ValueError(f"Non-contiguous LOD levels for {ident}")
        aim = item.get("aim_offset")
        if aim:
            if aim.get("additive_ref") != {"animation": "Idle", "frame": 1}:
                raise ValueError(f"Unsupported aim reference for {ident}")
            poses = aim.get("poses", [])
            if not isinstance(poses, list) or len(poses) != 9:
                raise ValueError(f"Aim offset poses missing for {ident}")
            for pose in poses:
                if (not IDENT.fullmatch(pose["name"]) or pose.get("frames") != [1, 2]
                    or not isinstance(pose.get("yaw"), (int, float))
                    or not isinstance(pose.get("pitch"), (int, float))):
                    raise ValueError(f"Invalid aim pose for {ident}")
                checked_file(root, pose["pose_fbx"], pose["sha256"])
    for environment in manifest.get("environment", []):
        if not IDENT.fullmatch(environment["name"]) or environment.get("prototype") is not True:
            raise ValueError("Invalid environment asset")
        checked_file(root, environment["mesh_fbx"], environment["sha256"])
    landscape = manifest.get("landscape")
    if landscape:
        if landscape.get("resolution") != [505, 505] or landscape.get("format") != "PNG_G16":
            raise ValueError("Unsupported landscape heightmap")
        checked_file(root, landscape["heightmap_png"], landscape["sha256"])
    return manifest


def _report_path(root: Path) -> Path:
    path = root / "unreal/PolpalUE/Saved/Polpal/bootstrap-report.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def _write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _class(asset, cls) -> bool:
    return asset is not None and isinstance(asset, cls)


def _fingerprint(value) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode("utf-8")).hexdigest()


def _editor_source_fingerprint(root: Path) -> str:
    """Hash all UE source plus this editor bootstrap, in stable repository path order."""
    source = root / "unreal/PolpalUE/Source"
    bootstrap = root / "unreal/PolpalUE/Content/Python/bootstrap_project.py"
    if not source.is_dir() or not bootstrap.is_file():
        raise FileNotFoundError("UE Source or bootstrap_project.py is missing")
    paths = sorted((path for path in source.rglob("*") if path.is_file()),
                   key=lambda path: path.relative_to(root).as_posix())
    paths.append(bootstrap)
    digest = hashlib.sha256()
    for path in paths:
        relative = path.relative_to(root).as_posix().encode("utf-8")
        digest.update(len(relative).to_bytes(4, "big"))
        digest.update(relative)
        with path.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
    return digest.hexdigest()


def _check_editor_source_revision(registry: dict, source_hash: str, force: bool) -> None:
    if registry.get("editor_assets") and registry.get("editor_source_fingerprint") != source_hash and not force:
        raise RuntimeError("UE editor source changed since generated editor assets were created; rerun with --force")


def _editor_asset_priority(path: str) -> tuple[int, str]:
    name = path.rsplit("/", 1)[-1]
    if path == "/Game/Core/Maps/L_Prototype":
        return (0, path)
    if name.startswith("ABP_"):
        return (1, path)
    if name.startswith("BT_"):
        return (2, path)
    return (3, path)


def _editor_asset_path(path: str) -> bool:
    name = path.rsplit("/", 1)[-1]
    return (path == "/Game/Core/Maps/L_Prototype" or
            (path.startswith("/Game/Characters/Pals/") and name.startswith(("ABP_", "BS_", "AM_", "AO_"))) or
            (path.startswith("/Game/Core/AI/") and name.startswith(("BB_", "BT_", "EQS_"))))


def _remove_owned_editor_assets(lib, editor_assets: set[str], generated: set[str], persist) -> None:
    for path in editor_assets:
        if not _editor_asset_path(path) or path not in generated:
            raise RuntimeError(f"Invalid or unowned editor asset registry entry: {path}")
    for path in sorted(editor_assets, key=_editor_asset_priority):
        if lib.does_asset_exist(path) and not lib.delete_asset(path):
            raise RuntimeError(f"Could not delete generated editor asset: {path}")
        editor_assets.remove(path)
        generated.remove(path)
        persist()


def run_editor(root: Path, manifest: dict, force: bool) -> dict:
    import unreal  # Deliberately after full manifest/hash validation.

    report = {"ok": False, "status": "running", "ue_runtime_verified": False,
              "manifest": MANIFEST_PATH.as_posix(), "created": [],
              "skipped": [], "pending": [], "failed": []}
    registry_path = root / "unreal/PolpalUE/Saved/Polpal/bootstrap-generated.json"
    registry = json.loads(registry_path.read_text(encoding="utf-8")) if registry_path.exists() else {"assets": [], "inputs": {}, "lods": {}}
    generated = set(registry.get("assets", []))
    editor_assets = set(registry.get("editor_assets", []))
    editor_source_hash = _editor_source_fingerprint(root)
    _check_editor_source_revision(registry, editor_source_hash, force)
    manifest_hash = _fingerprint(manifest)
    if generated and registry.get("manifest_hash") != manifest_hash and not force:
        raise RuntimeError("Manifest changed since generated assets were created; rerun with --force")
    registry["manifest_hash"] = manifest_hash
    inputs = registry.setdefault("inputs", {})
    completed_lods = registry.setdefault("lods", {})
    lib = unreal.EditorAssetLibrary
    tools = unreal.AssetToolsHelpers.get_asset_tools()

    def persist():
        registry["assets"] = sorted(generated)
        registry["editor_assets"] = sorted(editor_assets)
        _write_json(registry_path, registry)

    def claim(path):
        generated.add(path)
        persist()

    def save(path, asset, source_hash=None):
        if asset is None or not lib.save_loaded_asset(asset):
            raise RuntimeError(f"Could not save {path}")
        generated.add(path)
        if source_hash is not None:
            inputs[path] = source_hash
        persist()
        report["created"].append(path)

    def can_create(path, source_hash=None):
        if not lib.does_asset_exist(path):
            return True
        if path in generated:
            if force:
                return True
            if source_hash is not None and inputs.get(path) != source_hash:
                raise RuntimeError(f"Generated asset {path} has changed or unrecorded source; rerun with --force")
        report["skipped"].append({"asset": path, "reason": "existing asset preserved"})
        return False

    def load_typed(path, cls):
        asset = lib.load_asset(path)
        if not _class(asset, cls):
            raise RuntimeError(f"Expected {cls.__name__} at {path}, got {asset}")
        return asset

    def import_fbx(file, path, digest, options, cls):
        if not can_create(path, digest):
            return load_typed(path, cls), False
        checked_file(root, file.relative_to(root).as_posix(), digest)
        task = unreal.AssetImportTask()
        task.set_editor_property("filename", str(file))
        task.set_editor_property("destination_path", path.rsplit("/", 1)[0])
        task.set_editor_property("destination_name", path.rsplit("/", 1)[1])
        task.set_editor_property("options", options)
        task.set_editor_property("automated", True)
        task.set_editor_property("save", True)
        task.set_editor_property("replace_existing", force and path in generated)
        tools.import_asset_tasks([task])
        imported = list(task.get_editor_property("imported_object_paths"))
        if not imported or not lib.does_asset_exist(path):
            raise RuntimeError(f"FBX import failed for {file}: {imported}")
        claim(path)
        asset = load_typed(path, cls)
        save(path, asset, digest)
        return asset, True

    def configure_fbx_data(data, settings):
        if data is None:
            raise RuntimeError("FBX import data is unavailable")
        for key, value in (("import_uniform_scale", settings["unreal_import_uniform_scale"]),
                           ("convert_scene", True),
                           ("convert_scene_unit", settings["unreal_convert_scene_unit"]),
                           ("force_front_x_axis", False)):
            data.set_editor_property(key, value)

    def create_toon_material():
        path = "/Game/Materials/M_PalToon"
        if not can_create(path, MATERIAL_RECIPE):
            return load_typed(path, unreal.Material)
        if lib.does_asset_exist(path) and not lib.delete_asset(path):
            raise RuntimeError(f"Could not replace generated material {path}")
        material = tools.create_asset("M_PalToon", "/Game/Materials", unreal.Material, unreal.MaterialFactoryNew())
        if not _class(material, unreal.Material):
            raise RuntimeError("Toon material creation failed")
        claim(path)
        material.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_UNLIT)
        mel = unreal.MaterialEditingLibrary

        def node(cls, x, y):
            result = mel.create_material_expression(material, cls, x, y)
            if result is None:
                raise RuntimeError(f"Cannot create material node {cls.__name__}")
            return result

        def scalar(name, value, x, y):
            n = node(unreal.MaterialExpressionScalarParameter, x, y)
            n.set_editor_property("parameter_name", name)
            n.set_editor_property("default_value", float(value))
            return n

        def connect(source, output, target, input_name):
            names = list(mel.get_material_expression_input_names(target))
            normalize = lambda value: re.sub(r"[^a-z0-9]", "", value.lower())
            matching = [name for name in names if normalize(name) == normalize(input_name)]
            if not matching and input_name == "VectorInput":
                matching = [name for name in names if normalize(name) == "input"]
            if not matching:
                raise RuntimeError(f"Missing material input {input_name!r}; available: {names}")
            if not mel.connect_material_expressions(source, output, target, matching[0]):
                raise RuntimeError(f"Material connection failed: {input_name}")

        normal = node(unreal.MaterialExpressionPixelNormalWS, -1200, -300)
        light = node(unreal.MaterialExpressionVectorParameter, -1200, -100)
        light.set_editor_property("parameter_name", "LightDirection")
        light.set_editor_property("default_value", unreal.LinearColor(0.4, 0.4, 0.82, 0))
        normalized = node(unreal.MaterialExpressionNormalize, -1000, -100)
        connect(light, "RGB", normalized, "VectorInput")
        dot = node(unreal.MaterialExpressionDotProduct, -800, -250)
        connect(normal, "", dot, "A")
        connect(normalized, "", dot, "B")
        low_threshold = scalar("Threshold1", .35, -800, 80)
        high_threshold = scalar("Threshold2", .70, -800, 250)
        shadow = scalar("ShadowTone", .38, -600, 100)
        mid = scalar("MidTone", .70, -600, 250)
        bright = scalar("LightTone", 1.0, -600, 400)
        low_if = node(unreal.MaterialExpressionIf, -400, -100)
        high_if = node(unreal.MaterialExpressionIf, -180, -100)
        for n, threshold in ((low_if, low_threshold), (high_if, high_threshold)):
            connect(dot, "", n, "A")
            connect(threshold, "", n, "B")
        for pin in ("A > B", "A == B"):
            connect(mid, "", low_if, pin)
            connect(bright, "", high_if, pin)
        connect(shadow, "", low_if, "A < B")
        connect(low_if, "", high_if, "A < B")
        mask = node(unreal.MaterialExpressionVertexColor, -200, 250)
        shade_mask = node(unreal.MaterialExpressionMultiply, 60, -50)
        connect(high_if, "", shade_mask, "A")
        connect(mask, "R", shade_mask, "B")
        color = node(unreal.MaterialExpressionVectorParameter, -200, 480)
        color.set_editor_property("parameter_name", "ElementBaseColor")
        color.set_editor_property("default_value", unreal.LinearColor(.65, .65, .65, 1))
        emission = node(unreal.MaterialExpressionMultiply, 280, 0)
        connect(color, "RGB", emission, "A")
        connect(shade_mask, "", emission, "B")
        if not mel.connect_material_property(emission, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR):
            raise RuntimeError("Could not connect toon emissive output")
        usage_names = [name for name in dir(unreal.MaterialUsage)
                       if re.sub(r"[^a-z0-9]", "", name.lower()).endswith("skeletalmesh")]
        if len(usage_names) != 1:
            raise RuntimeError(f"Cannot identify SkeletalMesh material usage: {usage_names}")
        mel.set_base_material_usage(material, getattr(unreal.MaterialUsage, usage_names[0]), True)
        errors = list(mel.recompile_material(material))
        if errors:
            raise RuntimeError(f"Toon shader compile failed: {errors}")
        save(path, material, MATERIAL_RECIPE)
        return material

    def create_outline_material():
        path = "/Game/Materials/M_PalOutline"
        if not can_create(path, OUTLINE_RECIPE):
            return load_typed(path, unreal.Material)
        if lib.does_asset_exist(path) and not lib.delete_asset(path):
            raise RuntimeError(f"Could not replace generated outline material {path}")
        material = tools.create_asset("M_PalOutline", "/Game/Materials", unreal.Material, unreal.MaterialFactoryNew())
        if not _class(material, unreal.Material):
            raise RuntimeError("Outline material creation failed")
        claim(path)
        material.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_UNLIT)
        material.set_editor_property("two_sided", False)
        mel = unreal.MaterialEditingLibrary
        normal = mel.create_material_expression(material, unreal.MaterialExpressionVertexNormalWS, -600, -200)
        vertex = mel.create_material_expression(material, unreal.MaterialExpressionVertexColor, -600, 100)
        width = mel.create_material_expression(material, unreal.MaterialExpressionScalarParameter, -600, 300)
        width.set_editor_property("parameter_name", "OutlineWidthCm")
        width.set_editor_property("default_value", -0.5)  # Reversed hull normals point inward.
        scaled = mel.create_material_expression(material, unreal.MaterialExpressionMultiply, -350, 100)
        offset = mel.create_material_expression(material, unreal.MaterialExpressionMultiply, -100, -100)
        color = mel.create_material_expression(material, unreal.MaterialExpressionVectorParameter, -100, 250)
        color.set_editor_property("parameter_name", "OutlineColor")
        color.set_editor_property("default_value", unreal.LinearColor(.015, .01, .025, 1))
        for source, output, target, input_name in (
                (vertex, "G", scaled, "A"), (width, "", scaled, "B"),
                (normal, "", offset, "A"), (scaled, "", offset, "B")):
            if not mel.connect_material_expressions(source, output, target, input_name):
                raise RuntimeError(f"Outline material connection failed: {input_name}")
        if not mel.connect_material_property(offset, "", unreal.MaterialProperty.MP_WORLD_POSITION_OFFSET):
            raise RuntimeError("Outline WPO connection failed")
        if not mel.connect_material_property(color, "RGB", unreal.MaterialProperty.MP_EMISSIVE_COLOR):
            raise RuntimeError("Outline color connection failed")
        usage_names = [name for name in dir(unreal.MaterialUsage)
                       if re.sub(r"[^a-z0-9]", "", name.lower()).endswith("skeletalmesh")]
        if len(usage_names) != 1:
            raise RuntimeError(f"Cannot identify SkeletalMesh material usage: {usage_names}")
        mel.set_base_material_usage(material, getattr(unreal.MaterialUsage, usage_names[0]), True)
        errors = list(mel.recompile_material(material))
        if errors:
            raise RuntimeError(f"Outline shader compile failed: {errors}")
        save(path, material, OUTLINE_RECIPE)
        return material

    def material_instance(element, parent):
        canonical = "Ground" if element == "Earth" else element
        path = f"/Game/Materials/MI_PalToon_{canonical}"
        if not can_create(path, MATERIAL_RECIPE):
            return load_typed(path, unreal.MaterialInstanceConstant)
        if lib.does_asset_exist(path) and not lib.delete_asset(path):
            raise RuntimeError(f"Could not replace generated instance {path}")
        factory = unreal.MaterialInstanceConstantFactoryNew()
        factory.set_editor_property("initial_parent", parent)
        inst = tools.create_asset(path.rsplit("/", 1)[1], "/Game/Materials", unreal.MaterialInstanceConstant, factory)
        if not _class(inst, unreal.MaterialInstanceConstant):
            raise RuntimeError(f"Material instance creation failed: {path}")
        claim(path)
        rgb = PALETTE[canonical]
        if not unreal.MaterialEditingLibrary.set_material_instance_vector_parameter_value(
                inst, "ElementBaseColor", unreal.LinearColor(*rgb, 1.0)):
            raise RuntimeError(f"Could not set palette for {path}")
        save(path, inst, MATERIAL_RECIPE)
        return inst

    def assign_material(mesh_path, mesh, instance):
        if mesh_path not in generated:
            return
        slots = list(mesh.get_editor_property("materials"))
        if not slots:
            raise RuntimeError(f"No material slot on {mesh_path}")
        for slot in slots:
            slot.set_editor_property("material_interface", instance)
        mesh.set_editor_property("materials", slots)
        save(mesh_path, mesh, inputs[mesh_path])

    def create_species(spec, mesh, outline_mesh):
        cls = unreal.load_class(None, "/Script/PolpalUE.PalSpeciesData")
        if cls is None:
            report["pending"].append({"stage": "species_assets", "archetype": spec["id"], "reason": "C++ PalSpeciesData class is not registered"})
            return
        path = f"/Game/Characters/Pals/{spec['id']}/DA_{spec['asset_name']}"
        digest = _fingerprint((spec["mesh_sha256"], spec.get("outline_sha256"),
                               spec.get("bounds"), spec["element"], SPECIES_PROFILE))
        if not can_create(path, digest):
            load_typed(path, cls)
            return
        if lib.does_asset_exist(path) and not lib.delete_asset(path):
            raise RuntimeError(f"Could not replace generated species asset {path}")
        factory = unreal.DataAssetFactory()
        factory.set_editor_property("data_asset_class", cls)
        asset = tools.create_asset(path.rsplit("/", 1)[1], path.rsplit("/", 1)[0], cls, factory)
        if not _class(asset, cls):
            raise RuntimeError(f"Species asset creation failed: {path}")
        claim(path)
        canonical = "Ground" if spec["element"] == "Earth" else spec["element"]
        asset.set_editor_property("pal_name", unreal.Text(spec["asset_name"].replace("Rig_", "")))
        asset.set_editor_property("element_type", getattr(unreal.PalElement, canonical.upper()))
        stats = asset.get_editor_property("base_stats")
        for key, value in (("max_health", 100.0), ("attack", 10.0), ("defense", 10.0), ("work_speed", 1.0)):
            stats.set_editor_property(key, value)
        asset.set_editor_property("base_stats", stats)
        levels = {unreal.PalWorkType.HANDIWORK: 1}
        specialty = {
            "Fire": ("KINDLING", 2), "Water": ("WATERING", 2),
            "Ground": ("MINING", 2), "Air": ("TRANSPORTING", 2),
            "Electric": ("HANDIWORK", 2),
        }.get(canonical)
        if specialty:
            levels[getattr(unreal.PalWorkType, specialty[0])] = specialty[1]
        asset.set_editor_property("work_suitability", levels)
        asset.set_editor_property("skeletal_mesh", mesh)
        if outline_mesh is not None:
            asset.set_editor_property("outline_mesh", outline_mesh)
        bounds = spec["bounds"]
        height = (bounds["max_m"][2] - bounds["min_m"][2]) * 100.0
        horizontal = min(bounds["max_m"][axis] - bounds["min_m"][axis] for axis in (0, 1))
        asset.set_editor_property("mesh_height_cm", height)
        asset.set_editor_property("capsule_radius_cm", max(20.0, min(70.0, horizontal * 50.0)))
        asset.set_editor_property("rarity_factor", 1.0)
        # AnimBlueprintClass deliberately stays unset until an actual graph exists.
        save(path, asset, digest)

    for path in ["/Game/Core", "/Game/Characters/Human", "/Game/Characters/Pals",
                 "/Game/Buildings", "/Game/VFX", "/Game/Materials"]:
        if not lib.does_directory_exist(path) and not lib.make_directory(path):
            raise RuntimeError(f"Cannot create directory {path}")

    if manifest.get("environment"):
        environment_folder = "/Game/Buildings/Environment"
        lib.make_directory(environment_folder)
        for entry in manifest["environment"]:
            try:
                ui = unreal.FbxImportUI()
                ui.set_editor_property("automated_import_should_detect_type", False)
                ui.set_editor_property("mesh_type_to_import", unreal.FBXImportType.FBXIT_STATIC_MESH)
                ui.set_editor_property("import_as_skeletal", False)
                ui.set_editor_property("import_mesh", True)
                ui.set_editor_property("import_materials", False)
                ui.set_editor_property("import_textures", False)
                configure_fbx_data(ui.get_editor_property("static_mesh_import_data"), manifest["export_settings"])
                import_fbx(root / entry["mesh_fbx"], f"{environment_folder}/{entry['name']}",
                           entry["sha256"], ui, unreal.StaticMesh)
            except Exception as exc:
                report["failed"].append({"stage": "environment_import", "asset": entry["name"],
                                         "error": str(exc), "traceback": traceback.format_exc()})

    try:
        toon_master = create_toon_material()
    except Exception as exc:
        toon_master = None
        report["failed"].append({"stage": "toon_material", "error": str(exc), "traceback": traceback.format_exc()})
    try:
        outline_master = create_outline_material()
    except Exception as exc:
        outline_master = None
        report["failed"].append({"stage": "outline_material", "error": str(exc), "traceback": traceback.format_exc()})

    for spec in manifest["archetypes"]:
        ident, name = spec["id"], spec["asset_name"]
        folder = f"/Game/Characters/Pals/{ident}"
        lib.make_directory(folder)
        try:
            mesh_path = f"{folder}/SK_{name}"
            ui = unreal.FbxImportUI()
            ui.set_editor_property("automated_import_should_detect_type", False)
            ui.set_editor_property("mesh_type_to_import", unreal.FBXImportType.FBXIT_SKELETAL_MESH)
            ui.set_editor_property("import_as_skeletal", True)
            ui.set_editor_property("import_mesh", True)
            ui.set_editor_property("import_animations", False)
            ui.set_editor_property("import_materials", False)
            ui.set_editor_property("import_textures", False)
            configure_fbx_data(ui.get_editor_property("skeletal_mesh_import_data"), manifest["export_settings"])
            mesh, mesh_changed = import_fbx(root / spec["mesh_fbx"], mesh_path, spec["mesh_sha256"], ui, unreal.SkeletalMesh)
            skeleton = mesh.get_editor_property("skeleton")
            if not _class(skeleton, unreal.Skeleton):
                raise RuntimeError(f"Mesh has no skeleton: {mesh_path}")
            if mesh_changed:
                completed_lods[mesh_path] = {}
                persist()
            if mesh_path in generated:
                # LOD0 is the base mesh. Only owned meshes may be resumed/modified.
                for lod in sorted(spec.get("lods", []), key=lambda x: x["level"]):
                    level = lod["level"]
                    if level == 0:
                        continue
                    level_key = str(level)
                    previous = completed_lods.setdefault(mesh_path, {}).get(level_key)
                    if previous == lod["sha256"]:
                        continue
                    if previous is not None and not force:
                        raise RuntimeError(f"Generated LOD{level} source changed for {mesh_path}; rerun with --force")
                    checked_file(root, lod["fbx"], lod["sha256"])
                    imported_index = unreal.SkeletalMeshEditorSubsystem.import_lod(mesh, level, str(root / lod["fbx"]))
                    if imported_index != level:
                        raise RuntimeError(f"LOD{level} failed for {mesh_path}: {imported_index}")
                    if not lib.save_loaded_asset(mesh):
                        raise RuntimeError(f"LOD{level} save failed for {mesh_path}")
                    completed_lods[mesh_path][level_key] = lod["sha256"]
                    persist()
            if toon_master is not None:
                instance = material_instance(spec["element"], toon_master)
                if mesh_path in generated:
                    assign_material(mesh_path, mesh, instance)
            outline_mesh = None
            if spec.get("outline_fbx"):
                outline_path = f"{folder}/SK_{name}_Outline"
                outline_ui = unreal.FbxImportUI()
                outline_ui.set_editor_property("automated_import_should_detect_type", False)
                outline_ui.set_editor_property("mesh_type_to_import", unreal.FBXImportType.FBXIT_SKELETAL_MESH)
                outline_ui.set_editor_property("import_as_skeletal", True)
                outline_ui.set_editor_property("import_mesh", True)
                outline_ui.set_editor_property("import_animations", False)
                outline_ui.set_editor_property("import_materials", False)
                outline_ui.set_editor_property("import_textures", False)
                outline_ui.set_editor_property("skeleton", skeleton)
                configure_fbx_data(outline_ui.get_editor_property("skeletal_mesh_import_data"), manifest["export_settings"])
                outline_mesh, _ = import_fbx(root / spec["outline_fbx"], outline_path,
                                              spec["outline_sha256"], outline_ui, unreal.SkeletalMesh)
                if outline_mesh.get_editor_property("skeleton") != skeleton:
                    raise RuntimeError(f"Outline skeleton mismatch: {outline_path}")
                if outline_master is not None:
                    assign_material(outline_path, outline_mesh, outline_master)
            for clip in spec["animations"]:
                clip_path = f"{folder}/A_{name}_{clip['name']}"
                anim_ui = unreal.FbxImportUI()
                anim_ui.set_editor_property("automated_import_should_detect_type", False)
                anim_ui.set_editor_property("mesh_type_to_import", unreal.FBXImportType.FBXIT_ANIMATION)
                anim_ui.set_editor_property("import_as_skeletal", True)
                anim_ui.set_editor_property("import_mesh", False)
                anim_ui.set_editor_property("import_animations", True)
                anim_ui.set_editor_property("skeleton", skeleton)
                anim_ui.set_editor_property("import_materials", False)
                anim_ui.set_editor_property("import_textures", False)
                configure_fbx_data(anim_ui.get_editor_property("anim_sequence_import_data"), manifest["export_settings"])
                import_fbx(root / clip["fbx"], clip_path, clip["sha256"], anim_ui, unreal.AnimSequence)
            if spec.get("aim_offset"):
                idle = load_typed(f"{folder}/A_{name}_Idle", unreal.AnimSequence)
                for pose in spec["aim_offset"]["poses"]:
                    pose_path = f"{folder}/A_{name}_{pose['name']}"
                    pose_ui = unreal.FbxImportUI()
                    pose_ui.set_editor_property("automated_import_should_detect_type", False)
                    pose_ui.set_editor_property("mesh_type_to_import", unreal.FBXImportType.FBXIT_ANIMATION)
                    pose_ui.set_editor_property("import_as_skeletal", True)
                    pose_ui.set_editor_property("import_mesh", False)
                    pose_ui.set_editor_property("import_animations", True)
                    pose_ui.set_editor_property("skeleton", skeleton)
                    pose_ui.set_editor_property("import_materials", False)
                    pose_ui.set_editor_property("import_textures", False)
                    configure_fbx_data(pose_ui.get_editor_property("anim_sequence_import_data"), manifest["export_settings"])
                    sequence, _ = import_fbx(root / pose["pose_fbx"], pose_path,
                                              pose["sha256"], pose_ui, unreal.AnimSequence)
                    if pose_path in generated:
                        sequence.set_editor_property("additive_anim_type",
                            unreal.AdditiveAnimationType.AAT_ROTATION_OFFSET_MESH_SPACE)
                        sequence.set_editor_property("ref_pose_type", unreal.AdditiveBasePoseType.ABPT_ANIM_FRAME)
                        sequence.set_editor_property("ref_pose_seq", idle)
                        sequence.set_editor_property("ref_frame_index", 0)
                        save(pose_path, sequence, pose["sha256"])
            ik_path = f"{folder}/IK_{name}"
            ik_digest = _fingerprint((spec["mesh_sha256"], spec["retarget_chains"]))
            if can_create(ik_path, ik_digest):
                ik_types = ("IKRigDefinition", "IKRigDefinitionFactory", "IKRigController")
                ik_methods = ("get_controller", "set_skeletal_mesh", "set_retarget_root", "add_retarget_chain")
                if not all(hasattr(unreal, x) for x in ik_types) or not all(hasattr(unreal.IKRigController, x) for x in ik_methods):
                    report["pending"].append({"stage": "ik_rig", "asset": ik_path, "reason": "IK Rig Python API unavailable"})
                else:
                    if lib.does_asset_exist(ik_path) and not lib.delete_asset(ik_path):
                        raise RuntimeError(f"Could not replace generated IK Rig: {ik_path}")
                    ik = tools.create_asset(f"IK_{name}", folder, unreal.IKRigDefinition, unreal.IKRigDefinitionFactory())
                    if not _class(ik, unreal.IKRigDefinition):
                        raise RuntimeError(f"IK Rig creation failed: {ik_path}")
                    claim(ik_path)
                    controller = unreal.IKRigController.get_controller(ik)
                    if not controller or not controller.set_skeletal_mesh(mesh) or not controller.set_retarget_root("pelvis"):
                        raise RuntimeError(f"IK Rig controller setup failed: {ik_path}")
                    for chain, endpoints in spec["retarget_chains"].items():
                        if not controller.add_retarget_chain(chain, endpoints[0], endpoints[1], ""):
                            raise RuntimeError(f"IK chain failed: {ik_path}/{chain}")
                    save(ik_path, ik, ik_digest)
            else:
                load_typed(ik_path, unreal.IKRigDefinition)
            create_species(spec, mesh, outline_mesh)
        except Exception as exc:
            report["failed"].append({"stage": "archetype_import", "archetype": ident,
                                     "error": str(exc), "traceback": traceback.format_exc()})

    by_id = {spec["id"]: spec for spec in manifest["archetypes"]}
    if "biped_standard" in by_id and "biped_chibi" in by_id:
        source = by_id["biped_standard"]
        target = by_id["biped_chibi"]
        source_ik_path = f"/Game/Characters/Pals/biped_standard/IK_{source['asset_name']}"
        target_ik_path = f"/Game/Characters/Pals/biped_chibi/IK_{target['asset_name']}"
        path = "/Game/Characters/Pals/RTG_BipedStandard_To_Chibi"
        shared = sorted(set(source["retarget_chains"]) & set(target["retarget_chains"]))
        digest = _fingerprint((source["mesh_sha256"], target["mesh_sha256"], shared))
        try:
            if not shared or not lib.does_asset_exist(source_ik_path) or not lib.does_asset_exist(target_ik_path):
                report["pending"].append({"stage": "ik_retargeter", "reason": "Both biped IK Rigs must exist"})
            elif (not all(hasattr(unreal, x) for x in ("IKRetargeter", "IKRetargetFactory", "IKRetargeterController", "RetargetSourceOrTarget"))
                  or not all(hasattr(unreal.IKRetargeterController, x) for x in ("get_controller", "set_ik_rig", "set_source_chain", "get_source_chain"))):
                report["pending"].append({"stage": "ik_retargeter", "reason": "IK Retargeter Python API unavailable"})
            elif can_create(path, digest):
                if lib.does_asset_exist(path) and not lib.delete_asset(path):
                    raise RuntimeError(f"Could not replace generated retargeter {path}")
                rtg = tools.create_asset("RTG_BipedStandard_To_Chibi", "/Game/Characters/Pals", unreal.IKRetargeter, unreal.IKRetargetFactory())
                if not _class(rtg, unreal.IKRetargeter):
                    raise RuntimeError(f"Retargeter creation failed: {path}")
                claim(path)
                controller = unreal.IKRetargeterController.get_controller(rtg)
                if controller is None:
                    raise RuntimeError("Retargeter controller unavailable")
                controller.set_ik_rig(unreal.RetargetSourceOrTarget.SOURCE, load_typed(source_ik_path, unreal.IKRigDefinition))
                controller.set_ik_rig(unreal.RetargetSourceOrTarget.TARGET, load_typed(target_ik_path, unreal.IKRigDefinition))
                for chain in shared:
                    controller.set_source_chain(chain, chain)
                    if str(controller.get_source_chain(chain)) != chain:
                        raise RuntimeError(f"Retargeter mapping failed: {chain}")
                save(path, rtg, digest)
            else:
                load_typed(path, unreal.IKRetargeter)
        except Exception as exc:
            report["failed"].append({"stage": "ik_retargeter", "error": str(exc), "traceback": traceback.format_exc()})

    if not report["failed"]:
        editor_library = getattr(unreal, "PolpalEditorLibrary", None)
        if editor_library is None:
            report["failed"].append({"stage": "editor_module", "error": "PolpalUEEditor module or PolpalEditorLibrary is unavailable"})
        else:
            if force and editor_assets:
                _remove_owned_editor_assets(lib, editor_assets, generated, persist)
            for stage, method, arguments in (
                    ("animation_assets", "build_animation_assets", (str(root / MANIFEST_PATH),)),
                    ("ai_assets", "build_ai_assets", ()),
                    ("prototype_map", "build_prototype_map", ())):
                try:
                    result = getattr(editor_library, method)(*arguments)
                    for value in result.get_editor_property("created"):
                        path = str(value)
                        if not _editor_asset_path(path) or not lib.does_asset_exist(path):
                            raise RuntimeError(f"Editor builder reported an invalid or missing created asset: {path}")
                        editor_assets.add(path)
                        generated.add(path)
                        persist()
                        report["created"].append(path)
                    for value in result.get_editor_property("skipped"):
                        report["skipped"].append({"asset": str(value), "reason": "existing asset preserved"})
                    for value in result.get_editor_property("pending"):
                        report["pending"].append({"stage": stage, "reason": str(value)})
                    for value in result.get_editor_property("failed"):
                        report["failed"].append({"stage": stage, "error": str(value)})
                    if not result.get_editor_property("b_ok") and not result.get_editor_property("failed"):
                        report["failed"].append({"stage": stage, "error": "Editor builder returned bOk=false without details"})
                    if stage == "animation_assets" and result.get_editor_property("b_ok"):
                        for spec in manifest["archetypes"]:
                            folder = f"/Game/Characters/Pals/{spec['id']}"
                            species_path = f"{folder}/DA_{spec['asset_name']}"
                            abp_path = f"{folder}/ABP_{spec['asset_name']}"
                            if species_path not in generated:
                                report["pending"].append({"stage": "anim_class_binding", "reason":
                                    f"Preserved unowned species asset {species_path}"})
                                continue
                            anim_class = lib.load_blueprint_class(abp_path)
                            if anim_class is None:
                                raise RuntimeError(f"Generated AnimBlueprint class unavailable: {abp_path}")
                            species = load_typed(species_path, unreal.PalSpeciesData)
                            species.set_editor_property("anim_blueprint_class", anim_class)
                            outline_path = f"{folder}/SK_{spec['asset_name']}_Outline"
                            if spec.get("outline_fbx"):
                                species.set_editor_property("outline_mesh", load_typed(outline_path, unreal.SkeletalMesh))
                            bounds = spec["bounds"]
                            species.set_editor_property("mesh_height_cm",
                                (bounds["max_m"][2] - bounds["min_m"][2]) * 100.0)
                            horizontal = min(bounds["max_m"][axis] - bounds["min_m"][axis] for axis in (0, 1))
                            species.set_editor_property("capsule_radius_cm",
                                max(20.0, min(70.0, horizontal * 50.0)))
                            attack_clip = ("Attack_Cast_Skill" if spec["element"] in
                                           ("Fire", "Water", "Electric", "Air") else "Attack_Melee")
                            attack = load_typed(f"{folder}/AM_{spec['asset_name']}_{attack_clip}", unreal.AnimMontage)
                            species.set_editor_property("attack_montage", attack)
                            work_clips = {
                                "HANDIWORK": "Work_Hammering", "KINDLING": "Work_Hammering",
                                "MINING": "Work_Mining", "WATERING": "Work_Watering",
                                "PLANTING": "Work_Watering", "GATHERING": "Work_Carrying_Idle",
                                "TRANSPORTING": "Work_Carrying_Idle",
                            }
                            work = {getattr(unreal.PalWorkType, kind):
                                    load_typed(f"{folder}/AM_{spec['asset_name']}_{clip}", unreal.AnimMontage)
                                    for kind, clip in work_clips.items()}
                            species.set_editor_property("work_montages", work)
                            save(species_path, species)
                except Exception as exc:
                    report["failed"].append({"stage": stage, "error": str(exc), "traceback": traceback.format_exc()})
                finally:
                    registry["editor_source_fingerprint"] = editor_source_hash
                    persist()
    else:
        report["pending"].append({"stage": "editor_builders", "reason": "Skipped because import or data asset generation failed"})
    fx_library = getattr(unreal, "PolpalFXEditorLibrary", None)
    if fx_library is None:
        report["failed"].append({"stage": "effects", "error": "PolpalUEFXEditor module or PolpalFXEditorLibrary is unavailable"})
    else:
        try:
            fx_result = fx_library.build_effects(force)
            for value in fx_result.get_editor_property("created"):
                report["created"].append(str(value))
            for value in fx_result.get_editor_property("pending"):
                report["pending"].append({"stage": "effects", "reason": str(value)})
            for value in fx_result.get_editor_property("failed"):
                report["failed"].append({"stage": "effects", "error": str(value)})
            if not fx_result.get_editor_property("b_ok") and not fx_result.get_editor_property("failed"):
                report["failed"].append({"stage": "effects", "error": "FX builder returned bOk=false without details"})
        except Exception as exc:
            report["failed"].append({"stage": "effects", "error": str(exc), "traceback": traceback.format_exc()})
    report["pending"].append({
        "stage": "control_rig", "reason": "Control Rig asset/graph remains unimplemented; native animation graph is separate"})
    verification_stages = {"effects"}
    verification_terms = ("inspection", "verification", "not verified", "unverified", "visual")
    report["implementation_pending"] = []
    report["verification_pending"] = []
    for item in report["pending"]:
        reason = item.get("reason", "").lower()
        category = ("verification_pending" if item.get("stage") in verification_stages or
                    any(term in reason for term in verification_terms)
                    else "implementation_pending")
        report[category].append(item)
    report["ok"] = not report["failed"]
    report["status"] = ("failed" if not report["ok"] else
                        "prepared_assets_with_pending_work" if report["implementation_pending"] else
                        "prepared_assets_awaiting_verification" if report["verification_pending"] else
                        "prepared_assets")
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check-manifest", action="store_true")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    root = repo_root()
    try:
        manifest = validate_manifest(root)
        if args.check_manifest:
            print(json.dumps({"ok": True, "archetypes": len(manifest["archetypes"]),
                              "animations": sum(len(a["animations"]) for a in manifest["archetypes"])}, indent=2))
            return 0
        force = args.force or os.environ.get("POLPAL_BOOTSTRAP_FORCE") == "1"
        report = run_editor(root, manifest, force)
    except Exception as exc:
        report = {"ok": False, "status": "failed", "ue_runtime_verified": False,
                  "failed": [{"stage": "manifest_or_bootstrap", "error": str(exc),
                                           "traceback": traceback.format_exc()}]}
    _write_json(_report_path(root), report)
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
