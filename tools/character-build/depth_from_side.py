#!/usr/bin/env python3
"""Wariant C (tor pomiarowy): profil głębokości z widoku bocznego.

Wejście: obraz boczny postaci (twarz w lewo kadru), measurements.json z
character-scan (do wysokości i proporcji wierszy), etykieta źródła.
Wyjście: depth-profile.json — głębokości głowy, talii, bioder i kroku
w metrach, do użycia przez build_character.py --depth-profile.

Uwaga uczciwości: jeśli widok pochodzi z generatora, to jest **interpretacją**,
nie pomiarem referencji. Narzędzie oznacza to w polu "provenance".

Uruchomienie:
    python3 tools/character-build/depth_from_side.py \
        --image output/character-build/views-gen/side.png \
        --measurements output/character-scan/aiko/measurements.json \
        --source-label generated --out output/character-build/aiko
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path

import numpy as np

SCAN_PATH = Path(__file__).resolve().parents[1] / "character-scan" / "scan.py"


def _load_scan():
    spec = importlib.util.spec_from_file_location("character_scan_module", SCAN_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules["character_scan_module"] = module
    spec.loader.exec_module(module)
    return module


def row_run_near_center(
    mask_row: np.ndarray, center: float, max_gap: int = 8
) -> tuple[int, int] | None:
    """Przebieg sylwetki zawierający środek ciała w tym wierszu."""
    columns = np.flatnonzero(mask_row)
    if columns.size == 0:
        return None
    runs: list[tuple[int, int]] = []
    start = int(columns[0])
    previous = start
    for column in columns[1:]:
        column = int(column)
        if column > previous + max_gap:
            runs.append((start, previous))
            start = column
        previous = column
    runs.append((start, previous))
    best = min(
        runs,
        key=lambda run: min(abs(run[0] - center), abs(run[1] - center)),
    )
    return best


def measure_depths(
    module,
    image_path: Path,
    rows: dict[str, float],
    height_m: float,
) -> dict:
    rgb, mask, mode = module.load_image(image_path)
    top = int(np.flatnonzero(mask.any(axis=1))[0])
    bottom = int(np.flatnonzero(mask.any(axis=1))[-1])
    height_px = bottom - top + 1
    mm_per_px = height_m * 1000.0 / height_px

    body_center: float | None = None
    landmarks: dict[str, dict] = {}
    for name, ratio in rows.items():
        row = int(round(top + ratio * (height_px - 1)))
        row = max(top, min(bottom, row))
        if body_center is None:
            columns = np.flatnonzero(mask[row])
            if columns.size:
                body_center = float((columns[0] + columns[-1]) / 2.0)
        run = row_run_near_center(mask[row], body_center or image.shape[1] / 2.0)
        if run is None:
            landmarks[name] = {"y_ratio": ratio, "depth_m": None}
            continue
        landmarks[name] = {
            "y_ratio": ratio,
            "y": row,
            "left": int(run[0]),
            "right": int(run[1]),
            "depth_px": int(run[1] - run[0] + 1),
            "depth_m": round((run[1] - run[0] + 1) * mm_per_px / 1000.0, 4),
        }
    return {
        "landmarks": landmarks,
        "height_px": height_px,
        "mm_per_px": round(mm_per_px, 4),
        "mask_mode": mode,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Profil głębokości z widoku bocznego")
    parser.add_argument("--image", type=Path, required=True,
                        help="widok boczny (twarz w lewo kadru)")
    parser.add_argument("--measurements", type=Path, required=True,
                        help="measurements.json z character-scan")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--source-label", default="user",
                        choices=("generated", "photo", "user"),
                        help="pochodzenie widoku; generated = interpretacja AI")
    parser.add_argument("--height-mm", type=float, default=None)
    args = parser.parse_args(argv)

    scan = _load_scan()
    data = json.loads(args.measurements.read_text(encoding="utf-8"))
    height_m = float(
        args.height_mm if args.height_mm is not None
        else data["scale"]["height_mm"] / 1000.0
    )
    if height_m <= 0:
        scan.fail("wysokość musi być dodatnia")

    face = data.get("face") or {}
    eye_ratio = face.get("eye_line_y_ratio")
    rows = {"head_max": 0.203, "waist": 0.5313, "hip": 0.5832, "crotch": 0.6751}
    for item in data["landmarks"]:
        rows[item["name"]] = item["y_ratio"]
    if eye_ratio is not None:
        rows["eye_line"] = eye_ratio

    result = measure_depths(scan, args.image, rows, height_m)
    profile = {
        "tool": "character-build depth_from_side",
        "variant": "C tor pomiarowy (widok boczny)",
        "image": str(args.image),
        "source_label": args.source_label,
        "provenance": (
            "Widok z generatora to interpretacja referencji, nie pomiar."
            if args.source_label == "generated"
            else "Widok z zewnętrznego źródła; wiarygodność zależy od źródła."
        ),
        "height_mm": height_m * 1000.0,
        **result,
    }
    args.out.expanduser().mkdir(parents=True, exist_ok=True)
    output = args.out.expanduser() / "depth-profile.json"
    output.write_text(
        json.dumps(profile, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(json.dumps(profile["landmarks"], indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
