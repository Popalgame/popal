#!/usr/bin/env python3
"""Zrzut lokalnego API Blendera do JSONL — uruchamiaj wewnątrz Blendera.

Przykład:
    blender -b --factory-startup --python tools/blender-api/dump_api.py -- \
        --out output/blender-api/api.jsonl

Indeks jest generowany z zainstalowanej wersji, więc opisuje dokładnie to
API, które jest dostępne w tej sesji. Nie zastępuje dokumentacji manuala:
zbiera operatorów, typy RNA, właściwości i funkcje modułów Pythona.
"""

from __future__ import annotations

import argparse
import importlib
import inspect
import json
import sys
import traceback

import bpy


MODULES = (
    "bpy",
    "bpy.app",
    "bpy.path",
    "bpy.props",
    "bpy.utils",
    "bpy.msgbus",
    "mathutils",
    "bmesh",
    "bpy_extras",
    "gpu",
    "blf",
    "imbuf",
    "aud",
    "idprop",
)


def version() -> str:
    return ".".join(str(part) for part in bpy.app.version)


def short(value, limit: int = 200):
    """Wartość bezpieczna dla JSON; długie obiekty tylko jako repr."""
    if value is None or isinstance(value, (bool, int, float, str)):
        if isinstance(value, float) and (value != value or value in (float("inf"), float("-inf"))):
            return repr(value)
        if isinstance(value, str) and len(value) > limit:
            return value[:limit] + "…"
        return value
    if isinstance(value, (list, tuple)):
        if len(value) > 32:
            return repr(value)[:limit] + "…"
        return [short(item, limit) for item in value]
    if isinstance(value, dict):
        if len(value) > 32:
            return repr(value)[:limit] + "…"
        return {str(key): short(item, limit) for key, item in value.items()}
    text = repr(value)
    return text if len(text) <= limit else text[:limit] + "…"


def enum_items(prop) -> list[dict]:
    try:
        return [
            {
                "id": item.identifier,
                "name": item.name,
                "description": getattr(item, "description", ""),
            }
            for item in prop.enum_items
        ]
    except Exception:
        return []


def property_record(prop) -> dict:
    return {
        "identifier": prop.identifier,
        "name": getattr(prop, "name", ""),
        "type": getattr(prop, "type", ""),
        "subtype": getattr(prop, "subtype", ""),
        "unit": getattr(prop, "unit", ""),
        "description": getattr(prop, "description", ""),
        "default": short(getattr(prop, "default", None)),
        "readonly": bool(getattr(prop, "is_readonly", False)),
        "required": bool(getattr(prop, "is_required", False)),
        "optional": bool(getattr(prop, "is_argument_optional", False)),
        "output": bool(getattr(prop, "is_output", False)),
        "enum_items": enum_items(prop),
    }


def rna_properties(rna) -> list[dict]:
    result = []
    for prop in rna.properties:
        if prop.identifier == "rna_type":
            continue
        try:
            result.append(property_record(prop))
        except Exception:
            continue
    return result


def body_for(item: dict) -> str:
    parts = [item.get("description", "")]
    for parameter in item.get("parameters", []):
        parts.append(parameter.get("identifier", ""))
        parts.append(parameter.get("description", ""))
        parts.extend(entry.get("id", "") for entry in parameter.get("enum_items", []))
    for prop in item.get("properties", []):
        parts.append(prop.get("identifier", ""))
        parts.append(prop.get("description", ""))
        parts.extend(entry.get("id", "") for entry in prop.get("enum_items", []))
    return " ".join(part for part in parts if part)


def dump_operators() -> list[dict]:
    records = []
    for category_name in sorted(dir(bpy.ops)):
        if category_name.startswith("_"):
            continue
        category = getattr(bpy.ops, category_name, None)
        if category is None:
            continue
        for operator_name in sorted(dir(category)):
            if operator_name.startswith("_"):
                continue
            operator = getattr(category, operator_name, None)
            if operator is None or not hasattr(operator, "get_rna_type"):
                continue
            try:
                rna = operator.get_rna_type()
            except Exception:
                continue
            parameters = rna_properties(rna)
            path = f"bpy.ops.{category_name}.{operator_name}"
            record = {
                "kind": "operator",
                "path": path,
                "name": operator_name,
                "category": category_name,
                "signature": "(" + ", ".join(p["identifier"] for p in parameters) + ")",
                "description": getattr(rna, "description", "") or "",
                "parameters": parameters,
                "version": version(),
            }
            record["body"] = body_for(record)
            records.append(record)
    return records


def rna_method_records(rna, owner_path: str) -> list[dict]:
    """Metody typów RNA: `bl_rna.functions`, z parametrami i opisami."""
    records = []
    for function in getattr(rna, "functions", ()):
        identifier = getattr(function, "identifier", "")
        if not identifier or identifier.startswith("_"):
            continue
        parameters = []
        for parameter in getattr(function, "parameters", ()):
            try:
                parameters.append(property_record(parameter))
            except Exception:
                continue
        record = {
            "kind": "method",
            "path": f"{owner_path}.{identifier}",
            "name": identifier,
            "owner": owner_path,
            "signature": "("
            + ", ".join(
                p["identifier"] for p in parameters if not p.get("output")
            )
            + ")",
            "description": getattr(function, "description", "") or "",
            "parameters": parameters,
            "version": version(),
        }
        record["body"] = body_for(record)
        records.append(record)
    return records


