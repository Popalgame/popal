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
import hashlib
import importlib.util
import json
import math
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
        key=lambda run: max(run[0] - center, 0, center - run[1]),
    )
    return best


def measure_depths(
    module,
    image_path: Path,
    rows: dict[str, float],
    height_m: float,
) -> dict:
    if not math.isfinite(height_m) or height_m <= 0:
        raise ValueError("wysokość musi być dodatnia i skończona (metry)")
    _, mask, mode = module.load_image(image_path)
    if mask[0].any() or mask[-1].any():
        raise ValueError("widok boczny przycięty w pionie — brak pełnej wysokości")
    top = int(np.flatnonzero(mask.any(axis=1))[0])
    bottom = int(np.flatnonzero(mask.any(axis=1))[-1])
    height_px = bottom - top + 1
    mm_per_px = height_m * 1000.0 / height_px

    # Oś oszacuj z torsu, nie z pierwszego rzędu włosów. Kolejność punktów
    # wejściowych nie może zmieniać wyboru komponentu sylwetki.
    centers = []
    for row in range(top + round(0.45 * (height_px - 1)),
                     top + round(0.65 * (height_px - 1)) + 1):
        runs = module.row_runs(mask[row])
        if runs:
            start, end = max(runs, key=lambda run: run[1] - run[0])
            centers.append((start + end) / 2)
    body_center = float(np.median(centers)) if centers else mask.shape[1] / 2
    landmarks: dict[str, dict] = {}
    for name, ratio in rows.items():
        if not math.isfinite(ratio) or not 0 <= ratio <= 1:
            raise ValueError(f"{name}: y_ratio musi być w zakresie 0..1")
        row = int(round(top + ratio * (height_px - 1)))
        row = max(top, min(bottom, row))
        run = row_run_near_center(mask[row], body_center,
                                  max_gap=max(1, round(height_px * 0.004)))
        if run is None:
            landmarks[name] = {"y_ratio": ratio, "depth_m": None}
            continue
        clipped = run[0] == 0 or run[1] == mask.shape[1] - 1
        landmarks[name] = {
            "y_ratio": ratio,
            "y": row,
            "left": int(run[0]),
            "right": int(run[1]),
            "depth_px": int(run[1] - run[0] + 1),
            "depth_m": (None if clipped else
                        round((run[1] - run[0] + 1) * mm_per_px / 1000.0, 4)),
            "clipped": clipped,
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
    height_mm = float(
        args.height_mm if args.height_mm is not None
        else data["scale"]["height_mm"]
    )
    if not math.isfinite(height_mm) or height_mm <= 0:
        scan.fail("wysokość musi być dodatnia")
    height_m = height_mm / 1000.0

    face = data.get("face") or {}
    eye_ratio = face.get("eye_line_y_ratio")
    rows = {item["name"]: item["y_ratio"] for item in data["landmarks"]
            if item["name"] in {"head_max", "waist", "hip", "crotch"}}
    if eye_ratio is not None:
        rows["eye_line"] = eye_ratio

    result = measure_depths(scan, args.image, rows, height_m)
    profile = {
        "tool": "character-build depth_from_side",
        "variant": "C tor pomiarowy (widok boczny)",
        "image": str(args.image),
        "source_sha256": hashlib.sha256(args.image.read_bytes()).hexdigest(),
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
        json.dumps(profile, indent=2, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8"
    )
    print(json.dumps(profile["landmarks"], indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
