#!/usr/bin/env python3
"""Wariant B: względny inverse depth, NIE pomiar grubości postaci.

Domyślnie zapisuje mapę float32 i diagnostykę. --derive-hints włącza jawny,
eksperymentalny model: relief poprzeczny zwiększa głębokość torsu o <=15%.
To założenie modelarskie, nie przeliczenie inverse depth na metry.
"""

from __future__ import annotations

import argparse
import hashlib
import json
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
BANDS = {
    "chest": (0.43, 0.50),
    "waist": (0.51, 0.55),
    "hip": (0.57, 0.62),
}


def ensure_model(cache: Path) -> Path:
    cache.mkdir(parents=True, exist_ok=True)
    path = cache / "depth-anything-v2-small-q.onnx"
    if path.is_file() and path.stat().st_size > 1_000_000:
        return path
    temporary = path.with_suffix(".download")
    request = urllib.request.Request(MODEL_URL, headers={"User-Agent": "polpal/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            with temporary.open("wb") as handle:
                while chunk := response.read(1024 * 1024):
                    handle.write(chunk)
        if temporary.stat().st_size < 1_000_000:
            raise ValueError("pobrany model jest zbyt mały")
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)
    return path


def load_source(path: Path) -> tuple[np.ndarray, np.ndarray]:
    image = Image.open(path).convert("RGBA")
    rgba = np.asarray(image)
    if (rgba[..., 3] < 250).mean() >= 0.005:
        mask = rgba[..., 3] > 127
        # Nie karm modelu przypadkowymi kolorami w całkowicie przezroczystym tle.
        background = Image.new("RGBA", image.size, (128, 128, 128, 255))
        rgb = np.asarray(Image.alpha_composite(background, image).convert("RGB"))
    else:
        rgb = rgba[..., :3]
        corners = np.array([rgb[0, 0], rgb[0, -1], rgb[-1, 0], rgb[-1, -1]],
                           dtype=np.int16)
        mask = np.abs(rgb.astype(np.int16) - np.median(corners, axis=0)).max(axis=2) > 12
    if not mask.any():
        raise ValueError("pusta maska postaci")
    return rgb, mask


def prepare_input(image: np.ndarray) -> np.ndarray:
    """DPT: zachowaj proporcje, rozmiary wielokrotnością 14, bicubic.

    Reguła skalowania z DPTImageProcessor: wybierz skalę najmniej odległą
    od 1 spośród 518/H i 518/W (preprocessor_config modelu).
    """
    height, width = image.shape[:2]
    scale = min((INPUT_SIZE / height, INPUT_SIZE / width), key=lambda s: abs(1 - s))
    target = (max(14, round(width * scale / 14) * 14),
              max(14, round(height * scale / 14) * 14))
    resized = Image.fromarray(image).resize(target, Image.Resampling.BICUBIC)
    array = np.asarray(resized).astype(np.float32) / 255.0
    array = (array - IMAGENET_MEAN) / IMAGENET_STD
    return np.ascontiguousarray(array.transpose(2, 0, 1)[None])


def output_field(output: np.ndarray) -> np.ndarray:
    """Obsłuż [1,H,W] i [1,1,H,W], bez niejawnego rozciągania wiersza."""
    array = np.asarray(output, dtype=np.float32)
    if array.ndim == 3 and array.shape[0] == 1:
        array = array[0]
    elif array.ndim == 4 and array.shape[:2] == (1, 1):
        array = array[0, 0]
    else:
        raise ValueError(f"nieobsługiwany kształt wyjścia ONNX: {array.shape}")
    if min(array.shape) < 2 or not np.isfinite(array).all():
        raise ValueError("mapa głębi ma niepoprawny rozmiar lub NaN/Inf")
    return array


def run_depth(image: np.ndarray, model_path: Path) -> tuple[np.ndarray, dict]:
    import onnxruntime as ort

    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    tensor = prepare_input(image)
    output = session.run(None, {session.get_inputs()[0].name: tensor})[0]
    field = output_field(output)
    # Tryb F zachowuje float32. Kwantyzacja do 8 bitów dopiero w podglądzie.
    restored = np.asarray(Image.fromarray(field).resize(
        (image.shape[1], image.shape[0]), Image.Resampling.BICUBIC), dtype=np.float32)
    return restored, {"input_shape": list(tensor.shape), "output_shape": list(output.shape)}


def band_statistics(depth: np.ndarray, mask: np.ndarray, measurements: dict | None = None) -> dict:
    if depth.shape != mask.shape or not mask.any():
        raise ValueError("mapa i maska muszą mieć ten sam rozmiar i niepustą sylwetkę")
    rows, cols = np.nonzero(mask)
    top, bottom = int(rows.min()), int(rows.max())
    height = bottom - top + 1
    bands = dict(BANDS)
    landmarks = {item["name"]: item for item in (measurements or {}).get("landmarks", [])}
    for name in ("waist", "hip"):
        if name in landmarks:
            center = float(landmarks[name]["y_ratio"])
            bands[name] = (max(0, center - 0.02), min(1, center + 0.02))
    if measurements and "character" in measurements:
        reference = measurements["character"]
        # Profil może pochodzić z innej rozdzielczości; użyj osi względnej.
        x0, _, x1, _ = reference["bbox_px"]
        fraction = (reference["axis_x"] - x0) / max(1, x1 - x0)
        axis = cols.min() + fraction * (cols.max() - cols.min())
    else:
        axis = float(np.median(cols))
    xlo = max(0, int(axis - height * 0.08))
    xhi = min(mask.shape[1], int(axis + height * 0.08) + 1)
    result = {}
    for name, (start, end) in bands.items():
        lo = top + round(start * (height - 1))
        hi = top + round(end * (height - 1)) + 1
        region = depth[lo:hi, xlo:xhi]
        valid = mask[lo:hi, xlo:xhi] & np.isfinite(region)
        values = region[valid]
        relief = []
        for line, selected in zip(region, valid):
            if selected.sum() >= 5:
                relief.append(float(np.percentile(line[selected], 90)
                                    - np.percentile(line[selected], 10)))
        result[name] = {
            "median": float(np.median(values)) if values.size else None,
            "lateral_relief": float(np.median(relief)) if relief else None,
            "samples": int(values.size),
            "y_ratio_range": [start, end],
        }
    return result


def assess_depth(depth: np.ndarray, mask: np.ndarray, measurements: dict | None = None,
                 derive_hints: bool = False) -> dict:
    stats = band_statistics(depth, mask, measurements)
    values = depth[mask]
    if not np.isfinite(values).all():
        raise ValueError("NaN/Inf w mapie głębi")
    dynamic_range = float(np.percentile(values, 95) - np.percentile(values, 5))
    rows = np.nonzero(mask)[0].astype(float)
    correlation = float(np.corrcoef(rows, values)[0, 1]) if values.std() > 1e-9 else 0.0
    # Korelacja jest diagnostyką, nie dowodem błędnej anatomii. Wymagamy
    # reliefu w obrębie rzędów, którego pionowy gradient nie dostarczy.
    reliefs = [entry["lateral_relief"] for entry in stats.values()
               if entry["lateral_relief"] is not None]
    technical_usable = bool(dynamic_range > 1e-6 and len(reliefs) == len(BANDS)
                            and max(reliefs) > dynamic_range * 0.02)
    hints = None
    if technical_usable and derive_hints:
        hints = {name: round(1.0 + 0.15 * min(1.0, entry["lateral_relief"] / dynamic_range), 4)
                 for name, entry in stats.items()}
    return {
        "technical_usable": technical_usable,
        "usable": hints is not None,
        "band_statistics": stats,
        "row_gradient_correlation": correlation,
        "foreground_dynamic_range": dynamic_range,
        "depth_hints": hints,
        "hint_policy": "lateral-relief-v1" if hints is not None else None,
        "verdict": ("eksperymentalne mnożniki (założenie modelarskie)" if hints else
                    "mapa diagnostyczna; brak zgody na heurystykę lub brak reliefu"),
    }


def save_colormap(depth: np.ndarray, mask: np.ndarray, path: Path) -> None:
    low, high = np.percentile(depth[mask], [2, 98])
    normalized = np.clip((depth - low) / max(float(high - low), 1e-9), 0, 1)
    mapped = (normalized * 255).astype(np.uint8)
    rgb = np.stack([mapped, mapped // 2, 255 - mapped], axis=2)
    rgb[~mask] = 24
    Image.fromarray(rgb).save(path)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", type=Path, required=True)
    parser.add_argument("--measurements", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--cache", type=Path, default=Path("output/character-build/models"))
    parser.add_argument("--derive-hints", action="store_true",
                        help="eksperymentalna heurystyka reliefu; NIE pomiar grubości")
    args = parser.parse_args(argv)
    image, mask = load_source(args.image.expanduser())
    measurements = (json.loads(args.measurements.expanduser().read_text(encoding="utf-8"))
                    if args.measurements else None)
    model_path = ensure_model(args.cache.expanduser())
    depth, shapes = run_depth(image, model_path)
    report = {
        "tool": "character-build depth_estimation", "version": 2,
        "model_url": MODEL_URL,
        "model_sha256": hashlib.sha256(model_path.read_bytes()).hexdigest(),
        "image": str(args.image),
        "source_sha256": hashlib.sha256(args.image.expanduser().read_bytes()).hexdigest(),
        **shapes,
        **assess_depth(depth, mask, measurements, args.derive_hints),
        "warning": "Inverse depth nie określa grubości ani ukrytego tyłu. Mnożniki są założeniem.",
    }
    out = args.out.expanduser()
    out.mkdir(parents=True, exist_ok=True)
    np.save(out / "depth.npy", depth, allow_pickle=False)
    save_colormap(depth, mask, out / "depth-map.png")
    document = json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False)
    (out / "depth-hints.json").write_text(document + "\n", encoding="utf-8")
    print(document)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
