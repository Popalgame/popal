"""Local, file-queue bridge for controlled Blender scene operations.

The queue has at-most-once dispatch, not transactional execution. A client must
inspect the scene after a timeout: a crashed request may already have changed it.
"""

bl_info = {
    "name": "Blender AI Bridge",
    "author": "Polpal",
    "version": (1, 0, 0),
    "blender": (4, 3, 0),
    "location": "View3D > Sidebar > AI Bridge",
    "description": "Private local file queue for controlled AI scene edits",
    "category": "Development",
}

import json
import math
import os
if os.name == "nt":
    import msvcrt
else:
    import fcntl
from pathlib import Path
import re
import stat
import time
import uuid

import bmesh
import bpy
from bpy.app.handlers import persistent
from bpy.props import BoolProperty
from mathutils import Vector


BRIDGE_VERSION = "1.0"
MAX_REQUEST_BYTES = 1024 * 1024
MAX_CODE_BYTES = 64 * 1024
_DEFAULT_PROFILE = {
    "name": "Polpal",
    "working_collection": "AI_Work",
    "notes": "Objects created by the AI Bridge belong in AI_Work.",
    "protected_objects": [],
    "protected_collections": [],
}
_SCENE_ID = str(uuid.uuid4())
_ACTIVE_SCENE_PTR = None
_PYTHON_OVERRIDE = None
_RUNNING = False
_LOCK_FD = None
_START_ERROR = None
_LAST_HEARTBEAT = 0.0
_TOKEN = str(uuid.uuid4())
_NAMESPACE_KEY = "polpal_blender_ai_bridge_owner"
_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


class BridgeError(Exception):
    def __init__(self, code, message, details=None):
        super().__init__(message)
        self.code = code
        self.details = details


def bridge_root():
    return Path(os.environ.get("BLENDER_AI_BRIDGE_DIR", "~/.local/share/blender-ai-bridge")).expanduser()


def get_scene_id():
    _sync_scene_id()
    return _SCENE_ID


def _sync_scene_id():
    global _SCENE_ID, _ACTIVE_SCENE_PTR
    scene = getattr(bpy.context, "scene", None)
    if scene is None:
        return
    pointer = scene.as_pointer()
    if _ACTIVE_SCENE_PTR is None:
        _ACTIVE_SCENE_PTR = pointer
    elif pointer != _ACTIVE_SCENE_PTR:
        _ACTIVE_SCENE_PTR = pointer
        _SCENE_ID = str(uuid.uuid4())


def set_python_enabled(enabled):
    """Headless/testing override; the UI preference remains off by default."""
    global _PYTHON_OVERRIDE
    _PYTHON_OVERRIDE = bool(enabled)


def _python_enabled():
    if _PYTHON_OVERRIDE is not None:
        return _PYTHON_OVERRIDE
    addon = bpy.context.preferences.addons.get(__name__)
    return bool(addon and addon.preferences.allow_python)


def _directories():
    root = bridge_root()
    for path in (root, *(root / name for name in ("requests", "processing", "responses", "checkpoints", "previews", "exports"))):
        if path.is_symlink():
            raise BridgeError("UNSAFE_PATH", "Bridge directories cannot be symbolic links")
        path.mkdir(mode=0o700, parents=True, exist_ok=True)
        if not path.is_dir():
            raise BridgeError("UNSAFE_PATH", "Bridge path is not a directory")
        path.chmod(0o700)
    return root


def _atomic_json(path, payload):
    temp = path.parent / ("." + str(uuid.uuid4()) + ".tmp")
    data = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8")
    try:
        with os.fdopen(os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)


def _heartbeat(busy=False, request_id=None, force=False):
    global _LAST_HEARTBEAT
    _sync_scene_id()
    now = time.time()
    if not force and not busy and now - _LAST_HEARTBEAT < 1:
        return
    _atomic_json(bridge_root() / "status.json", {
        "pid": os.getpid(), "scene_id": _SCENE_ID,
        "blender_version": bpy.app.version_string, "updated_at": now,
        "running": _RUNNING, "busy": busy, "request_id": request_id,
    })
    _LAST_HEARTBEAT = now


def _pid_alive(pid):
    if not isinstance(pid, int) or pid <= 0:
        return False
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def _lock_file(fd):
    if os.name == "nt":
        # msvcrt locks a byte range and releases it when the process exits.
        os.lseek(fd, 0, os.SEEK_SET)
        if os.fstat(fd).st_size == 0:
            os.write(fd, b"\0")
        os.lseek(fd, 0, os.SEEK_SET)
        try:
            msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
        except OSError as exc:
            raise BridgeError("BRIDGE_BUSY", "Another Blender process owns this bridge directory") from exc
    else:
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise BridgeError("BRIDGE_BUSY", "Another Blender process owns this bridge directory") from exc


