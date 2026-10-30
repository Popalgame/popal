"""Reproducible local pipeline. Unreal stages require an explicitly installed UE.

python3 tools/ue5-pipeline/run.py doctor
python3 tools/ue5-pipeline/run.py assets
python3 tools/ue5-pipeline/run.py check
python3 tools/ue5-pipeline/run.py editor-build --engine-root /path/to/UE_5.8
python3 tools/ue5-pipeline/run.py bootstrap --engine-root /path/to/UE_5.8
"""
from __future__ import annotations

import argparse
import ast
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tempfile
import time
import zipfile


ROOT = Path(__file__).resolve().parents[2]
PROJECT = ROOT / "unreal" / "PolpalUE"
OUTPUT = ROOT / "output" / "ue5-pipeline"
MODULE = Path(__file__).resolve().parent


def run(command: list[str], **kwargs) -> None:
    """No shell evaluation; paths, parameters and environment stay separate."""
    print("Running:", " ".join(map(str, command)), flush=True)
    subprocess.run(list(map(str, command)), check=True, cwd=ROOT, **kwargs)


def find_engine(explicit: str | None = None) -> Path | None:
    requested = explicit or os.environ.get("UE_ROOT")
    # An explicit invalid path must not silently select a different installation.
    candidates = [requested] if requested else ["/Users/Shared/Epic Games/UE_5.8", "C:/Program Files/Epic Games/UE_5.8", "/opt/UnrealEngine"]
    for item in candidates:
        if item:
            path = Path(item).expanduser().resolve()
            if (path / "Engine" / "Build" / "Build.version").is_file():
                return path
    return None


def executable(engine: Path) -> Path:
    choices = [
        "Engine/Binaries/Mac/UnrealEditor-Cmd",
        "Engine/Binaries/Mac/UnrealEditor.app/Contents/MacOS/UnrealEditor",
        "Engine/Binaries/Win64/UnrealEditor-Cmd.exe",
        "Engine/Binaries/Linux/UnrealEditor-Cmd",
    ]
    for relative in choices:
        path = engine / relative
        if path.is_file():
            return path
    raise RuntimeError("UnrealEditor executable not found in engine root")


def require_engine(explicit: str | None) -> Path:
    engine = find_engine(explicit)
    if engine is None:
        raise RuntimeError("Unreal Engine is not installed. Set UE_ROOT or pass --engine-root. No Unreal stage was run.")
    version = json.loads((engine / "Engine/Build/Build.version").read_text())
    if (version.get("MajorVersion"), version.get("MinorVersion")) != (5, 8):
        raise RuntimeError("This project targets UE 5.8. Review source/API compatibility before using a different engine.")
    return engine


def doctor(explicit: str | None) -> dict:
    engine = find_engine(explicit)
    blender = os.environ.get("BLENDER_BIN") or shutil.which("blender")
    compiler = shutil.which("clang++") or shutil.which("g++")
    result = {
        "checked_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "platform": platform.platform(),
        "free_disk_gib": round(shutil.disk_usage(ROOT).free / 1024**3, 2),
        "blender": blender,
        "cpp_compiler": compiler,
        "unreal_engine": str(engine) if engine else None,
        "unreal_build_verified": False,
    }
    if sys.platform == "darwin":
        selected = subprocess.run(["xcode-select", "-p"], capture_output=True, text=True)
        result["developer_directory"] = selected.stdout.strip()
        result["full_xcode"] = selected.returncode == 0 and ".app/Contents/Developer" in selected.stdout
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "environment.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))
    return result


def assets(validate_only=False) -> None:
    blender = os.environ.get("BLENDER_BIN") or shutil.which("blender")
    if not blender:
        raise RuntimeError("Blender not found. Set BLENDER_BIN to its executable.")
    steps = ["validate_assets.py"] if validate_only else ["generate_assets.py", "validate_assets.py"]
    with tempfile.TemporaryDirectory(prefix="polpal-asset-bridge-") as isolated:
        environment = {**os.environ, "BLENDER_AI_BRIDGE_DIR": isolated}
        for step in steps:
            run([blender, "--background", "--factory-startup", "--python-exit-code", "1", "--python", MODULE / "blender" / step], env=environment)


