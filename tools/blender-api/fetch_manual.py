#!/usr/bin/env python3
"""Pobierz wybrane rozdziały manuala Blendera 5.2 i zapisz jako tekst.

Narzędzie działa poza Blenderem, korzysta wyłącznie ze standardowej
biblioteki. Pobiera skąpą, dobraną listę stron (topologia, rig, wagi,
eksport glTF, zarządzanie kolorem), bo celem jest przeszukiwalny zbiór
ostrzeżeń i przepływów, a nie lustro całego manuala.

Przykład:
    python3 tools/blender-api/fetch_manual.py \
        --out output/blender-api/manual --version 5.2
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from html.parser import HTMLParser
from pathlib import Path
from urllib import error, request

BASE = "https://docs.blender.org/manual/en/{version}/{path}"

PAGES = [
    "modeling/meshes/structure.html",
    "modeling/meshes/retopology.html",
    "modeling/modifiers/generate/decimate.html",
    "modeling/modifiers/deform/armature.html",
    "modeling/meshes/editing/mesh/normals.html",
    "animation/armatures/properties/introduction.html",
    "animation/actions.html",
    "sculpt_paint/weight_paint/editing.html",
    "sculpt_paint/weight_paint/usage.html",
    "addons/import_export/scene_gltf2.html",
    "render/color_management/displays_views.html",
    "render/materials/assignment.html",
    "scene_layout/object/origin.html",
    "files/blend/open_save.html",
]


class TextExtractor(HTMLParser):
    """Zamień HTML manuala na tekst: tytuł, nagłówki i akapity."""

    SKIP = {"script", "style", "nav", "footer", "header", "svg", "noscript"}
    BLOCK = {
        "p", "h1", "h2", "h3", "h4", "h5", "li", "tr", "pre", "div",
        "section", "table", "ul", "ol", "br", "dt", "dd",
    }

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.chunks: list[str] = []
        self._skip_depth = 0
        self._title_depth = 0
        self._line: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:  # noqa: ANN001
        if tag in self.SKIP:
            self._skip_depth += 1
            return
        if self._skip_depth:
            return
        if tag == "title":
            self._title_depth += 1
        if tag in self.BLOCK and self._line:
            self._flush()

    def handle_endtag(self, tag: str) -> None:
        if tag in self.SKIP and self._skip_depth:
            self._skip_depth -= 1
            return
        if self._skip_depth:
            return
        if tag == "title":
            self._title_depth = max(0, self._title_depth - 1)
        if tag in self.BLOCK:
            self._flush()

    def handle_data(self, data: str) -> None:
        if self._skip_depth:
            return
        text = data.strip()
        if not text:
            return
        if self._title_depth:
            self.title = (self.title + " " + text).strip()
        else:
            self._line.append(text)

    def _flush(self) -> None:
        if self._line:
            self.chunks.append(" ".join(self._line))
            self._line = []

    def text(self) -> str:
        self._flush()
        lines: list[str] = []
        for chunk in self.chunks:
            if len(chunk) < 3:
                continue
            lines.append(chunk)
        # Usuń duplikaty sąsiednich linii (powtarzane nagłówki szablonu).
        deduped: list[str] = []
        for line in lines:
            if deduped and deduped[-1] == line:
                continue
            deduped.append(line)
        return "\n\n".join(deduped)


def fetch(url: str, timeout: float = 30.0) -> str:
    request_obj = request.Request(url, headers={"User-Agent": "polpal-agent/1.0"})
    with request.urlopen(request_obj, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def slugify(page: str) -> str:
    slug = re.sub(r"\.html$", "", page)
    return re.sub(r"[^A-Za-z0-9]+", "-", slug).strip("-")


def save_page(page: str, html: str, out_dir: Path, version: str) -> Path:
    extractor = TextExtractor()
    extractor.feed(html)
    title = extractor.title or page
    body = extractor.text()
    url = BASE.format(version=version, path=page)
    path = out_dir / f"{slugify(page)}.md"
    front = (
        f"# {title}\n\n"
        f"URL: {url}\n"
        f"Source: Blender {version} Manual (CC-BY-SA; blender.org)\n"
    )
    path.write_text(front + "\n" + body + "\n", encoding="utf-8")
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Pobierz strony manuala Blendera")
    parser.add_argument("--out", type=Path,
                        default=Path("output/blender-api/manual"))
    parser.add_argument("--version", default="5.2")
    parser.add_argument("--delay", type=float, default=0.4,
                        help="pauza między żądaniami w sekundach")
    args = parser.parse_args(argv)

    out_dir = args.out.expanduser()
    out_dir.mkdir(parents=True, exist_ok=True)

    results = {"fetched": [], "failed": []}
    for page in PAGES:
        url = BASE.format(version=args.version, path=page)
        try:
            html = fetch(url)
            path = save_page(page, html, out_dir, args.version)
            results["fetched"].append({"page": page, "file": str(path)})
            print(f"OK   {page}")
        except error.HTTPError as exception:
            results["failed"].append({"page": page, "error": str(exception)})
            print(f"HTTP {page}: {exception}", file=sys.stderr)
        except (error.URLError, TimeoutError, OSError) as exception:
            results["failed"].append({"page": page, "error": str(exception)})
            print(f"NET  {page}: {exception}", file=sys.stderr)
        time.sleep(args.delay)

    summary = out_dir / "fetch-summary.json"
    summary.write_text(
        json.dumps(results, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {"fetched": len(results["fetched"]), "failed": len(results["failed"])},
            ensure_ascii=False,
        )
    )
    return 0 if results["fetched"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