def _unlock_file(fd):
    if os.name == "nt":
        os.lseek(fd, 0, os.SEEK_SET)
        msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
    else:
        fcntl.flock(fd, fcntl.LOCK_UN)


def _profile():
    root = _directories()
    path = root / "profile.json"
    if not path.exists():
        try:
            with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w", encoding="utf-8") as stream:
                json.dump(_DEFAULT_PROFILE, stream, indent=2, ensure_ascii=False)
                stream.write("\n")
        except FileExistsError:
            pass
    try:
        if path.is_symlink() or path.stat().st_size > MAX_REQUEST_BYTES:
            raise ValueError("unsafe or oversized profile")
        value = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(value, dict):
            raise ValueError("profile must be an object")
        for key in ("name", "working_collection", "notes"):
            if not isinstance(value.get(key), str):
                raise ValueError(key + " must be a string")
        if not value["working_collection"].strip():
            raise ValueError("working_collection cannot be empty")
        for key in ("protected_objects", "protected_collections"):
            items = value.get(key)
            if not isinstance(items, list) or not all(isinstance(item, str) for item in items):
                raise ValueError(key + " must be a list of names")
        return value
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        raise BridgeError("INVALID_PROFILE", str(exc)) from exc


def _uuid(value):
    if not isinstance(value, str) or not _UUID_RE.fullmatch(value):
        raise BridgeError("INVALID_REQUEST", "id must be a lowercase UUID")
    try:
        if str(uuid.UUID(value)) != value:
            raise ValueError()
    except ValueError as exc:
        raise BridgeError("INVALID_REQUEST", "id must be a UUID") from exc


def _finite(value):
    if isinstance(value, float) and not math.isfinite(value):
        raise BridgeError("INVALID_REQUEST", "Non-finite numbers are not allowed")
    if isinstance(value, dict):
        for item in value.values():
            _finite(item)
    elif isinstance(value, list):
        for item in value:
            _finite(item)


def _number(value, field, minimum=None, maximum=None):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise BridgeError("INVALID_PARAMS", field + " must be a finite number")
    if (minimum is not None and value < minimum) or (maximum is not None and value > maximum):
        raise BridgeError("INVALID_PARAMS", field + " is out of range")
    return float(value)


def _integer(value, field, minimum, maximum):
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum or value > maximum:
        raise BridgeError("INVALID_PARAMS", field + " must be an integer between %s and %s" % (minimum, maximum))
    return value


def _string(value, field):
    if not isinstance(value, str) or not value.strip() or len(value) > 128 or "\x00" in value:
        raise BridgeError("INVALID_PARAMS", field + " must be a nonempty string of at most 128 characters")
    return value


def _vector(value, field, count=3, minimum=None, maximum=None):
    if not isinstance(value, list) or len(value) != count:
        raise BridgeError("INVALID_PARAMS", field + " must have %d numbers" % count)
    return [_number(component, field, minimum, maximum) for component in value]


def _keys(value, allowed, required=()):
    if not isinstance(value, dict) or not set(required).issubset(value) or not set(value).issubset(allowed):
        raise BridgeError("INVALID_PARAMS", "Unexpected or missing parameters")


