"""Run with: blender -b --factory-startup --python tests/blender_regressions.py

Uses a private temporary bridge directory and does not touch the open GUI Blender.
"""

import importlib.util
import json
import os
from pathlib import Path
import tempfile
import time
import uuid

import bpy


ADDON = Path(__file__).resolve().parents[1] / "blender_ai_addon.py"
ROOT = Path(tempfile.mkdtemp(prefix="blender-ai-regressions-"))
os.environ["BLENDER_AI_BRIDGE_DIR"] = str(ROOT)


def load_module(name):
    spec = importlib.util.spec_from_file_location(name, ADDON)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


bridge = load_module("blender_ai_addon")
bridge.register()


def envelope(method, params=None, *, scene_id=None, seconds=60):
    request = {
        "id": str(uuid.uuid4()), "method": method, "params": params or {},
        "expires_at": time.time() + seconds,
    }
    if scene_id is not None:
        request["scene_id"] = scene_id
    return request


def call(method, params=None, *, scene_id=None):
    response = bridge.process_request(envelope(method, params, scene_id=scene_id))
    return response


def queue(request):
    path = ROOT / "requests" / (request["id"] + ".json")
    path.write_text(json.dumps(request), encoding="utf-8")
    return path


def drain(ids):
    for _ in range(12):
        bridge._poll()
        if all((ROOT / "responses" / (item + ".json")).is_file() for item in ids):
            break
    assert all((ROOT / "responses" / (item + ".json")).is_file() for item in ids)
    return {item: json.loads((ROOT / "responses" / (item + ".json")).read_text()) for item in ids}


# Malformed, expired, and symbolic-link requests each fail independently.
expired = envelope("ping", seconds=-1)
queue(expired)
invalid_id = str(uuid.uuid4())
(ROOT / "requests" / (invalid_id + ".json")).write_text("{broken", encoding="utf-8")
outside = ROOT / "outside-secret.txt"
outside.write_text("secret should never enter a response", encoding="utf-8")
symlink_id = str(uuid.uuid4())
(ROOT / "requests" / (symlink_id + ".json")).symlink_to(outside)
valid = envelope("ping")
queue(valid)
responses = drain([expired["id"], invalid_id, symlink_id, valid["id"]])
assert responses[expired["id"]]["error"]["code"] == "EXPIRED"
assert responses[invalid_id]["error"]["code"] == "INVALID_REQUEST"
assert responses[symlink_id]["error"]["code"] == "INVALID_REQUEST"
assert "secret should never" not in json.dumps(responses)
assert responses[valid["id"]]["ok"]
assert not list((ROOT / "processing").iterdir())
print("QUEUE_OK")


# A protected object can share mesh data; changing another object's material
# must copy that mesh and cover polygons that formerly used other slots.
cube = bpy.data.objects["Cube"]
shared = bpy.data.objects.new("UnprotectedShared", cube.data)
bpy.context.scene.collection.objects.link(shared)
old_a = bpy.data.materials.new("OriginalA")
old_b = bpy.data.materials.new("OriginalB")
cube.data.materials.clear()
cube.data.materials.append(old_a)
cube.data.materials.append(old_b)
for polygon in cube.data.polygons:
    polygon.material_index = 1
profile_path = ROOT / "profile.json"
profile = json.loads(profile_path.read_text(encoding="utf-8"))
profile["protected_objects"] = ["Cube"]
profile_path.write_text(json.dumps(profile), encoding="utf-8")
scene_id = bridge.get_scene_id()
change = call("apply_batch", {"operations": [{
    "op": "set_material", "name": "UnprotectedShared", "material": "NewMaterial",
    "color": [0.2, 0.4, 0.6, 1.0],
}]}, scene_id=scene_id)
assert change["ok"], change
assert shared.data is not cube.data
assert all(polygon.material_index == 0 for polygon in shared.data.polygons)
assert all(polygon.material_index == 1 for polygon in cube.data.polygons)
assert cube.data.materials[1] is old_b
protected_edit = call("apply_batch", {"operations": [{
    "op": "set_transform", "name": "Cube", "location": [1, 2, 3],
}]}, scene_id=scene_id)
assert protected_edit["error"]["code"] == "PROTECTED"
print("PROTECTED_MATERIAL_OK")


camera = call("apply_batch", {"operations": [{
    "op": "create_camera", "name": "BridgeCamera", "location": [4, 4, 4], "target": [0, 0, 0],
}]}, scene_id=scene_id)
assert camera["ok"] and bpy.context.scene.camera.name == "BridgeCamera", camera
first_scene = bpy.context.scene
other_scene = bpy.data.scenes.new("Second Scene")
bpy.context.window.scene = other_scene
other_id = bridge.get_scene_id()
assert other_id != scene_id
stale = call("apply_batch", {"operations": []}, scene_id=scene_id)
assert stale["error"]["code"] == "SCENE_CHANGED"
off_scene = call("apply_batch", {"operations": [{
    "op": "set_transform", "name": "UnprotectedShared", "location": [1, 2, 3],
}]}, scene_id=other_id)
assert off_scene["error"]["code"] == "NOT_IN_SCENE"
bpy.context.window.scene = first_scene
before_load = bridge.get_scene_id()
assert before_load != other_id


# A second module instance cannot claim the root or overwrite owner status on stop.
second = load_module("blender_ai_second")
owner_status = (ROOT / "status.json").read_bytes()
try:
    second.start_bridge()
except second.BridgeError as exc:
    assert exc.code == "BRIDGE_BUSY"
else:
    raise AssertionError("Second owner started")
second.stop_bridge()
assert (ROOT / "status.json").read_bytes() == owner_status
second._CLASSES = ()  # This module never registered Blender UI classes.
second.unregister()
assert (ROOT / "status.json").read_bytes() == owner_status
assert json.loads(owner_status)["running"] is True
print("TWO_OWNERS_OK")


# A real .blend load resets Blender's driver namespace. The persistent handler
# restores ownership and the timer must still accept a queued request.
blend_path = ROOT / "reload-test.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(blend_path), copy=True, check_existing=False)
bpy.ops.wm.open_mainfile(filepath=str(blend_path))
after_load = bridge.get_scene_id()
assert after_load != before_load
assert bpy.app.driver_namespace.get(bridge._NAMESPACE_KEY) == bridge._TOKEN
assert bpy.app.timers.is_registered(bridge._poll)
after_request = envelope("ping")
queue(after_request)
assert drain([after_request["id"]])[after_request["id"]]["ok"]
assert json.loads((ROOT / "status.json").read_text())["scene_id"] == after_load
print("SCENE_RELOAD_OK")

bridge.unregister()
assert json.loads((ROOT / "status.json").read_text())["running"] is False
print("BLENDER_REGRESSIONS_OK", ROOT)