def local_checks() -> None:
    # Compile syntax without importing bpy/unreal or writing __pycache__ into Content.
    sources = list(MODULE.rglob("*.py")) + list((PROJECT / "Content/Python").rglob("*.py"))
    for path in sources:
        ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    descriptor = json.loads((PROJECT / "PolpalUE.uproject").read_text())
    assert descriptor["EngineAssociation"] == "5.8"
    assert any(module["Name"] == "PolpalUE" for module in descriptor["Modules"])
    for directory in ("Core", "Characters/Human", "Characters/Pals", "Buildings", "VFX", "Materials"):
        assert (PROJECT / "Content" / directory).is_dir(), directory
    run([sys.executable, PROJECT / "Content/Python/bootstrap_project.py", "--check-manifest"])
    compiler = shutil.which("clang++") or shutil.which("g++")
    if not compiler:
        raise RuntimeError("No C++ compiler found; portable rules were not tested.")
    with tempfile.TemporaryDirectory(prefix="polpal-rules-") as temporary:
        binary = Path(temporary) / "pal_rules_test"
        run([compiler, "-std=c++20", "-Wall", "-Wextra", "-Werror", "-pedantic", PROJECT / "Tests/pal_rules_test.cpp", "-I", PROJECT / "Source/PolpalUE/Public", "-o", binary])
        run([binary])
    run([sys.executable, "-m", "unittest", "discover", "-s", MODULE / "tests", "-p", "test_*.py"])
    print("Local checks passed. UE compilation, asset import, PIE and multiplayer are NOT verified.")


def editor_build(engine: Path) -> None:
    fingerprint = source_digest()
    system = {"Darwin": "Mac", "Windows": "Win64", "Linux": "Linux"}[platform.system()]
    script = engine / "Engine/Build/BatchFiles" / ("Build.bat" if os.name == "nt" else ("Mac/Build.sh" if system == "Mac" else "Linux/Build.sh"))
    if not script.exists():
        raise RuntimeError(f"Engine build script not found: {script}")
    run([script, "PolpalUEEditor", system, "Development", f"-Project={PROJECT / 'PolpalUE.uproject'}", "-WaitMutex", "-NoHotReloadFromIDE"])
    if source_digest() != fingerprint:
        raise RuntimeError("Sources changed during engine compilation; no current-source build receipt was recorded.")
    saved = PROJECT / "Saved/Polpal"
    saved.mkdir(parents=True, exist_ok=True)
    (saved / "build-receipt.json").write_text(json.dumps({"ok": True, "source_sha256": fingerprint, "engine_root": str(engine), "engine_version": "5.8"}, indent=2) + "\n")


def source_digest() -> str:
    """Bind engine evidence to the actual sources/configuration that were tested."""
    digest = hashlib.sha256()
    paths = [PROJECT / "PolpalUE.uproject", MODULE / "manifests/pipeline.json"]
    for folder in (PROJECT / "Source", PROJECT / "Config", PROJECT / "Content/Python", PROJECT / "Design", MODULE / "blender"):
        paths.extend(path for path in folder.rglob("*") if path.is_file() and "__pycache__" not in path.parts and path.suffix != ".pyc")
    for path in sorted(paths):
        digest.update(path.relative_to(ROOT).as_posix().encode())
        digest.update(b"\0")
        digest.update(path.read_bytes())
    return digest.hexdigest()