def _validate_operation(op):
    if not isinstance(op, dict) or not isinstance(op.get("op"), str):
        raise BridgeError("INVALID_PARAMS", "Each operation needs an op name")
    kind = op["op"]
    if kind == "create_object":
        _keys(op, {"op", "type", "name", "location", "rotation", "scale"}, {"op", "type", "name"})
        if op["type"] not in {"CUBE", "UV_SPHERE", "CYLINDER", "PLANE", "EMPTY"}:
            raise BridgeError("INVALID_PARAMS", "Unsupported object type")
        _string(op["name"], "name")
        for field in ("location", "rotation", "scale"):
            if field in op:
                _vector(op[field], field)
    elif kind == "set_transform":
        _keys(op, {"op", "name", "location", "rotation", "scale"}, {"op", "name"})
        _string(op["name"], "name")
        if not any(field in op for field in ("location", "rotation", "scale")):
            raise BridgeError("INVALID_PARAMS", "set_transform needs a transform")
        for field in ("location", "rotation", "scale"):
            if field in op:
                _vector(op[field], field)
    elif kind == "set_material":
        _keys(op, {"op", "name", "material", "color", "metallic", "roughness"}, {"op", "name", "material", "color"})
        _string(op["name"], "name")
        _string(op["material"], "material")
        _vector(op["color"], "color", 4, 0, 1)
        for field in ("metallic", "roughness"):
            if field in op:
                _number(op[field], field, 0, 1)
    elif kind == "create_camera":
        _keys(op, {"op", "name", "location", "target", "lens"}, {"op", "name", "location", "target"})
        _string(op["name"], "name")
        _vector(op["location"], "location")
        _vector(op["target"], "target")
        if op["location"] == op["target"]:
            raise BridgeError("INVALID_PARAMS", "Camera location and target must differ")
        if "lens" in op:
            _number(op["lens"], "lens", 1, 500)
    elif kind == "create_light":
        _keys(op, {"op", "name", "type", "location", "energy", "size", "target"}, {"op", "name", "type", "location", "energy"})
        _string(op["name"], "name")
        if op["type"] not in {"AREA", "POINT", "SUN"}:
            raise BridgeError("INVALID_PARAMS", "Unsupported light type")
        _vector(op["location"], "location")
        _number(op["energy"], "energy", 0, 100000000)
        if "size" in op:
            _number(op["size"], "size", 0.001, 100000)
        if "target" in op:
            _vector(op["target"], "target")
            if op["location"] == op["target"]:
                raise BridgeError("INVALID_PARAMS", "Light location and target must differ")
    elif kind == "set_render":
        _keys(op, {"op", "resolution_x", "resolution_y", "percentage", "engine", "samples"}, {"op", "resolution_x", "resolution_y"})
        _integer(op["resolution_x"], "resolution_x", 1, 16384)
        _integer(op["resolution_y"], "resolution_y", 1, 16384)
        if "percentage" in op:
            _integer(op["percentage"], "percentage", 1, 100)
        if "engine" in op and op["engine"] not in {"BLENDER_EEVEE", "CYCLES"}:
            raise BridgeError("INVALID_PARAMS", "Unsupported render engine")
        if "samples" in op:
            _integer(op["samples"], "samples", 1, 4096)
    elif kind == "set_camera":
        _keys(op, {"op", "name"}, {"op", "name"})
        _string(op["name"], "name")
    else:
        raise BridgeError("INVALID_PARAMS", "Unsupported operation: " + kind)


def _object(name, profile, expected_type=None):
    obj = bpy.data.objects.get(name)
    if obj is None:
        raise BridgeError("NOT_FOUND", "Object not found: " + name)
    if bpy.context.scene.objects.get(name) is not obj:
        raise BridgeError("NOT_IN_SCENE", "Object is outside the active scene: " + name)
    if expected_type and obj.type != expected_type:
        raise BridgeError("INVALID_PARAMS", name + " is not a " + expected_type.lower())
    protected = set(profile["protected_collections"])
    ancestors = set(obj.users_collection)
    for collection in bpy.data.collections:
        if collection.name in protected and any(child in collection.children_recursive for child in ancestors):
            ancestors.add(collection)
    if obj.name in profile["protected_objects"] or any(collection.name in protected for collection in ancestors):
        raise BridgeError("PROTECTED", "Object is protected: " + name)
    if obj.library or (obj.data and getattr(obj.data, "library", None)) or obj.is_library_indirect:
        raise BridgeError("READ_ONLY", "Linked object is read only: " + name)
    return obj


def _working_collection(profile):
    name = profile["working_collection"]
    if name in profile["protected_collections"]:
        raise BridgeError("PROTECTED", "Working collection is protected")
    collection = bpy.data.collections.get(name)
    if collection and any(parent.name in profile["protected_collections"] and
                          collection in parent.children_recursive for parent in bpy.data.collections):
        raise BridgeError("PROTECTED", "Working collection is inside a protected collection")
    if collection is None:
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
    elif collection.library or collection.is_library_indirect:
        raise BridgeError("READ_ONLY", "Working collection is linked")
    elif collection not in bpy.context.scene.collection.children_recursive:
        bpy.context.scene.collection.children.link(collection)
    return collection


def _checkpoint(label):
    directory = _directories() / "checkpoints"
    safe = re.sub(r"[^A-Za-z0-9_-]+", "-", label or "batch").strip("-")[:40] or "batch"
    path = directory / (time.strftime("%Y%m%d-%H%M%S") + "-" + safe + "-" + str(uuid.uuid4()) + ".blend")
    result = bpy.ops.wm.save_as_mainfile(filepath=str(path), copy=True, check_existing=False)
    if "FINISHED" not in result or not path.is_file():
        raise BridgeError("CHECKPOINT_FAILED", "Could not save checkpoint")
    return str(path)


