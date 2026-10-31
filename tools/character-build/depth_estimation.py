#!/usr/bin/env python3
"""Wariant B: względna mapa głębi z jednego widoku (Depth Anything V2, ONNX).

Model nie zna ukrytych powierzchni — zwraca względny „inverse depth”
(obraz nie niesie skali). Skrypt zapisuje mapę i **wskazówki** proporcji
(mnożniki głębokości pierścieni torsu), nigdy pomiar milimetrowy.

Uruchomienie:
    python3 tools/character-build/depth_estimation.py \
        --image output/character-scan/reference.png \
        --measurements output/character-scan/aiko/measurements.json \
        --out output/character-build/aiko/depth

Wymaga: numpy, Pillow, onnxruntime, (opcjonalnie) cv2 do skalowania.
Model pobierany jest raz do katalogu cache (--cache), ok. 25 MB.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

MODEL_URL = (
    "https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/"
    "onnx/model_quantized.onnx"
)
INPUT_SIZE = 518
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

# Pasma torsu: (nazwa, od y_ratio, do y_ratio) w układzie referencji.
BANDS = {
    "chest": (0.50, 0.58),
    "waist": (0.58, 0.64),
    "hip": (0.64, 0.70),
    "thigh": (0.70, 0.80),
}

# Względna bliskość (0..1) mapowana na mnożnik głębokości ringu.
MULTIPLIER_RANGE = (0.85, 1.20)
MIN_USABLE_STD = 0.02


def fail(message: str) -> "NoReturn":  # type: ignore[name-defined]
    print(f"Błąd: {message}", file=sys.stderr)
    raise SystemExit(1)


def have_module(name: str) -> bool:
    return importlib.util.find_spec(name) is not None


def ensure_model(cache: Path) -> Path:
    cache.mkdir(parents=True, exist_ok=True)
    path = cache / "depth-anything-v2-small-q.onnx"
    if path.is_file() and path.stat().st_size > 1_000_000:
        return path
    print(f"Pobieram model: {MODEL_URL}", file=sys.stderr)
    request = urllib.request.Request(MODEL_URL, headers={"User-Agent": "polpal/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=120) as response, path.open("wb") as handle:
            handle.write(response.read())
    except Exception as error:  # noqa: BLE001 - raport sieci jawnie
        path.unlink(missing_ok=True)
        fail(f"nie udało się pobrać modelu: {error}")
    return path


def character_mask(rgb: np.ndarray) -> np.ndarray:
    """Maska postaci jak w character-scan: tło z narożników."""
    corners = np.array(
        [rgb[0, 0], rgb[0, -1], rgb[-1, 0], rgb[-1, -1]], dtype=np.int16
    )
    background = np.median(corners, axis=0)
    distance = np.abs(rgb.astype(np.int16) - background).max(axis=2)
    return distance > 12


def run_depth(image: np.ndarray, model_path: Path) -> np.ndarray:
    import onnxruntime as ort

    session = ort.InferenceSession(
        str(model_path), providers=["CPUExecutionProvider"]
    )
    input_name = session.get_inputs()[0].name
    resized = Image.fromarray(image).resize(
        (INPUT_SIZE, INPUT_SIZE), Image.Resampling.BILINEAR
    )
    array = np.asarray(resized).astype(np.float32) / 255.0
    array = (array - IMAGENET_MEAN) / IMAGENET_STD
    tensor = array.transpose(2, 0, 1)[None]
    output = session.run(None, {input_name: tensor})[0]
    field = output[0, 0]
    field = field - field.min()
    maximum = float(field.max())
    if maximum > 0:
        field = field / maximum
    return np.asarray(
        Image.fromarray((field * 255).astype(np.uint8)).resize(
            (image.shape[1], image.shape[0]), Image.Resampling.BILINEAR
        ),
        dtype=np.float32,
    ) / 255.0


def band_medians(
    depth: np.ndarray, mask: np.ndarray, y0: int, y1: int
) -> dict[str, float]:
    rows, columns = np.nonzero(mask)
    top, bottom = int(rows.min()), int(rows.max())
    axis = int(np.median(columns))
    result = {}
    height = bottom - top + 1
    for name, (start, end) in BANDS.items():
        band_top = int(top + start * height)
        band_bottom = int(top + end * height)
        window = mask[band_top:band_bottom + 1]
        columns_band = np.nonzero(window.any(axis=0))[0]
        if columns_band.size == 0:
            result[name] = float("nan")
            continue
        # Środek sylwetki w tym pasie: unikamy rekwizytów przy krawędziach.
        center = int(np.median(columns_band))
        near = [
            index
            for index in range(band_top, band_bottom + 1)
            for column in np.flatnonzero(window[index - band_top])
            if abs(column - center) <= (columns_band.max() - columns_band.min()) * 0.25
        ]
        if not near:
            near = list(range(band_top, band_bottom + 1))
        samples = depth[max(0, band_top):band_bottom + 1][
            np.asarray(near)[: depth[max(0, band_top):band_bottom + 1].shape[0]]
        ] if False else depth[max(0, band_top):band_bottom + 1][
            np.nonzero(mask[max(0, band_top):band_bottom + 1, max(0, center - 40):center + 40].any(axis=1))
        ]
        if samples.size == 0:
            result[name] = float("nan")
        else:
            result[name] = float(np.median(samples))
    return result


def hints_from_medians(medians: dict[str, float]) -> dict[str, float] | None:
    values = [value for value in medians.values() if np.isfinite(value)]
    if len(values) < 3:
        return None
    low, high = min(values), max(values)
    if high - low < 1e-6:
        return {name: 1.0 for name in BANDS}
    normalized = {
        name: (value - low) / (high - low) if np.isfinite(value) else 0.5
        for name, value in medians.items()
    }
    low_m, high_m = MULTIPLIER_RANGE
    return {
        name: round(low_m + (high_m - low_m) * normalized[name], 4)
        for name in BANDS
    }


def save_colormap(depth: np.ndarray, mask: np.ndarray, path: Path) -> None:
    mapped = np.clip(depth * 255.0, 0, 255).astype(np.uint8)
    rgb = np.stack([mapped, mapped // 2, 255 - mapped], axis=2)
    rgb[~mask] = (rgb[~mask] * 0.15).astype(np.uint8)
    Image.fromarray(rgb).save(path)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Względna głębia z jednego widoku")
    parser.add_argument("--image", type=Path, required=True)
    parser.add_argument("--measurements", type=Path, default=None)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--cache", type=Path,
                        default=Path("output/character-build/models"))
    args = parser.parse_args(argv)

    if not have_module("onnxruntime"):
        fail("brak onnxruntime — zainstaluj go osobno (poza Blenderem)")

    image = np.asarray(Image.open(args.image).convert("RGB"))
    mask = character_mask(image)
    if not mask.any():
        fail("maska postaci jest pusta")

    model_path = ensure_model(args.cache)
    depth = run_depth(image, model_path)

    out_dir = args.out.expanduser()
    out_dir.mkdir(parents=True, exist_ok=True)
    save_colormap(depth, mask, out_dir / "depth-map.png")

    inside = depth[mask]
    usable = bool(inside.size > 100 and float(inside.std()) >= MIN_USABLE_STD)
    medians: dict[str, float] = {}
    hints = None
    gradient_artifact = 0.0
    residual_ratio = 1.0
    if usable:
        # Na płaskiej ilustracji model potrafi zwrócić sam pionowy gradient
        # kadru („bliżej” = niżej w obrazie). Odrzuć mapy, które po odjęciu
        # liniowego trendu od rzędu prawie nie mają treści.
        rows, _ = np.nonzero(mask)
        row_norm = rows / max(1, image.shape[0] - 1)
        depth_values = depth[mask].astype(np.float64)
        row_centered = row_norm - row_norm.mean()
        depth_centered = depth_values - depth_values.mean()
        denominator = float(
            np.sqrt((row_centered**2).sum() * (depth_centered**2).sum())
        )
        gradient_artifact = (
            float((row_centered * depth_centered).sum() / denominator)
            if denominator
            else 0.0
        )
        if denominator:
            slope = float((row_centered * depth_centered).sum() / (row_centered**2).sum())
            residuals = depth_centered - slope * row_centered
            residual_ratio = float(
                residuals.std() / max(1e-9, depth_values.std())
            )
        if abs(gradient_artifact) > 0.85 or residual_ratio < 0.35:
            usable = False
    if usable:
        medians = band_medians(depth, mask, 0, image.shape[0])
        hints = hints_from_medians(medians)
        # Plauzybilność: u stojącej postaci fotografowanej z przodu pasy
        # ciała są w przybliżeniu równie blisko kamery. Gdy „uda” wychodzą
        # wyraźnie bliżej niż klatka, mapa śledzi pozycję w kadrze, nie formę.
        if (
            np.isfinite(medians.get("thigh", float("nan")))
            and np.isfinite(medians.get("chest", float("nan")))
            and medians["thigh"] > medians["chest"] + 0.15
        ):
            usable = False
            hints = None
            medians = {key: value for key, value in medians.items()}

    report = {
        "tool": "character-build depth_estimation",
        "variant": "B (monokularna względna głębia; brak skali, brak tyłu)",
        "model": "Depth Anything V2 Small (ONNX, CPU)",
        "image": str(args.image),
        "usable": usable,
        "std_inside_mask": round(float(inside.std()), 4) if inside.size else 0.0,
        "row_gradient_correlation": round(gradient_artifact, 4),
        "row_residual_ratio": round(residual_ratio, 4),
        "verdict": (
            "odrzucono: mapa śledzi pionową pozycję w kadrze, nie anatomię "
            "(thigh znacznie bliżej niż chest)"
            if not usable and medians
            else ("użyteczne wskazówki" if usable else "mapa bez treści albo artefakt gradientu")
        ),
        "band_medians": {key: round(value, 4) for key, value in medians.items()},
        "depth_hints": hints,
        "multiplier_range": list(MULTIPLIER_RANGE),
        "warning": (
            "Wskazówki są interpretacją cieniowania, nie pomiarem. "
            "Na ilustracji stylizowanej model może zwrócić mapę bez sensu; "
            "gdy usable=false, nie używaj hints. Odrzucamy mapy, których "
            "głębia jest w >85% pionowym gradientem kadru."
        ),
    }
    (out_dir / "depth-hints.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
