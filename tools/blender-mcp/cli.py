"""JSON CLI for AI agents that do not support MCP. No dependencies required."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from bridge_client import BridgeClient, BridgeError


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bridge-dir", type=Path)
    parser.add_argument("--timeout", type=float, default=30)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("status")
    scene = sub.add_parser("scene")
    scene.add_argument("--limit", type=int, default=100)
    sub.add_parser("profile")
    for name in ("batch", "preview", "save", "python"):
        command = sub.add_parser(name)
        command.add_argument("--scene-id", required=True, help="scene_id from a fresh scene/status call")
        if name in ("batch", "python"):
            command.add_argument("file", type=Path)
        if name in ("batch", "save", "python"):
            command.add_argument("--label", default="AI task")
        if name == "preview":
            command.add_argument("--max-size", type=int, default=512)
            command.add_argument("--samples", type=int, default=8)
    args = parser.parse_args()
    try:
        client = BridgeClient(args.bridge_dir)
        params = {}
        method = {"status": "ping", "scene": "get_scene", "profile": "get_profile", "batch": "apply_batch", "save": "save_copy", "python": "execute_python"}.get(args.command, args.command)
        if args.command == "scene":
            params = {"limit": args.limit}
        elif args.command == "batch":
            value = json.loads(args.file.read_text(encoding="utf-8"))
            params = {"operations": value if isinstance(value, list) else value["operations"], "label": args.label}
        elif args.command == "python":
            params = {"code": args.file.read_text(encoding="utf-8"), "label": args.label}
        elif args.command == "preview":
            params = {"max_size": args.max_size, "samples": args.samples}
        elif args.command == "save":
            params = {"label": args.label}
        result = client.call(method, params, scene_id=getattr(args, "scene_id", None), timeout=args.timeout)
        print(json.dumps({"ok": True, "result": result}, ensure_ascii=False, allow_nan=False))
        return 0
    except BridgeError as exc:
        error = exc.as_dict()
    except (OSError, ValueError, KeyError, TypeError) as exc:
        error = {"code": "invalid_input", "message": str(exc)}
    print(json.dumps({"ok": False, "error": error}, ensure_ascii=False))
    return 1


if __name__ == "__main__":
    sys.exit(main())