def _set_transform(obj, op):
    if "location" in op:
        obj.location = op["location"]
    if "rotation" in op:
        obj.rotation_mode = "XYZ"
        obj.rotation_euler = [math.radians(value) for value in op["rotation"]]
    if "scale" in op:
        obj.scale = op["scale"]


def _aim(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def _create_mesh(kind, name):
    mesh = bpy.data.meshes.new(name + " Mesh")
    bm = bmesh.new()
    try:
        if kind == "CUBE":
            bmesh.ops.create_cube(bm, size=2)
        elif kind == "UV_SPHERE":
            bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=1)
        elif kind == "CYLINDER":
            bmesh.ops.create_cone(bm, segments=32, radius1=1, radius2=1, depth=2, cap_ends=True)
        elif kind == "PLANE":
            bmesh.ops.create_grid(bm, x_segments=2, y_segments=2, size=2)
        bm.to_mesh(mesh)
        mesh.update()
    finally:
        bm.free()
    return mesh


def _apply_operation(op, profile):
    kind = op["op"]
    if kind in {"create_object", "create_camera", "create_light"}:
        name = op["name"]
        if bpy.data.objects.get(name):
            raise BridgeError("NAME_COLLISION", "Object already exists: " + name)
        collection = _working_collection(profile)
        if kind == "create_object":
            data = None if op["type"] == "EMPTY" else _create_mesh(op["type"], name)
        elif kind == "create_camera":
            data = bpy.data.cameras.new(name + " Camera")
            data.lens = op.get("lens", 50)
        else:
            data = bpy.data.lights.new(name + " Light", op["type"])
            data.energy = op["energy"]
            if "size" in op:
                if op["type"] == "AREA":
                    data.size = op["size"]
                elif op["type"] == "POINT":
                    data.shadow_soft_size = op["size"]
                else:
                    data.angle = math.radians(op["size"])
        obj = bpy.data.objects.new(name, data)
        collection.objects.link(obj)
        _set_transform(obj, op)
        if kind in {"create_camera", "create_light"} and "target" in op:
            _aim(obj, op["target"])
        if kind == "create_camera":
            bpy.context.scene.camera = obj
        return {"op": kind, "name": obj.name}
    if kind == "set_transform":
        obj = _object(op["name"], profile)
        _set_transform(obj, op)
        return {"op": kind, "name": obj.name}
    if kind == "set_material":
        obj = _object(op["name"], profile, "MESH")
        # Mesh data, including material slots, can be shared with protected objects.
        if obj.data.users > 1:
            obj.data = obj.data.copy()
        material = bpy.data.materials.new(op["material"])
        material.diffuse_color = op["color"]
        material.use_nodes = True
        node = material.node_tree.nodes.get("Principled BSDF")
        if node:
            node.inputs["Base Color"].default_value = op["color"]
            node.inputs["Metallic"].default_value = op.get("metallic", 0)
            node.inputs["Roughness"].default_value = op.get("roughness", 0.5)
        material.metallic = op.get("metallic", 0)
        material.roughness = op.get("roughness", 0.5)
        # A new material never changes other objects sharing an old slot.
        if obj.data.materials:
            obj.material_slots[0].link = "DATA"
            obj.material_slots[0].material = material
        else:
            obj.data.materials.append(material)
        for polygon in obj.data.polygons:
            polygon.material_index = 0
        return {"op": kind, "name": obj.name, "material": material.name}
    if kind == "set_render":
        render = bpy.context.scene.render
        render.resolution_x = op["resolution_x"]
        render.resolution_y = op["resolution_y"]
        render.resolution_percentage = op.get("percentage", render.resolution_percentage)
        if "engine" in op:
            bpy.context.scene.render.engine = op["engine"]
        if "samples" in op:
            if bpy.context.scene.render.engine == "CYCLES":
                bpy.context.scene.cycles.samples = op["samples"]
            else:
                bpy.context.scene.render.image_settings  # validate render settings exist
                bpy.context.scene.eevee.taa_render_samples = op["samples"]
        return {"op": kind}
    if kind == "set_camera":
        obj = _object(op["name"], profile, "CAMERA")
        bpy.context.scene.camera = obj
        return {"op": kind, "name": obj.name}
    raise BridgeError("INVALID_PARAMS", "Unsupported operation")


