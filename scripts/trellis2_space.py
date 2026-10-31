#!/usr/bin/env python3
"""Obraz -> model 3D (.glb) przez oficjalny Space Microsoftu: microsoft/TRELLIS.2.

Model działa na GPU Hugging Face, więc lokalnie nie trzeba CUDA ani 24 GB VRAM.
Na M4 16 GB zostaje tylko wynik: plik .glb (kilka-kilkadziesiąt MB).

Przykład:
    .venv-trellis/bin/python scripts/trellis2_space.py obraz.png --resolution 1024

Autoryzacja (ważne — anonimowy limit ZeroGPU to ~2 min dziennie):
    hf auth login
albo:
    HF_TOKEN=hf_... .venv-trellis/bin/python scripts/trellis2_space.py obraz.png

Wymaga: pip install gradio_client (patrz .venv-trellis w repo).
"""

from __future__ import annotations

import argparse
import os
import random
import shutil
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path
from typing import NoReturn

SPACE = "microsoft/TRELLIS.2"

# Domyślne parametry /image_to_3d z gradio_api/info Space'a.
DEFAULTS = {
    "ss_guidance_strength": 7.5,
    "ss_guidance_rescale": 0.7,
    "ss_rescale_t": 5.0,
    "shape_slat_guidance_strength": 7.5,
    "shape_slat_guidance_rescale": 0.5,
    "shape_slat_rescale_t": 3.0,
    "tex_slat_guidance_strength": 1.0,
    "tex_slat_guidance_rescale": 0.0,
    "tex_slat_rescale_t": 3.0,
}


def fail(message: str) -> NoReturn:
    print(f"Błąd: {message}", file=sys.stderr)
    raise SystemExit(1)


def resolve_token(explicit: str | None) -> str | None:
    if explicit:
        return explicit
    if os.environ.get("HF_TOKEN"):
        return os.environ["HF_TOKEN"]
    try:
        from huggingface_hub import get_token

        return get_token()
    except Exception:
        return None


def unique_path(path: Path) -> Path:
    if not path.exists():
        return path
    for index in range(2, 1000):
        candidate = path.with_name(f"{path.stem}-{index}{path.suffix}")
        if not candidate.exists():
            return candidate
    fail(f"nie mogę znaleźć wolnej nazwy dla {path}")


def as_local_file(value: object) -> Path | None:
    """gradio_client zwraca ścieżkę, dict FileData albo krotkę/listę."""
    if isinstance(value, (list, tuple)):
        for item in value:
            found = as_local_file(item)
            if found:
                return found
        return None
    if isinstance(value, dict):
        value = value.get("path") or value.get("url")
        if not value:
            return None
    if isinstance(value, str) and value:
        candidate = Path(value)
        if candidate.is_file():
            return candidate
    return None


def explain(error: Exception, *, token: str | None, timeout: float) -> NoReturn:
    text = str(error)
    lowered = text.lower()
    if "zerogpu quota" in lowered:
        hint = "Zaloguj się (`hf auth login`) — darmowe konto ma większy limit, PRO jeszcze większy." if not token else "Dzienny limit ZeroGPU wyczerpany — wróć jutro albo użyj własnego GPU."
        fail(f"limit darmowego GPU Space'a przekroczony.\n{text}\n{hint}")
    if "401" in text or "invalid token" in lowered or "unauthorized" in lowered:
        fail("Space odrzucił token. Wygeneruj nowy: https://huggingface.co/settings/tokens")
    if "timeout" in lowered:
        fail(f"przekroczono limit {timeout:.0f}s. Spróbuj --resolution 512 albo zwiększ --timeout.")
    fail(text)