def method_records(owner_path: str, cls) -> list[dict]:
    records = []
    for name, member in getattr(cls, "__dict__", {}).items():
        if name.startswith("_"):
            continue
        if not (inspect.isroutine(member) or inspect.ismethoddescriptor(member)):
            continue
        signature = ""
        try:
            signature = str(inspect.signature(member))
        except Exception:
            signature = getattr(member, "__text_signature__", "") or ""
        description = inspect.getdoc(member) or ""
        record = {
            "kind": "method",
            "path": f"{owner_path}.{name}",
            "name": name,
            "owner": owner_path,
            "signature": signature,
            "description": description,
            "version": version(),
        }
        record["body"] = description
        records.append(record)
    return records


def inherited_identifiers(cls) -> set[str]:
    inherited = set()
    for base in getattr(cls, "__mro__", ())[1:]:
        base_rna = getattr(base, "bl_rna", None)
        if base_rna is not None:
            inherited.update(
                prop.identifier
                for prop in base_rna.properties
                if prop.identifier != "rna_type"
            )
    return inherited


def dump_types() -> list[dict]:
    records = []
    for type_name in sorted(dir(bpy.types)):
        if type_name.startswith("_"):
            continue
        cls = getattr(bpy.types, type_name, None)
        rna = getattr(cls, "bl_rna", None)
        if rna is None:
            continue
        inherited = inherited_identifiers(cls)
        # Rekord typu opisuje właściwości zdefiniowane bezpośrednio na nim.
        # Odziedziczone są w rekordach typów bazowych, więc nie powielamy
        # całej hierarchii RNA przy każdym typie.
        properties = [
            prop for prop in rna_properties(rna) if prop["identifier"] not in inherited
        ]
        bases = [
            base.__name__
            for base in getattr(cls, "__mro__", ())[1:4]
            if base is not object
        ]
        record = {
            "kind": "type",
            "path": f"bpy.types.{type_name}",
            "name": type_name,
            "bases": bases,
            "description": getattr(rna, "description", "") or "",
            "properties": properties,
            "version": version(),
        }
        record["body"] = body_for(record)
        records.append(record)
        records.extend(rna_method_records(rna, record["path"]))

        for prop in properties:
            prop_record = dict(prop)
            prop_record.update(
                {
                    "kind": "property",
                    "path": f"bpy.types.{type_name}.{prop['identifier']}",
                    "name": prop["identifier"],
                    "owner": f"bpy.types.{type_name}",
                    "description": prop.get("description", ""),
                    "version": version(),
                }
            )
            prop_record["body"] = body_for(prop_record)
            records.append(prop_record)
    return records


def dump_modules() -> list[dict]:
    records = []
    seen = set()
    for module_name in MODULES:
        try:
            module = importlib.import_module(module_name)
        except Exception as error:
            print(f"pomijam {module_name}: {error}", file=sys.stderr)
            continue
        for name in sorted(dir(module)):
            if name.startswith("_"):
                continue
            try:
                obj = getattr(module, name)
            except Exception:
                continue
            path = f"{module_name}.{name}"
            if path in seen:
                continue
            seen.add(path)
            try:
                if inspect.isfunction(obj) or inspect.isbuiltin(obj) or inspect.ismethoddescriptor(obj):
                    signature = ""
                    try:
                        signature = str(inspect.signature(obj))
                    except Exception:
                        signature = getattr(obj, "__text_signature__", "") or ""
                    record = {
                        "kind": "function",
                        "path": path,
                        "name": name,
                        "module": module_name,
                        "signature": signature,
                        "description": inspect.getdoc(obj) or "",
                        "version": version(),
                    }
                    record["body"] = record["description"]
                    records.append(record)
                elif inspect.isclass(obj) and module_name != "bpy":
                    record = {
                        "kind": "class",
                        "path": path,
                        "name": name,
                        "module": module_name,
                        "description": inspect.getdoc(obj) or "",
                        "version": version(),
                    }
                    record["body"] = record["description"]
                    records.append(record)
                    records.extend(method_records(path, obj))
            except Exception:
                traceback.print_exc(file=sys.stderr)
                continue
    return records


def main() -> int:
    parser = argparse.ArgumentParser(description="Zrzuć API Blendera do JSONL")
    parser.add_argument("--out", required=True, help="ścieżka pliku JSONL")
    parser.add_argument(
        "--only",
        choices=("all", "operators", "types", "modules"),
        default="all",
        help="ogranicz zrzut do jednej kategorii",
    )
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else None)

    print(f"Blender {bpy.app.version_string} ({bpy.app.binary_path})", file=sys.stderr)
    records = []
    if args.only in ("all", "operators"):
        records.extend(dump_operators())
        print(f"operatorzy: {len(records)}", file=sys.stderr)
    if args.only in ("all", "types"):
        before = len(records)
        records.extend(dump_types())
        print(f"typy i właściwości: {len(records) - before}", file=sys.stderr)
    if args.only in ("all", "modules"):
        before = len(records)
        records.extend(dump_modules())
        print(f"moduły: {len(records) - before}", file=sys.stderr)

    # Ten sam path nie może wystąpić dwa razy; pierwszy wpis wygrywa.
    unique = {}
    for record in records:
        unique.setdefault(record["path"], record)
    records = sorted(unique.values(), key=lambda item: item["path"])

    with open(args.out, "w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False, default=str) + "\n")
    print(f"zapisano {len(records)} rekordów do {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