def _scene_info(limit, profile):
    scene = bpy.context.scene
    objects = list(scene.objects)
    selected = [obj.name for obj in bpy.context.selected_objects] if bpy.context.view_layer else []
    result = []
    for obj in objects[:limit]:
        result.append({
            "name": obj.name, "type": obj.type,
            "location": list(obj.location), "rotation": [math.degrees(v) for v in obj.rotation_euler],
            "scale": list(obj.scale), "dimensions": list(obj.dimensions),
            "collections": [item.name for item in obj.users_collection],
            "materials": [item.name for item in obj.data.materials if item] if obj.type == "MESH" else [],
        })
    return {
        "scene_id": _SCENE_ID, "blend_file": bpy.data.filepath,
        "mode": bpy.context.mode,
        "active_object": bpy.context.view_layer.objects.active.name if bpy.context.view_layer and bpy.context.view_layer.objects.active else None,
        "selected_objects": selected,
        "units": {"system": scene.unit_settings.system, "scale_length": scene.unit_settings.scale_length},
        "render": {"engine": scene.render.engine, "resolution_x": scene.render.resolution_x,
                   "resolution_y": scene.render.resolution_y, "percentage": scene.render.resolution_percentage,
                   "camera": scene.camera.name if scene.camera else None},
        "objects": result, "total_objects": len(objects), "truncated": len(objects) > limit,
        "profile": profile,
    }


def _preview(request_id, params):
    scene = bpy.context.scene
    if scene.camera is None:
        raise BridgeError("NO_CAMERA", "Scene has no active camera")
    size = _integer(params.get("max_size", 512), "max_size", 32, 2048)
    samples = _integer(params.get("samples", 8), "samples", 1, 256)
    render = scene.render
    original = (render.filepath, render.file_format if hasattr(render, "file_format") else render.image_settings.file_format,
                render.resolution_x, render.resolution_y, render.resolution_percentage, render.engine)
    original_cycles = scene.cycles.samples if hasattr(scene, "cycles") else None
    original_eevee = scene.eevee.taa_render_samples if hasattr(scene, "eevee") and hasattr(scene.eevee, "taa_render_samples") else None
    path = _directories() / "previews" / (request_id + ".png")
    width = max(1, int(render.resolution_x * render.resolution_percentage / 100))
    height = max(1, int(render.resolution_y * render.resolution_percentage / 100))
    ratio = min(1, size / max(width, height))
    width, height = max(1, round(width * ratio)), max(1, round(height * ratio))
    try:
        render.resolution_x, render.resolution_y, render.resolution_percentage = width, height, 100
        render.filepath = str(path)
        render.image_settings.file_format = "PNG"
        if render.engine == "CYCLES":
            scene.cycles.samples = samples
        elif original_eevee is not None:
            scene.eevee.taa_render_samples = samples
        result = bpy.ops.render.render(write_still=True, scene=scene.name)
        if "FINISHED" not in result or not path.is_file():
            raise BridgeError("RENDER_FAILED", "Preview render did not produce an image")
    finally:
        render.filepath = original[0]
        render.image_settings.file_format = original[1]
        render.resolution_x, render.resolution_y, render.resolution_percentage, render.engine = original[2:]
        if original_cycles is not None:
            scene.cycles.samples = original_cycles
        if original_eevee is not None:
            scene.eevee.taa_render_samples = original_eevee
    return {"path": str(path), "mime_type": "image/png", "scene_id": _SCENE_ID, "width": width, "height": height}


def _validate_request(request):
    if not isinstance(request, dict) or not {"id", "method", "params", "expires_at"}.issubset(request) or not set(request).issubset({"id", "method", "params", "expires_at", "scene_id"}):
        raise BridgeError("INVALID_REQUEST", "Invalid request envelope")
    _uuid(request["id"])
    if not isinstance(request["method"], str) or not isinstance(request["params"], dict):
        raise BridgeError("INVALID_REQUEST", "method and params have invalid types")
    _finite(request)
    expires = _number(request["expires_at"], "expires_at")
    if expires <= time.time():
        raise BridgeError("EXPIRED", "Request has expired")
    method = request["method"]
    if method not in {"ping", "get_scene", "get_profile", "apply_batch", "preview", "save_copy", "execute_python"}:
        raise BridgeError("UNKNOWN_METHOD", "Unknown method: " + method)
    if method in {"apply_batch", "preview", "save_copy", "execute_python"}:
        if not isinstance(request.get("scene_id"), str):
            raise BridgeError("SCENE_ID_REQUIRED", "scene_id is required")
        if request["scene_id"] != _SCENE_ID:
            raise BridgeError("SCENE_CHANGED", "Scene changed; inspect it before mutating")
    elif "scene_id" in request and (not isinstance(request["scene_id"], str) or request["scene_id"] != _SCENE_ID):
        raise BridgeError("SCENE_CHANGED", "Scene changed")
    return method, request["params"]