def write_note(target: Path, *, image: Path, args: argparse.Namespace, seed: int, glb: Path) -> Path:
    note = target.with_suffix(".md")
    body = f"""---
type: trellis2-asset
model: microsoft/TRELLIS.2-4B
source_image: "{image.name}"
seed: {seed}
resolution: {args.resolution}
generated: {date.today().isoformat()}
---

# {glb.stem}

Plik: [[{glb.name}]]

Wygenerowano z `{image.name}` przez oficjalny Space Microsoftu.
Parametry: seed `{seed}`, rozdzielczość `{args.resolution}`, kroki `{args.steps}`,
dekodowanie `{args.decimation}` trójkątów, tekstura `{args.texture}px`.

> Model wykonał się na GPU Hugging Face. Lokalnie nie ma wag ani CUDA.
"""
    note.write_text(body, encoding="utf-8")
    return note


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="TRELLIS.2 (HF Space) -> .glb")
    parser.add_argument("image", type=Path, help="obraz wejściowy (PNG/JPG/WebP)")
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("output/trellis2"),
        help="katalog wynikowy (domyślnie output/trellis2)",
    )
    parser.add_argument(
        "--vault",
        type=Path,
        help="katalog w vaulcie Obsidiana; nadpisuje --out i dopisuje notatkę .md",
    )
    parser.add_argument("--resolution", choices=("512", "1024", "1536"), default="1024")
    parser.add_argument("--seed", type=int, default=-1, help="-1 = losowy")
    parser.add_argument("--steps", type=int, default=12, help="kroki próbkowania (1-50)")
    parser.add_argument("--decimation", type=int, default=300_000, help="docelowa liczba trójkątów")
    parser.add_argument("--texture", type=int, default=2048, help="rozmiar tekstury w px")
    parser.add_argument("--space", default=SPACE, help="inny Space/instancja (np. własna)")
    parser.add_argument("--token", help="token HF (albo HF_TOKEN, albo `hf auth login`)")
    parser.add_argument("--note", action="store_true", help="zapisz notatkę .md obok .glb")
    parser.add_argument("--timeout", type=float, default=900.0, help="limit sekund na generację")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    image = args.image.expanduser()
    if not image.is_file():
        fail(f"nie ma pliku obrazu: {image}")

    out_dir = (args.vault.expanduser() / "TRELLIS2") if args.vault else args.out
    out_dir.mkdir(parents=True, exist_ok=True)

    try:
        from gradio_client import Client, handle_file
    except ImportError:
        fail(
            "brak gradio_client. Uruchom:\n"
            "  python3 -m venv .venv-trellis\n"
            "  .venv-trellis/bin/pip install gradio_client"
        )

    token = resolve_token(args.token)
    seed = args.seed if args.seed >= 0 else random.randint(0, 2**31 - 1)

    print(f"Space:  {args.space}")
    print(f"Obraz:  {image}")
    print(f"Seed:   {seed}")
    if not token:
        print("Token:  BRAK (limit ZeroGPU będzie minimalny — patrz `hf auth login`)")
    print("Łączę się z Space (kolejka może chwilę potrwać)...")

    client = Client(args.space, token=token, verbose=False)

    # Space trzyma stan sesji; bez tego /extract_glb nie ma czego pobrać.
    try:
        client.predict(api_name="/start_session")
    except Exception:
        pass  # starsza wersja Space może nie mieć tego endpointu

    def generate() -> object:
        print("Generuję geometrię i teksturę (zwykle 1-3 min)...")
        client.predict(
            handle_file(str(image)),
            seed,
            args.resolution,
            DEFAULTS["ss_guidance_strength"],
            DEFAULTS["ss_guidance_rescale"],
            args.steps,
            DEFAULTS["ss_rescale_t"],
            DEFAULTS["shape_slat_guidance_strength"],
            DEFAULTS["shape_slat_guidance_rescale"],
            args.steps,
            DEFAULTS["shape_slat_rescale_t"],
            DEFAULTS["tex_slat_guidance_strength"],
            DEFAULTS["tex_slat_guidance_rescale"],
            args.steps,
            DEFAULTS["tex_slat_rescale_t"],
            api_name="/image_to_3d",
        )
        print("Eksportuję GLB...")
        return client.predict(args.decimation, args.texture, api_name="/extract_glb")

    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            result = pool.submit(generate).result(timeout=args.timeout)
    except SystemExit:
        raise
    except Exception as error:  # noqa: BLE001 - chcemy czytelny komunikat, nie stacktrace
        explain(error, token=token, timeout=args.timeout)

    source = as_local_file(result)
    if not source:
        fail(f"Space nie zwrócił pliku GLB (otrzymano: {result!r})")

    target = unique_path(out_dir / f"{image.stem}-{seed}.glb")
    shutil.copy2(source, target)
    print(f"Zapisano: {target}  ({target.stat().st_size / 1_048_576:.1f} MB)")

    if args.note or args.vault:
        note = write_note(target, image=image, args=args, seed=seed, glb=target)
        print(f"Notatka:  {note}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
