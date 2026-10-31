"""Integracja B -> build -> eksport -> reimport, w jednorazowym procesie.

blender -b --factory-startup --python-exit-code 1 --python TEN_PLIK --
  --measurements ... --hints ... --out ...
"""

import argparse
import importlib.util
from pathlib import Path
import sys


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--measurements", required=True)
    parser.add_argument("--hints", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    root = Path(__file__).resolve().parents[1]
    out = Path(args.out).resolve()
    sys.argv = ["build_character", "--", "--measurements", args.measurements,
                "--depth-hints", args.hints, "--out", str(out), "--name", "Aiko"]
    builder = load("depth_pipeline_builder", root / "build_character.py")
    assert builder.main() == 0
    sys.argv = ["verify_glb", "--", str(out / "aiko-generated.glb"),
                str(out / "glb-verify.json"), "--render-dir", str(out / "reimport-views")]
    verifier = load("depth_pipeline_verifier", root / "verify_glb.py")
    assert verifier.main() == 0


if __name__ == "__main__":
    main()