def process_request(request):
    """Execute a validated request on Blender's main thread; return response JSON."""
    request_id = request.get("id") if isinstance(request, dict) else None
    try:
        _sync_scene_id()
        method, params = _validate_request(request)
        if method == "ping":
            _keys(params, set())
            result = {"blender_version": bpy.app.version_string, "scene_id": _SCENE_ID,
                      "blend_file": bpy.data.filepath, "bridge_version": BRIDGE_VERSION,
                      "python_enabled": _python_enabled()}
        elif method == "get_profile":
            _keys(params, set())
            result = {"scene_id": _SCENE_ID, "profile": _profile()}
        elif method == "get_scene":
            _keys(params, {"limit"})
            result = _scene_info(_integer(params.get("limit", 100), "limit", 1, 500), _profile())
        elif method == "apply_batch":
            _keys(params, {"operations", "label"}, {"operations"})
            ops = params["operations"]
            if not isinstance(ops, list) or len(ops) > 128:
                raise BridgeError("INVALID_PARAMS", "operations must be a list of at most 128 items")
            if "label" in params:
                _string(params["label"], "label")
            for op in ops:
                _validate_operation(op)
            if bpy.context.mode != "OBJECT":
                raise BridgeError("WRONG_MODE", "Switch Blender to Object mode before editing")
            profile = _profile()
            # Resolve all existing targets and name collisions before checkpointing.
            planned = {}
            for op in ops:
                kind = op["op"]
                if kind in {"create_object", "create_camera", "create_light"}:
                    if bpy.data.objects.get(op["name"]) or op["name"] in planned:
                        raise BridgeError("NAME_COLLISION", "Object already exists or is repeated: " + op["name"])
                    planned[op["name"]] = ("CAMERA" if kind == "create_camera" else
                                           "LIGHT" if kind == "create_light" else
                                           "EMPTY" if op["type"] == "EMPTY" else "MESH")
                elif kind in {"set_transform", "set_material", "set_camera"}:
                    expected = "MESH" if kind == "set_material" else "CAMERA" if kind == "set_camera" else None
                    if op["name"] in planned:
                        if expected and planned[op["name"]] != expected:
                            raise BridgeError("INVALID_PARAMS", op["name"] + " has the wrong object type")
                    else:
                        _object(op["name"], profile, expected)
            if any(op["op"] in {"create_object", "create_camera", "create_light"} for op in ops):
                name = profile["working_collection"]
                collection = bpy.data.collections.get(name)
                if name in profile["protected_collections"] or (collection and (collection.library or collection.is_library_indirect)):
                    raise BridgeError("PROTECTED", "Working collection is protected or linked")
                if collection and any(parent.name in profile["protected_collections"] and
                                      collection in parent.children_recursive for parent in bpy.data.collections):
                    raise BridgeError("PROTECTED", "Working collection is inside a protected collection")
            checkpoint = _checkpoint(params.get("label", "batch"))
            started = time.monotonic()
            results = []
            try:
                for op in ops:
                    results.append(_apply_operation(op, profile))
            except Exception as exc:
                if isinstance(exc, BridgeError):
                    code, message = exc.code, str(exc)
                else:
                    code, message = "EXECUTION_FAILED", str(exc)
                raise BridgeError(code, message, {"checkpoint": checkpoint, "applied_count": len(results),
                                                  "results": results, "rollback": "none"}) from exc
            result = {"scene_id": _SCENE_ID, "checkpoint": checkpoint, "results": results,
                      "elapsed_ms": round((time.monotonic() - started) * 1000, 2)}
        elif method == "preview":
            _keys(params, {"max_size", "samples"})
            result = _preview(request["id"], params)
        elif method == "save_copy":
            _keys(params, {"label"})
            if "label" in params:
                _string(params["label"], "label")
            safe = re.sub(r"[^A-Za-z0-9_-]+", "-", params.get("label", "copy")).strip("-")[:40] or "copy"
            path = _directories() / "exports" / (time.strftime("%Y%m%d-%H%M%S") + "-" + safe + "-" + request["id"] + ".blend")
            status = bpy.ops.wm.save_as_mainfile(filepath=str(path), copy=True, check_existing=False)
            if "FINISHED" not in status or not path.is_file():
                raise BridgeError("SAVE_FAILED", "Could not save copy")
            result = {"path": str(path), "scene_id": _SCENE_ID}
        else:
            _keys(params, {"code", "label"}, {"code"})
            if not isinstance(params["code"], str) or len(params["code"].encode("utf-8")) > MAX_CODE_BYTES:
                raise BridgeError("INVALID_PARAMS", "code must be a string of at most 64 KiB")
            if "label" in params:
                _string(params["label"], "label")
            if not _python_enabled():
                raise BridgeError("PYTHON_DISABLED", "Local Python execution is disabled")
            if bpy.context.mode != "OBJECT":
                raise BridgeError("WRONG_MODE", "Switch Blender to Object mode before editing")
            checkpoint = _checkpoint(params.get("label", "python"))
            scope = {"bpy": bpy, "result": None, "__builtins__": __builtins__}
            try:
                exec(params["code"], scope, scope)
                json.dumps(scope["result"], allow_nan=False)
            except Exception as exc:
                raise BridgeError("PYTHON_FAILED", str(exc), {"checkpoint": checkpoint, "rollback": "none"}) from exc
            result = {"scene_id": _SCENE_ID, "checkpoint": checkpoint, "result": scope["result"]}
        return {"id": request_id, "ok": True, "result": result}
    except BridgeError as exc:
        error = {"code": exc.code, "message": str(exc)}
        if exc.details is not None:
            error["details"] = exc.details
        return {"id": request_id, "ok": False, "error": error}
    except Exception as exc:
        return {"id": request_id, "ok": False, "error": {"code": "INTERNAL_ERROR", "message": str(exc)}}


