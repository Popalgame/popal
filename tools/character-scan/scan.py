#!/usr/bin/env python3
"""Pomiar postaci z arkusza referencyjnego (widok z przodu).

Narzędzie mierzy widoczną sylwetkę co do piksela i przelicza wymiary na
milimetry przy zadanej wysokości postaci. Wynikiem są punkty pomiarowe,
proporcje, paleta kolorów, profil szerokości i podgląd z nałożonymi liniami.

To nie jest rekonstrukcja 3D. Zdjęcie nie zawiera tyłu, głębokości ani
ukrytych powierzchni, więc pomiar opisuje tylko widok z przodu.

Przykład:
    python3 tools/character-scan/scan.py scan reference.png \
        --out output/character-scan/aiko --height-mm 1800
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

VERSION = 1
FONT_CANDIDATES = (
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
)


def fail(message: str) -> "NoReturn":  # type: ignore[name-defined]
    print(f"Błąd: {message}", file=sys.stderr)
    raise SystemExit(1)


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def background_mask(rgb: np.ndarray, threshold: int = 12) -> np.ndarray:
    corners = np.array(
        [rgb[0, 0], rgb[0, -1], rgb[-1, 0], rgb[-1, -1]], dtype=np.int16
    )
    background = np.median(corners, axis=0)
    distance = np.abs(rgb.astype(np.int16) - background).max(axis=2)
    return distance > threshold


def load_image(path: Path) -> tuple[np.ndarray, np.ndarray, str]:
    """Zwraca RGB, maskę postaci i tryb wejścia."""
    try:
        image = Image.open(path)
    except OSError as error:
        fail(f"nie mogę otworzyć obrazu {path}: {error}")

    has_alpha = image.mode in ("RGBA", "LA") or "transparency" in image.info
    if has_alpha:
        data = np.asarray(image.convert("RGBA"))
        alpha = data[..., 3]
        rgb = data[..., :3].copy()
        # Render zapisany jako RGBA, ale w pełni nieprzezroczysty: użyj tła.
        if (alpha < 250).mean() >= 0.005:
            mask = alpha > 127
            if not mask.any():
                fail("kanał alfa jest w całości przezroczysty — brak sylwetki")
            return rgb, mask, "alpha"
    else:
        rgb = np.asarray(image.convert("RGB")).copy()

    mask = background_mask(rgb)
    if not mask.any():
        fail("maska postaci jest pusta — sprawdź tło lub kanał alfa")
    return rgb, mask, "background"


def row_runs(row: np.ndarray) -> list[tuple[int, int]]:
    xs = np.flatnonzero(row)
    if xs.size == 0:
        return []
    breaks = np.flatnonzero(np.diff(xs) > 1)
    starts = np.r_[xs[0], xs[breaks + 1]]
    ends = np.r_[xs[breaks], xs[-1]]
    return [(int(a), int(b)) for a, b in zip(starts, ends)]


def median_smooth(values: np.ndarray, y0: int, y1: int, window: int = 21) -> np.ndarray:
    result = np.zeros_like(values, dtype=float)
    segment = values[y0 : y1 + 1].astype(float)
    pad = window // 2
    padded = np.pad(segment, pad, mode="edge")
    view = np.lib.stride_tricks.sliding_window_view(padded, window)
    result[y0 : y1 + 1] = np.median(view, axis=1)
    return result


def detect_axis(mask: np.ndarray, y0: int, height: int) -> int:
    """Pionowa oś torsu: mediana środków najszerszego przebiegu w pasie 42–52%."""
    centers = []
    for y in range(y0 + int(0.42 * height), y0 + int(0.52 * height) + 1):
        runs = row_runs(mask[y])
        if not runs:
            continue
        widest = max(runs, key=lambda run: run[1] - run[0])
        centers.append((widest[0] + widest[1]) / 2)
    if not centers:
        xs = np.flatnonzero(mask.any(axis=0))
        return int((xs[0] + xs[-1]) / 2)
    return int(round(float(np.median(centers))))


def detect_crotch(
    mask: np.ndarray, y0: int, y1: int, axis: int, height: int, width: int
) -> int | None:
    min_run = max(3, int(0.015 * height))
    for y in range(y0 + int(0.55 * height), y1 + 1):
        runs = [run for run in row_runs(mask[y]) if run[1] - run[0] + 1 >= min_run]
        if len(runs) < 2:
            continue
        best = None
        for left, right in zip(runs, runs[1:]):
            gap = right[0] - left[1] - 1
            if gap < 2:
                continue
            center = (left[1] + right[0]) / 2
            if abs(center - axis) <= 0.06 * width:
                if best is None or gap > best[0]:
                    best = (gap, y)
        if best:
            return best[1]
    return None


@dataclass
class Landmark:
    name: str
    label: str
    y: int
    y_ratio: float
    width_px: int
    width_ratio: float
    width_mm: float
    note: str = ""


def palette(rgb: np.ndarray, mask: np.ndarray, k: int = 8, step: int = 4) -> list[dict]:
    ys, xs = np.nonzero(mask)
    take = slice(None, None, step)
    ys, xs = ys[take], xs[take]
    pixels = rgb[ys, xs].astype(float)
    if len(pixels) < k:
        return []

    rng = np.random.default_rng(7)
    centers = pixels[rng.choice(len(pixels), k, replace=False)].copy()
    for _ in range(20):
        distance = ((pixels[:, None, :] - centers[None, :, :]) ** 2).sum(axis=2)
        labels = distance.argmin(axis=1)
        for index in range(k):
            chosen = labels == index
            if chosen.any():
                centers[index] = pixels[chosen].mean(axis=0)

    distance = ((pixels[:, None, :] - centers[None, :, :]) ** 2).sum(axis=2)
    labels = distance.argmin(axis=1)

    out = []
    total = len(pixels)
    for index in range(k):
        chosen = labels == index
        count = int(chosen.sum())
        if count == 0:
            continue
        color = centers[index].round().astype(int)
        h, s, v = __import__("colorsys").rgb_to_hsv(*(color / 255.0))
        if v < 0.18:
            name = "ciemny"
        elif s < 0.12:
            name = "biały/szary" if v > 0.85 else "neutralny"
        elif h < 0.05 or h >= 0.90:
            name = "róż/czerwień"
        elif h < 0.12:
            name = "brąz/pomarańcz" if v < 0.80 else "beż"
        elif h < 0.20:
            name = "żółty/beż"
        elif h < 0.45:
            name = "zielony"
        elif h < 0.58:
            name = "turkus/cyjan"
        elif h < 0.75:
            name = "niebieski"
        elif h < 0.90:
            name = "fiolet"
        else:
            name = "mieszany"
        out.append(
            {
                "name": name,
                "hex": "#{:02x}{:02x}{:02x}".format(*color),
                "rgb": [int(c) for c in color],
                "share": round(count / total, 4),
                "bbox_px": [
                    int(xs[chosen].min()),
                    int(ys[chosen].min()),
                    int(xs[chosen].max()),
                    int(ys[chosen].max()),
                ],
                "mean_y_ratio": round(float(ys[chosen].mean()) / rgb.shape[0], 4),
            }
        )
    return sorted(out, key=lambda item: item["share"], reverse=True)


def measure(path: Path, height_mm: float) -> tuple[dict, np.ndarray, np.ndarray]:
    rgb, mask, mode = load_image(path)
    image_height, image_width = mask.shape

    rows = np.flatnonzero(mask.any(axis=1))
    cols = np.flatnonzero(mask.any(axis=0))
    y0, y1 = int(rows[0]), int(rows[-1])
    x0, x1 = int(cols[0]), int(cols[-1])
    height = y1 - y0 + 1
    width = x1 - x0 + 1

    x_index = np.arange(image_width)
    left = np.where(mask, x_index, image_width).min(axis=1)
    right = np.where(mask, x_index, -1).max(axis=1)
    widths = np.where(mask.any(axis=1), right - left + 1, 0)
    smooth = median_smooth(widths, y0, y1)

    def ratio(value: int) -> float:
        return round((value - y0) / max(1, height - 1), 4)

    def mm(px: int | float) -> float:
        return round(float(px) * height_mm / height, 2)

    clipped = {
        "left": bool(mask[:, 0].any()),
        "right": bool(mask[:, -1].any()),
        "top": bool(mask[0, :].any()),
        "bottom": bool(mask[-1, :].any()),
    }

    axis = detect_axis(mask, y0, height)
    crotch_y = detect_crotch(mask, y0, y1, axis, height, width)
    if crotch_y is None:
        crotch_y = y0 + int(0.62 * height)

    head_y = y0 + int(0.05 * height) + int(
        np.argmax(smooth[y0 + int(0.05 * height) : y0 + int(0.32 * height)])
    )
    arm_y = int(np.argmax(smooth))

    waist_lo = arm_y + int(0.04 * height)
    waist_hi = max(waist_lo + 1, crotch_y - int(0.04 * height))
    waist_y = waist_lo + int(np.argmin(smooth[waist_lo:waist_hi]))
    hip_y = waist_y + int(np.argmax(smooth[waist_y:crotch_y]))
    lower_lo = crotch_y + int(0.05 * height)
    lower_hi = max(lower_lo + 1, y1 - int(0.05 * height))
    lower_y = lower_lo + int(np.argmin(smooth[lower_lo:lower_hi]))
    ground_lo = max(y0, y1 - int(0.01 * height))
    ground_width = int(np.max(smooth[ground_lo : y1 + 1]))

    landmarks = [
        Landmark("top_of_head", "Czubek głowy", y0, ratio(y0), 0, 0.0, 0.0,
                 "początek sylwetki; szerokość niemiarodajna"),
        Landmark("head_max", "Największa szerokość głowy/włosów", head_y,
                 ratio(head_y), int(smooth[head_y]), 0.0, 0.0),
        Landmark("arm_span", "Największa szerokość (rozpiętość)", arm_y,
                 ratio(arm_y), int(smooth[arm_y]), 0.0, 0.0,
                 "przybliżenie; rekwizyty i kadr mogą zafałszować"),
        Landmark("waist", "Najwęższy tors", waist_y, ratio(waist_y),
                 int(smooth[waist_y]), 0.0, 0.0),
        Landmark("hip", "Najszersze biodra", hip_y, ratio(hip_y),
                 int(smooth[hip_y]), 0.0, 0.0,
                 "sylwetka może obejmować plecak i rekwizyty"),
        Landmark("crotch", "Krok (rozdzielenie nóg)", crotch_y, ratio(crotch_y),
                 int(smooth[crotch_y]), 0.0, 0.0),
        Landmark("lower_leg_min", "Najwęższy przekrój nóg", lower_y, ratio(lower_y),
                 int(smooth[lower_y]), 0.0, 0.0),
        Landmark("ground", "Podstawa stóp", y1, ratio(y1), ground_width, 0.0, 0.0,
                 "maksymalna szerokość w ostatnim 1% wysokości"),
    ]
    for item in landmarks:
        item.width_ratio = round(item.width_px / height, 4)
        item.width_mm = mm(item.width_px)

    central_half = int(0.15 * width)
    left_band = max(0, axis - central_half)
    right_band = min(image_width, axis + central_half + 1)
    central = mask[:, left_band:right_band]
    mirrored = np.fliplr(central)
    union = np.logical_or(central, mirrored).sum()
    symmetry = float(np.logical_and(central, mirrored).sum() / union) if union else 0.0

    warnings = []
    if clipped["left"] or clipped["right"]:
        warnings.append(
            "kadr przycina sylwetkę w poziomie — rozpiętość ramion i szerokości "
            "przy krawędzi są wartościami minimalnymi"
        )
    if clipped["top"] or clipped["bottom"]:
        warnings.append("kadr przycina sylwetkę w pionie — wysokość jest niepełna")
    hip_runs = row_runs(mask[hip_y])
    if len(hip_runs) > 1:
        warnings.append(
            "w rzędzie bioder wykryto kilka przebiegów — pomiar może obejmować "
            "rekwizyty lub włosy"
        )

    data = {
        "tool": "character-scan",
        "version": VERSION,
        "source": str(path),
        "image": {"width": image_width, "height": image_height, "mask": mode},
        "scale": {
            "height_mm": float(height_mm),
            "height_px": height,
            "mm_per_px": round(height_mm / height, 4),
        },
        "character": {
            "bbox_px": [x0, y0, x1, y1],
            "width_px": width,
            "height_px": height,
            "axis_x": axis,
            "clipped": clipped,
        },
        "landmarks": [asdict(item) for item in landmarks],
        "ratios": {
            "legs": round((y1 - crotch_y) / height, 4),
            "arm_span_to_height": round(float(smooth[arm_y]) / height, 4),
            "waist_to_height": round(float(smooth[waist_y]) / height, 4),
            "hip_to_height": round(float(smooth[hip_y]) / height, 4),
        },
        "symmetry": {
            "iou_central": round(symmetry, 4),
            "band_px": [left_band, right_band],
        },
        "palette": palette(rgb, mask),
        "warnings": warnings,
    }
    return data, rgb, mask


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font, max_width: int) -> list[str]:
    lines: list[str] = []
    current = ""
    for word in text.split():
        candidate = f"{current} {word}".strip()
        if not current or draw.textlength(candidate, font=font) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_overlay(data: dict, rgb: np.ndarray, mask: np.ndarray) -> Image.Image:
    stacked = np.dstack([rgb, (mask.astype(np.uint8) * 255)])
    rgba = Image.fromarray(stacked, "RGBA")
    white = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
    base = Image.alpha_composite(white, rgba).convert("RGB")
    draw = ImageDraw.Draw(base, "RGBA")

    width, height = base.size
    small = load_font(max(13, width // 55))
    character = data["character"]
    x0, y0, x1, y1 = character["bbox_px"]
    axis = character["axis_x"]

    colors = {
        "top_of_head": (40, 40, 40),
        "head_max": (200, 40, 120),
        "arm_span": (230, 120, 10),
        "waist": (0, 150, 110),
        "hip": (150, 70, 200),
        "crotch": (210, 40, 40),
        "lower_leg_min": (0, 130, 160),
        "ground": (40, 40, 40),
    }

    draw.rectangle([x0, y0, x1, y1], outline=(30, 30, 30, 120), width=2)
    for y in range(y0, y1 + 1, 24):
        draw.line([(axis, y), (axis, min(y + 12, y1))], fill=(30, 30, 30, 90), width=1)

    for item in data["landmarks"]:
        color = colors.get(item["name"], (80, 80, 80))
        y = item["y"]
        draw.line([(x0, y), (x1, y)], fill=color + (190,), width=2)
        draw.line([(x0, y - 8), (x0, y + 8)], fill=color + (255,), width=3)
        draw.line([(x1, y - 8), (x1, y + 8)], fill=color + (255,), width=3)
        if item["width_px"]:
            text = (
                f"{item['label']}: {item['width_px']} px | "
                f"{item['width_mm']:.1f} mm | {item['width_ratio'] * 100:.1f}% H"
            )
        else:
            text = f"{item['label']}: y={item['y']} ({item['y_ratio'] * 100:.1f}%)"
        box = draw.textbbox((0, 0), text, font=small)
        text_width = box[2] - box[0]
        text_height = box[3] - box[1]
        tx = x0 + 12 if x0 + 12 + text_width < width else max(8, x1 - text_width - 12)
        ty = max(4, y - text_height - 8)
        draw.rectangle(
            [tx - 5, ty - 3, tx + text_width + 5, ty + text_height + 3],
            fill=(255, 255, 255, 215),
        )
        draw.text((tx, ty), text, font=small, fill=color + (255,))

    footer = (
        f"{data['scale']['height_px']} px = {data['scale']['height_mm']:.0f} mm | "
        f"{data['scale']['mm_per_px']:.3f} mm/px | "
        f"symetria {data['symmetry']['iou_central'] * 100:.1f}%"
    )
    if data["warnings"]:
        footer += " | UWAGA: " + " ".join(data["warnings"])
    footer_lines = wrap_text(draw, footer, small, width - 24)
    line_height = int(small.getbbox("Ag")[3] * 1.35) + 4
    footer_height = len(footer_lines) * line_height + 12
    draw.rectangle(
        [0, height - footer_height, width, height], fill=(255, 255, 255, 235)
    )
    for index, line in enumerate(footer_lines):
        draw.text(
            (12, height - footer_height + 6 + index * line_height),
            line,
            font=small,
            fill=(20, 20, 20),
        )

    return base


def write_report(data: dict, path: Path) -> None:
    lines = [
        "# Pomiar postaci z referencji",
        "",
        f"- Źródło: `{data['source']}`",
        f"- Obraz: {data['image']['width']} × {data['image']['height']} px",
        f"- Wysokość postaci: {data['scale']['height_px']} px = "
        f"{data['scale']['height_mm']:.0f} mm",
        f"- Skala: {data['scale']['mm_per_px']:.3f} mm/px",
        f"- BBox: {data['character']['bbox_px']}",
        f"- Symetria (pas centralny): "
        f"{data['symmetry']['iou_central'] * 100:.1f}%",
        "",
        "## Punkty pomiarowe",
        "",
        "| Punkt | y | % wysokości | szerokość px | szerokość mm | % wysokości |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for item in data["landmarks"]:
        lines.append(
            f"| {item['label']} | {item['y']} | {item['y_ratio'] * 100:.1f}% | "
            f"{item['width_px']} | {item['width_mm']:.1f} | "
            f"{item['width_ratio'] * 100:.1f}% |"
        )
    lines += ["", "## Proporcje", ""]
    for key, value in data["ratios"].items():
        lines.append(f"- `{key}`: {value * 100:.1f}% wysokości")
    lines += ["", "## Paleta", "", "| Kolor | HEX | Udział | Zakres Y |", "| --- | --- | ---: | ---: |"]
    for item in data["palette"]:
        lines.append(
            f"| {item['name']} | `{item['hex']}` | {item['share'] * 100:.1f}% | "
            f"{item['mean_y_ratio'] * 100:.0f}% |"
        )
    if data["warnings"]:
        lines += ["", "## Ostrzeżenia", ""]
        lines += [f"- {warning}" for warning in data["warnings"]]
    lines += [
        "",
        "## Ograniczenia",
        "",
        "Pomiar dotyczy wyłącznie widocznego przodu. Nie opisuje głębokości, "
        "tyłu postaci ani ukrytych powierzchni. Wartości w milimetrach zależą "
        "od podanej wysokości odniesienia, a nie od skali zapisanej w obrazie.",
        "",
    ]
    path.write_text("\n".join(lines), encoding="utf-8")


def command_scan(args: argparse.Namespace) -> int:
    source = args.image.expanduser()
    if not source.is_file():
        fail(f"nie ma pliku: {source}")
    out_dir = args.out.expanduser()
    out_dir.mkdir(parents=True, exist_ok=True)

    data, rgb, mask = measure(source, args.height_mm)
    (out_dir / "measurements.json").write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    with (out_dir / "width-profile.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["y", "y_ratio", "left", "right", "width_px"])
        y0, y1 = data["character"]["bbox_px"][1], data["character"]["bbox_px"][3]
        for y in range(y0, y1 + 1):
            row = np.flatnonzero(mask[y])
            if row.size:
                writer.writerow(
                    [
                        y,
                        round((y - y0) / max(1, data["character"]["height_px"] - 1), 5),
                        int(row[0]),
                        int(row[-1]),
                        int(row[-1] - row[0] + 1),
                    ]
                )

    overlay = draw_overlay(data, rgb, mask)
    overlay.save(out_dir / "overlay.png")
    write_report(data, out_dir / "report.md")

    print(f"Zapisano: {out_dir}")
    print(
        f"Wysokość {data['scale']['height_px']} px = "
        f"{data['scale']['height_mm']:.0f} mm "
        f"({data['scale']['mm_per_px']:.3f} mm/px)"
    )
    for item in data["landmarks"]:
        if item["width_px"]:
            print(f"  {item['label']:<34} {item['width_mm']:8.1f} mm")
    for warning in data["warnings"]:
        print(f"  UWAGA: {warning}")
    return 0


def mask_to_canvas(
    mask: np.ndarray, target_height: int, canvas_width: int, canvas_height: int
) -> np.ndarray:
    rows = np.flatnonzero(mask.any(axis=1))
    cols = np.flatnonzero(mask.any(axis=0))
    crop = mask[rows[0] : rows[-1] + 1, cols[0] : cols[-1] + 1]
    scale = target_height / crop.shape[0]
    new_width = max(1, int(round(crop.shape[1] * scale)))
    resized = Image.fromarray((crop * 255).astype(np.uint8)).resize(
        (new_width, target_height), Image.Resampling.NEAREST
    )
    array = np.asarray(resized) > 127
    canvas = np.zeros((canvas_height, canvas_width), dtype=bool)
    x = (canvas_width - new_width) // 2
    y = canvas_height - target_height
    canvas[y : y + target_height, x : x + new_width] = array
    return canvas


def command_compare(args: argparse.Namespace) -> int:
    reference_path = args.reference.expanduser()
    candidate_path = args.candidate.expanduser()
    for path in (reference_path, candidate_path):
        if not path.is_file():
            fail(f"nie ma pliku: {path}")

    ref_data, _, ref_mask = measure(reference_path, args.height_mm)
    cand_data, _, cand_mask = measure(candidate_path, args.height_mm)
    ref_height = ref_data["scale"]["height_px"]
    cand_height = cand_data["scale"]["height_px"]

    canvas_height = ref_height + 20
    canvas_width = max(
        ref_data["character"]["width_px"], cand_data["character"]["width_px"]
    ) + 40
    ref_canvas = mask_to_canvas(ref_mask, ref_height, canvas_width, canvas_height)
    cand_canvas = mask_to_canvas(cand_mask, ref_height, canvas_width, canvas_height)

    intersection = np.logical_and(ref_canvas, cand_canvas).sum()
    union = np.logical_or(ref_canvas, cand_canvas).sum()
    iou = float(intersection / union) if union else 0.0

    ref_axis = ref_data["character"]["axis_x"]
    deltas = []
    for fraction in (0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9):
        ref_row = int(round(ref_data["character"]["bbox_px"][1] + fraction * ref_height))
        cand_row = int(round(cand_data["character"]["bbox_px"][1] + fraction * cand_height))
        ref_row = min(ref_row, ref_data["character"]["bbox_px"][3])
        cand_row = min(cand_row, cand_data["character"]["bbox_px"][3])
        ref_runs = row_runs(ref_mask[ref_row])
        cand_runs = row_runs(cand_mask[cand_row])
        ref_width = (ref_runs[-1][1] - ref_runs[0][0] + 1) / ref_height if ref_runs else 0
        cand_width = (cand_runs[-1][1] - cand_runs[0][0] + 1) / cand_height if cand_runs else 0
        deltas.append(
            {
                "fraction": fraction,
                "reference": round(ref_width, 4),
                "candidate": round(cand_width, 4),
                "delta": round(cand_width - ref_width, 4),
            }
        )

    result = {
        "tool": "character-scan",
        "version": VERSION,
        "reference": str(reference_path),
        "candidate": str(candidate_path),
        "reference_height_px": ref_height,
        "candidate_height_px": cand_height,
        "height_ratio": round(cand_height / ref_height, 4),
        "silhouette_iou": round(iou, 4),
        "width_at_fraction": deltas,
        "reference_axis_x": ref_axis,
        "warnings": [
            "IoU porównuje tylko widok z przodu; nie ocenia głębokości, tyłu, "
            "topologii ani jakości ruchu.",
        ],
    }
    if ref_data["warnings"] or cand_data["warnings"]:
        result["warnings"].extend(ref_data["warnings"] + cand_data["warnings"])

    out_dir = args.out.expanduser()
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "compare.json").write_text(
        json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    overlay = np.full((canvas_height, canvas_width, 3), 255, dtype=np.uint8)
    overlay[ref_canvas] = [210, 60, 60]
    overlay[cand_canvas] = [60, 90, 210]
    overlay[np.logical_and(ref_canvas, cand_canvas)] = [110, 70, 160]
    image = Image.fromarray(overlay)
    draw = ImageDraw.Draw(image)
    font = load_font(max(16, canvas_width // 40))
    draw.text(
        (12, 8),
        f"IoU {iou * 100:.1f}% | referencja czerwona, kandydat niebieski",
        font=font,
        fill=(20, 20, 20),
    )
    image.save(out_dir / "compare.png")

    print(f"Zapisano: {out_dir}")
    print(f"IoU sylwetki (przód): {iou * 100:.1f}%")
    print(f"Wysokość kandydata / referencji: {cand_height / ref_height:.3f}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Pomiar postaci z referencji 2D")
    subparsers = parser.add_subparsers(dest="command", required=True)

    scan = subparsers.add_parser("scan", help="zmierz pojedynczą referencję")
    scan.add_argument("image", type=Path, help="obraz PNG/JPG/WebP z widokiem z przodu")
    scan.add_argument("--out", type=Path, default=Path("output/character-scan"))
    scan.add_argument("--height-mm", type=float, default=1800.0,
                      help="wysokość odniesienia w milimetrach (domyślnie 1800)")
    scan.set_defaults(func=command_scan)

    compare = subparsers.add_parser("compare", help="porównaj sylwetkę z renderem")
    compare.add_argument("reference", type=Path)
    compare.add_argument("candidate", type=Path)
    compare.add_argument("--out", type=Path, default=Path("output/character-scan/compare"))
    compare.add_argument("--height-mm", type=float, default=1800.0)
    compare.set_defaults(func=command_compare)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
