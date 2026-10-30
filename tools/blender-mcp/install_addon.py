"""Run with: blender --background --python tools/blender-mcp/install_addon.py.

Copies the add-on and enables it in existing user preferences. Does not save or
open a scene. To load into an already open Blender, enable it there as well.
"""

import json
import os
from pathlib import Path
import shutil
import tempfile
import time

import addon_utils
import bpy


source = Path(__file__).resolve().with_name("blender_ai_addon.py")
destination_dir = Path(bpy.utils.user_resource("SCRIPTS", path="addons", create=True))
destination = destination_dir / source.name
if destination.exists() and destination.read_bytes() != source.read_bytes():
    backup = destination.with_suffix(".py.bak-" + time.strftime("%Y%m%d-%H%M%S"))
    shutil.copy2(destination, backup)
shutil.copy2(source, destination)

# Installation runs in its own Blender process and must not take the live
# session's queue. The enabled add-on uses its usual directory on next launch.
with tempfile.TemporaryDirectory(prefix="blender-ai-install-") as temporary:
    os.environ["BLENDER_AI_BRIDGE_DIR"] = temporary
    bpy.utils.refresh_script_paths()
    addon_utils.modules_refresh()
    module = addon_utils.enable("blender_ai_addon", default_set=True, persistent=True)
    if module is None:
        raise RuntimeError("Could not enable Blender AI Bridge")
    bpy.ops.wm.save_userpref()
    module.stop_bridge()
print(json.dumps({"addon_path": str(destination), "enabled": True}))