def _consume(path):
    request_id = path.stem
    try:
        _uuid(request_id)
    except BridgeError:
        return
    response_path = path.parent.parent / "responses" / path.name
    if response_path.exists():
        path.unlink(missing_ok=True)
        return
    processing = path.parent.parent / "processing" / path.name
    if processing.exists():
        path.unlink(missing_ok=True)
        _atomic_json(response_path, {
            "id": request_id, "ok": False,
            "error": {"code": "ALREADY_PROCESSING", "message": "An earlier request with this id may have executed"},
        })
        return
    os.replace(path, processing)
    try:
        mode = processing.lstat().st_mode
        if not stat.S_ISREG(mode) or processing.stat().st_size > MAX_REQUEST_BYTES:
            raise BridgeError("INVALID_REQUEST", "Request is not a regular JSON file under 1 MiB")
        with os.fdopen(os.open(processing, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)), "rb") as stream:
            raw = stream.read(MAX_REQUEST_BYTES + 1)
        if len(raw) > MAX_REQUEST_BYTES:
            raise BridgeError("INVALID_REQUEST", "Request exceeds 1 MiB")
        request = json.loads(raw)
        if not isinstance(request, dict) or request.get("id") != request_id:
            raise BridgeError("INVALID_REQUEST", "Filename and request id differ")
    except (OSError, ValueError, UnicodeDecodeError, BridgeError) as exc:
        code = exc.code if isinstance(exc, BridgeError) else "INVALID_REQUEST"
        response = {"id": request_id, "ok": False, "error": {"code": code, "message": str(exc)}}
        _atomic_json(response_path, response)
        processing.unlink(missing_ok=True)
        return
    # The processing file remains on a crash; never replay it automatically.
    _heartbeat(busy=True, request_id=request_id)
    response = process_request(request)
    _atomic_json(response_path, response)
    processing.unlink(missing_ok=True)
    _heartbeat(force=True)


def _poll():
    if not _RUNNING or bpy.app.driver_namespace.get(_NAMESPACE_KEY) != _TOKEN:
        return None
    try:
        _heartbeat()
        directory = _directories() / "requests"
        started = time.monotonic()
        for index, path in enumerate(sorted(directory.glob("*.json"))):
            if index >= 4 or time.monotonic() - started > 0.02:
                break
            try:
                _consume(path)
            except Exception:
                # One malformed or failed request must not stop the queue.
                pass
    except Exception:
        pass
    return 0.05


@persistent
def _on_load(_):
    global _SCENE_ID, _ACTIVE_SCENE_PTR
    _SCENE_ID = str(uuid.uuid4())
    scene = bpy.context.scene
    _ACTIVE_SCENE_PTR = scene.as_pointer() if scene else None
    if _RUNNING:
        bpy.app.driver_namespace[_NAMESPACE_KEY] = _TOKEN
        if not bpy.app.timers.is_registered(_poll):
            bpy.app.timers.register(_poll, first_interval=0.05, persistent=True)
        _heartbeat(force=True)


_on_load._blender_ai_handler = True


