#!/usr/bin/env python3
"""Indeks i wyszukiwarka lokalnego API Blendera.

Zrzut wykonuje `dump_api.py` wewnątrz Blendera. Ten skrypt działa poza
Blenderem, korzysta wyłącznie ze standardowej biblioteki Pythona i buduje
SQLite FTS5.

Przykłady:
    python3 tools/blender-api/blender_api.py build \
        --input output/blender-api/api.jsonl --db output/blender-api/api.sqlite
    python3 tools/blender-api/blender_api.py query "bevel modifier width"
    python3 tools/blender-api/blender_api.py show bpy.ops.mesh.primitive_cube_add
    python3 tools/blender-api/blender_api.py stats
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = ROOT / "output" / "blender-api" / "api.jsonl"
DEFAULT_DB = ROOT / "output" / "blender-api" / "api.sqlite"

SCHEMA = """
CREATE TABLE records (
    path TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    signature TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    data TEXT NOT NULL
);
CREATE VIRTUAL TABLE search USING fts5(
    path UNINDEXED,
    kind UNINDEXED,
    name,
    aliases,
    signature,
    description,
    body,
    tokenize = 'unicode61 remove_diacritics 2'
);
"""


def alias_tokens(value: str) -> str:
    """Rozbij CamelCase, podkreślenia i kropki na osobne słowa."""
    spaced = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", value)
    return re.sub(r"[^A-Za-z0-9]+", " ", spaced).strip()


def fail(message: str) -> "NoReturn":  # type: ignore[name-defined]
    print(f"Błąd: {message}", file=sys.stderr)
    raise SystemExit(1)


def connect(path: Path) -> sqlite3.Connection:
    if not path.is_file():
        fail(f"nie ma bazy {path} — najpierw uruchom build")
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    return connection


def build_index(input_path: Path, db_path: Path) -> dict:
    if not input_path.is_file():
        fail(f"nie ma pliku wejściowego {input_path}")

    db_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = db_path.with_suffix(db_path.suffix + ".tmp")
    if temporary.exists():
        temporary.unlink()

    connection = sqlite3.connect(temporary)
    try:
        connection.executescript(SCHEMA)
        count = 0
        with input_path.open(encoding="utf-8") as handle:
            for line_number, line in enumerate(handle, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                except json.JSONDecodeError as error:
                    fail(f"{input_path}:{line_number}: niepoprawny JSON: {error}")
                path = record.get("path")
                if not path:
                    fail(f"{input_path}:{line_number}: brak pola path")
                name = record.get("name") or path.rsplit(".", 1)[-1]
                signature = record.get("signature") or ""
                description = record.get("description") or ""
                body = record.get("body") or description
                aliases = alias_tokens(f"{name} {path}")
                connection.execute(
                    "INSERT OR REPLACE INTO records"
                    " (path, kind, name, signature, description, body, data)"
                    " VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (
                        path,
                        record.get("kind", "unknown"),
                        name,
                        signature,
                        description,
                        body,
                        json.dumps(record, ensure_ascii=False),
                    ),
                )
                connection.execute(
                    "INSERT INTO search"
                    " (path, kind, name, aliases, signature, description, body)"
                    " VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (
                        path,
                        record.get("kind", "unknown"),
                        name,
                        aliases,
                        signature,
                        description,
                        body,
                    ),
                )
                count += 1
        connection.commit()
    finally:
        connection.close()

    os.replace(temporary, db_path)
    return {"records": count, "database": str(db_path)}


def search_expression(term: str) -> str:
    tokens = re.findall(r"[A-Za-z0-9_]+", term)
    if not tokens:
        fail("zapytanie nie zawiera żadnego słowa")
    # OR daje szersze wyniki; ranking FTS5 i tak stawia najlepsze dopasowania
    # najwyżej. Gwiazdka obsługuje prefiksy, np. "primitive_cube".
    return " OR ".join(f'"{token}"*' for token in tokens)


def query_index(
    db_path: Path, term: str, kind: str | None = None, limit: int = 10
) -> list[dict]:
    if not 1 <= limit <= 200:
        fail("limit musi być w zakresie 1..200")
    connection = connect(db_path)
    try:
        sql = (
            "SELECT path, kind, name, signature, description,"
            " snippet(search, 6, '[', ']', '…', 20) AS snippet"
            " FROM search WHERE search MATCH ?"
        )
        parameters: list[object] = [search_expression(term)]
        if kind:
            sql += " AND kind = ?"
            parameters.append(kind)
        sql += " ORDER BY rank LIMIT ?"
        parameters.append(limit)
        rows = connection.execute(sql, parameters).fetchall()
        return [dict(row) for row in rows]
    finally:
        connection.close()


def show_record(db_path: Path, path: str) -> dict | None:
    connection = connect(db_path)
    try:
        row = connection.execute(
            "SELECT data FROM records WHERE path = ?", (path,)
        ).fetchone()
        if row is None:
            row = connection.execute(
                "SELECT data FROM records WHERE path LIKE ? ORDER BY length(path) LIMIT 1",
                (f"%{path}",),
            ).fetchone()
        return json.loads(row["data"]) if row else None
    finally:
        connection.close()


def stats(db_path: Path) -> dict:
    connection = connect(db_path)
    try:
        kinds = {
            row["kind"]: row["count"]
            for row in connection.execute(
                "SELECT kind, COUNT(*) AS count FROM records GROUP BY kind ORDER BY kind"
            )
        }
        total = connection.execute("SELECT COUNT(*) FROM records").fetchone()[0]
        versions = [
            row[0]
            for row in connection.execute(
                "SELECT DISTINCT json_extract(data, '$.version') FROM records"
                " WHERE json_extract(data, '$.version') IS NOT NULL"
            )
        ]
        return {"records": total, "kinds": kinds, "versions": sorted(versions)}
    finally:
        connection.close()


def print_result(result: dict) -> None:
    kind = result["kind"]
    print(f"{result['path']}  [{kind}]")
    if result.get("signature"):
        print(f"  {result['signature']}")
    description = (result.get("description") or "").strip()
    if description:
        text = " ".join(description.split())
        print(f"  {text[:400]}{'…' if len(text) > 400 else ''}")


def command_build(args: argparse.Namespace) -> int:
    result = build_index(args.input.expanduser(), args.db.expanduser())
    print(f"Zaindeksowano {result['records']} rekordów: {result['database']}")
    return 0


def command_query(args: argparse.Namespace) -> int:
    results = query_index(args.db.expanduser(), args.term, args.kind, args.limit)
    if args.json:
        print(json.dumps(results, indent=2, ensure_ascii=False))
    elif not results:
        print("Brak wyników.")
    else:
        for index, result in enumerate(results):
            if index:
                print()
            print_result(result)
    return 0 if results else 1


def command_show(args: argparse.Namespace) -> int:
    record = show_record(args.db.expanduser(), args.path)
    if record is None:
        print(f"Nie znaleziono: {args.path}", file=sys.stderr)
        return 1
    if args.summary:
        print_result(record)
        for parameter in record.get("parameters", []):
            print(f"  - {parameter['identifier']}: {parameter.get('description', '')}")
        if record.get("properties"):
            print(f"  właściwości: {len(record['properties'])}")
    else:
        print(json.dumps(record, indent=2, ensure_ascii=False))
    return 0


def command_stats(args: argparse.Namespace) -> int:
    result = stats(args.db.expanduser())
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Indeks API Blendera")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    subparsers = parser.add_subparsers(dest="command", required=True)

    build = subparsers.add_parser("build", help="zbuduj indeks z JSONL")
    build.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    build.set_defaults(func=command_build)

    query = subparsers.add_parser("query", help="wyszukaj operator, typ lub funkcję")
    query.add_argument("term")
    query.add_argument("--kind", choices=("operator", "type", "property", "function", "class"))
    query.add_argument("--limit", type=int, default=10)
    query.add_argument("--json", action="store_true")
    query.set_defaults(func=command_query)

    show = subparsers.add_parser("show", help="pokaż pełny rekord")
    show.add_argument("path")
    show.add_argument("--summary", action="store_true")
    show.set_defaults(func=command_show)

    stats_parser = subparsers.add_parser("stats", help="podsumuj indeks")
    stats_parser.set_defaults(func=command_stats)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
