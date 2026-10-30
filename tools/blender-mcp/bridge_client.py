"""Dependency-free local client. Blender handles requests on its main thread."""

from __future__ import annotations

import json
import math
import os
from pathlib import Path
import tempfile
import time
import uuid


class BridgeError(RuntimeError):
    def __init__(self, code: str, message: str, details: dict | None = None):
        super().__init__(message)
        self.code = code
        self.details = details or {}

    def as_dict(self) -> dict:
        return {"code": self.code, "message": str(self), "details": self.details}


def bridge_root() -> Path:
    return Path(os.environ.get("BLENDER_AI_BRIDGE_DIR", "~/.local/share/blender-ai-bridge")).expanduser()


def atomic_json(path: Path, value: dict) -> None:
    """Publish a complete UTF-8 message; readers never see partial JSON."""
    payload = json.dumps(value, ensure_ascii=False, allow_nan=False).encode("utf-8")
    if len(payload) > 1024 * 1024:
        raise BridgeError("request_too_large", "Request exceeds 1 MiB.")
    descriptor, temporary = tempfile.mkstemp(prefix=".pending-", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(payload)
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)


class BridgeClient:
    def __init__(self, root: Path | str | None = None):
        self.root = Path(root) if root is not None else bridge_root()
        if self.root.is_symlink():
            raise BridgeError("invalid_directory", "Bridge directory must not be a symlink.")
        for directory in (self.root, *(self.root / name for name in ("requests", "responses", "processing"))):
            if directory.is_symlink():
                raise BridgeError("invalid_directory", "Queue directories must not be symlinks.")
            directory.mkdir(mode=0o700, parents=True, exist_ok=True)
            if os.name != "nt":
                directory.chmod(0o700)

    def status(self) -> dict:
        path = self.root / "status.json"
        try:
            result = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(result, dict):
                raise ValueError("Status must be an object")
            return result
        except (OSError, ValueError) as exc:
            raise BridgeError("not_connected", "Blender AI Bridge is not running. Enable the add-on in Blender.") from exc

    def _response(self, path: Path, request_id: str) -> dict | None:
        if not path.exists():
            return None
        if path.is_symlink() or path.stat().st_size > 4 * 1024 * 1024:
            raise BridgeError("invalid_response", "Response is invalid or exceeds 4 MiB.")
        response = json.loads(path.read_text(encoding="utf-8"))
        path.unlink()
        if not isinstance(response, dict) or response.get("id") != request_id:
            raise BridgeError("invalid_response", "Response ID does not match request.")
        if response.get("ok") is not True:
            error = response.get("error", {})
            raise BridgeError(error.get("code", "blender_error"), error.get("message", "Blender request failed."), error.get("details"))
        return response.get("result", {})

    def call(self, method: str, params: dict | None = None, *, scene_id: str | None = None, timeout: float = 30) -> dict:
        if not math.isfinite(timeout) or not 0 < timeout <= 600:
            raise ValueError("Timeout must be between 0 and 600 seconds.")
        status = self.status()
        if status.get("running") is False:
            raise BridgeError("not_connected", "Blender AI Bridge is stopped. Click Start in Blender's AI Bridge panel.")
        request_id = str(uuid.uuid4())
        request_path = self.root / "requests" / f"{request_id}.json"
        response_path = self.root / "responses" / f"{request_id}.json"
        request = {"id": request_id, "method": method, "params": params or {}, "expires_at": time.time() + timeout}
        if scene_id is not None:
            request["scene_id"] = scene_id
        atomic_json(request_path, request)
        deadline = time.monotonic() + timeout
        while True:
            result = self._response(response_path, request_id)
            if result is not None:
                return result
            if time.monotonic() >= deadline:
                try:
                    request_path.unlink()
                    uncertain = False
                except FileNotFoundError:
                    # It may already be executing; never retry a mutation automatically.
                    result = self._response(response_path, request_id)
                    if result is not None:
                        return result
                    uncertain = True
                raise BridgeError("timeout", "Blender did not respond before the deadline. Inspect the scene before retrying." if uncertain else "Blender did not start the request; the queued request was cancelled.", {"request_id": request_id, "may_have_executed": uncertain})
            time.sleep(min(0.025, max(0, deadline - time.monotonic())))
