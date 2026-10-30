"""Disposable Blender process used by the full MCP integration test."""
import os
from pathlib import Path
import sys
import time

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import blender_ai_addon as addon

# This process is disposable; keep the demo free of factory startup objects.
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)
addon.register()
root = addon.bridge_root()
deadline = time.monotonic() + 240
try:
    while time.monotonic() < deadline and not (root / "stop-test-service").exists():
        addon._poll()
        time.sleep(0.01)
finally:
    addon.unregister()