def start_bridge():
    global _RUNNING, _LOCK_FD, _START_ERROR
    root = _directories()
    _profile()
    if not _RUNNING:
        status = root / "status.json"
        if status.exists():
            try:
                owner = json.loads(status.read_text(encoding="utf-8"))
                if (owner.get("running") and owner.get("pid") != os.getpid() and _pid_alive(owner.get("pid"))
                        and time.time() - owner.get("updated_at", 0) < 30):
                    raise BridgeError("BRIDGE_BUSY", "Another Blender process owns this bridge directory")
            except (OSError, ValueError, TypeError, AttributeError):
                pass
        lock = os.open(root / "bridge.lock", os.O_RDWR | os.O_CREAT, 0o600)
        try:
            _lock_file(lock)
        except BridgeError:
            os.close(lock)
            raise
        _LOCK_FD = lock
    bpy.app.driver_namespace[_NAMESPACE_KEY] = _TOKEN
    _RUNNING = True
    _START_ERROR = None
    _heartbeat(force=True)
    if not bpy.app.timers.is_registered(_poll):
        bpy.app.timers.register(_poll, first_interval=0.05, persistent=True)


def stop_bridge():
    global _RUNNING, _LOCK_FD, _START_ERROR
    _RUNNING = False
    if bpy.app.driver_namespace.get(_NAMESPACE_KEY) == _TOKEN:
        bpy.app.driver_namespace.pop(_NAMESPACE_KEY, None)
    if bpy.app.timers.is_registered(_poll):
        bpy.app.timers.unregister(_poll)
    if _LOCK_FD is not None:
        try:
            _heartbeat(force=True)
        except OSError:
            pass
        _unlock_file(_LOCK_FD)
        os.close(_LOCK_FD)
        _LOCK_FD = None
    _START_ERROR = None


class BLENDERAI_Preferences(bpy.types.AddonPreferences):
    bl_idname = __name__
    allow_python: BoolProperty(
        name="Allow full local Python execution",
        description="Python requests have full access to this computer and Blender session",
        default=False,
    )

    def draw(self, context):
        self.layout.prop(self, "allow_python")


class BLENDERAI_OT_start(bpy.types.Operator):
    bl_idname = "blender_ai.start"
    bl_label = "Start AI Bridge"

    def execute(self, context):
        try:
            start_bridge()
        except BridgeError as exc:
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}
        return {"FINISHED"}


class BLENDERAI_OT_stop(bpy.types.Operator):
    bl_idname = "blender_ai.stop"
    bl_label = "Stop AI Bridge"

    def execute(self, context):
        stop_bridge()
        return {"FINISHED"}


class BLENDERAI_PT_panel(bpy.types.Panel):
    bl_label = "AI Bridge"
    bl_idname = "BLENDERAI_PT_panel"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "AI Bridge"

    def draw(self, context):
        layout = self.layout
        layout.label(text="Status: " + ("Running" if _RUNNING else "Stopped"))
        if _START_ERROR:
            layout.label(text=_START_ERROR[:80], icon="ERROR")
        layout.operator("blender_ai.stop" if _RUNNING else "blender_ai.start")
        layout.label(text="File: " + (Path(bpy.data.filepath).name if bpy.data.filepath else "Unsaved"))
        try:
            layout.label(text="Working collection: " + _profile()["working_collection"])
        except BridgeError:
            layout.label(text="Profile error", icon="ERROR")
        addon = context.preferences.addons.get(__name__)
        if addon:
            layout.prop(addon.preferences, "allow_python", text="Allow full local Python")
        layout.label(text="Python has full local access", icon="ERROR")


_CLASSES = (BLENDERAI_Preferences, BLENDERAI_OT_start, BLENDERAI_OT_stop, BLENDERAI_PT_panel)


def register():
    global _START_ERROR
    for cls in _CLASSES:
        bpy.utils.register_class(cls)
    # Remove stale handlers from a reloaded version of this module.
    for handler in list(bpy.app.handlers.load_post):
        if getattr(handler, "_blender_ai_handler", False):
            bpy.app.handlers.load_post.remove(handler)
    bpy.app.handlers.load_post.append(_on_load)
    try:
        start_bridge()
    except (BridgeError, OSError) as exc:
        # Keep the sidebar available to explain a busy bridge and allow retry.
        _START_ERROR = str(exc)


def unregister():
    stop_bridge()
    if _on_load in bpy.app.handlers.load_post:
        bpy.app.handlers.load_post.remove(_on_load)
    for cls in reversed(_CLASSES):
        bpy.utils.unregister_class(cls)


if __name__ == "__main__":
    register()