def bootstrap(engine: Path, force=False) -> None:
    fingerprint = source_digest()
    # Do not let an old success report disguise a failed/current run.
    report = PROJECT / "Saved/Polpal/bootstrap-report.json"
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps({"ok": False, "status": "starting"}))
    script = PROJECT / "Content/Python/bootstrap_project.py"
    command = [executable(engine), PROJECT / "PolpalUE.uproject", "-unattended", "-nosplash", "-stdout", "-FullStdOutLogOutput", f"-ExecutePythonScript={script}"]
    environment = {**os.environ, "POLPAL_REPO_ROOT": str(ROOT), "POLPAL_BOOTSTRAP_FORCE": "1" if force else "0"}
    run(command, env=environment)
    result = json.loads(report.read_text())
    if result.get("ok") is not True:
        raise RuntimeError(f"Unreal bootstrap incomplete; inspect {report}")
    if source_digest() != fingerprint:
        raise RuntimeError("Sources changed during asset bootstrap; no current-source evidence was recorded.")
    result["source_sha256"] = fingerprint
    result["engine_root"] = str(engine)
    report.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    print(f"Bootstrap verified its generated assets; inspect pending editor work in {report}")


def verify_engine(engine: Path) -> None:
    """Run real UE automation; a missing report can never become a success."""
    fingerprint = source_digest()
    saved = PROJECT / "Saved/Polpal"
    receipt = saved / "build-receipt.json"
    if not receipt.is_file() or json.loads(receipt.read_text()).get("source_sha256") != source_digest():
        raise RuntimeError("Build receipt missing or stale. Run editor-build for these sources before verify-engine.")
    report = saved / ("automation-" + time.strftime("%Y%m%dT%H%M%SZ", time.gmtime()))
    report.mkdir(parents=True, exist_ok=False)
    run([executable(engine), PROJECT / "PolpalUE.uproject", "-unattended", "-nosplash", "-stdout", "-NullRHI", "-ExecCmds=Automation RunTests Polpal", "-TestExit=Automation Test Queue Empty", f"-ReportExportPath={report}"])
    index = report / "index.json"
    if not index.is_file():
        raise RuntimeError(f"UE did not write an automation report: {report}")
    result = json.loads(index.read_text())
    succeeded, failed = result.get("succeeded"), result.get("failed")
    if type(succeeded) is not int or succeeded < 1 or failed != 0 or result.get("notRun", 0) != 0:
        raise RuntimeError(f"UE automation did not complete successfully; inspect {index}")
    if source_digest() != fingerprint:
        raise RuntimeError("Sources changed during UE automation; no current-source evidence was recorded.")
    evidence = {"ok": True, "source_sha256": fingerprint, "engine_root": str(engine), "automation_report": str(index), "succeeded": succeeded,
                "scope": "Registered Polpal automation tests; graphics, multiplayer, and plan completion need separate acceptance."}
    (saved / "automation-receipt.json").write_text(json.dumps(evidence, indent=2) + "\n")
    print(json.dumps(evidence, indent=2))


def status() -> dict:
    fingerprint = source_digest()
    saved = PROJECT / "Saved/Polpal"
    result = {"overall_plan_complete": False, "current_source_sha256": fingerprint, "evidence": {}, "missing": []}
    for label, name in (("engine_build", "build-receipt.json"), ("asset_bootstrap", "bootstrap-report.json"), ("engine_automation", "automation-receipt.json")):
        path = saved / name
        valid = path.is_file()
        data = json.loads(path.read_text()) if valid else {}
        valid = valid and data.get("ok") is True and data.get("source_sha256") == fingerprint
        result["evidence"][label] = {"verified_current_sources": bool(valid), "path": str(path)}
        if not valid:
            result["missing"].append(label)
        if label == "asset_bootstrap":
            result["editor_work_pending"] = data.get("implementation_pending", data.get("pending", []))
            result["editor_verification_pending"] = data.get("verification_pending", [])
    # Acceptance evidence must also be tied to these sources and include an
    # existing, checksum-matched report. An old checkbox cannot close the plan.
    acceptance_file = saved / "acceptance-receipt.json"
    acceptance = json.loads(acceptance_file.read_text()) if acceptance_file.is_file() else {}
    current_acceptance = acceptance.get("source_sha256") == fingerprint
    for label in ("in_editor_visual_and_animation_acceptance", "multiplayer_server_authority_acceptance", "representative_performance_acceptance", "art_direction_and_asset_acceptance"):
        entry = acceptance.get("checks", {}).get(label, {}) if current_acceptance else {}
        report_path = (ROOT / entry.get("report", "missing-evidence")).resolve()
        verified = entry.get("passed") is True and report_path.is_relative_to(ROOT) and report_path.is_file()
        if verified:
            verified = hashlib.sha256(report_path.read_bytes()).hexdigest() == entry.get("sha256")
        if not verified:
            result["missing"].append(label)
    result["overall_plan_complete"] = not result["missing"] and not result.get("editor_work_pending")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return result


def package() -> None:
    """Freeze sources and validated generated assets for another UE workstation."""
    script = PROJECT / "Content/Python/bootstrap_project.py"
    spec = importlib.util.spec_from_file_location("polpal_package_manifest", script)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    manifest = module.validate_manifest(ROOT)
    files = set()
    ignored = {"Binaries", "DerivedDataCache", "Intermediate", "Saved", "__pycache__", ".vs", ".idea"}
    for base in (PROJECT, MODULE):
        for path in base.rglob("*"):
            relative = path.relative_to(base)
            if path.is_file() and not any(part in ignored for part in relative.parts) and not path.suffix == ".pyc":
                if base == PROJECT and relative.parts[:2] == ("Art", "Generated"):
                    continue
                files.add(path)
    for item in manifest["archetypes"]:
        files.update(ROOT / item[key] for key in ("blend", "mesh_fbx"))
        files.update(ROOT / data["fbx"] for data in item["animations"] + item["lods"])
        if item.get("outline_fbx"):
            files.add(ROOT / item["outline_fbx"])
        files.update(ROOT / pose["pose_fbx"] for pose in (item.get("aim_offset") or {}).get("poses", []))
    files.update(ROOT / item["mesh_fbx"] for item in manifest.get("environment", []))
    if manifest.get("landscape"):
        files.add(ROOT / manifest["landscape"]["heightmap_png"])
    OUTPUT.mkdir(parents=True, exist_ok=True)
    target = OUTPUT / "PolpalUE-local-preparation.zip"
    temporary = target.with_suffix(".zip.pending")
    index = {}
    try:
        with zipfile.ZipFile(temporary, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
            for path in sorted(files):
                name = path.relative_to(ROOT).as_posix()
                contents = path.read_bytes()
                index[name] = hashlib.sha256(contents).hexdigest()
                archive.writestr(name, contents)
            archive.writestr("package-index.json", json.dumps({"schema_version": 1, "unreal_build_verified": False, "files": index}, indent=2) + "\n")
        with zipfile.ZipFile(temporary) as archive:
            if archive.testzip() is not None:
                raise RuntimeError("Archive integrity check failed")
            for name, digest in index.items():
                if hashlib.sha256(archive.read(name)).hexdigest() != digest:
                    raise RuntimeError(f"Archive checksum mismatch: {name}")
        temporary.replace(target)
    finally:
        temporary.unlink(missing_ok=True)
    report = {"path": str(target), "files": len(index), "bytes": target.stat().st_size,
              "sha256": hashlib.sha256(target.read_bytes()).hexdigest(), "unreal_build_verified": False}
    (OUTPUT / "package-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=("doctor", "assets", "validate-assets", "check", "editor-build", "bootstrap", "verify-engine", "status", "package"))
    parser.add_argument("--engine-root")
    parser.add_argument("--force", action="store_true", help="Allow editor bootstrap to replace its generated assets")
    args = parser.parse_args()
    try:
        if args.command == "doctor":
            doctor(args.engine_root)
        elif args.command in ("assets", "validate-assets"):
            assets(args.command == "validate-assets")
        elif args.command == "check":
            local_checks()
        elif args.command == "editor-build":
            editor_build(require_engine(args.engine_root))
        elif args.command == "package":
            package()
        elif args.command == "status":
            status()
        elif args.command == "verify-engine":
            verify_engine(require_engine(args.engine_root))
        else:
            bootstrap(require_engine(args.engine_root), args.force)
        return 0
    except (OSError, ValueError, AssertionError, RuntimeError, subprocess.CalledProcessError) as exc:
        print(f"Pipeline failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
