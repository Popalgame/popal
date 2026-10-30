"""Run via uv run --directory tools/blender-mcp tests/integration.py.

Exercises a real MCP stdio client → adapter → queue → background Blender.
The user's interactive Blender and assets are never used by this test.
"""
import asyncio
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

MODULE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(MODULE))
from bridge_client import BridgeClient


async def exercise(root):
    server = StdioServerParameters(command=sys.executable, args=[str(MODULE / "mcp_server.py")], env={**os.environ, "BLENDER_AI_BRIDGE_DIR": str(root)})
    async with stdio_client(server) as (reader, writer):
        async with ClientSession(reader, writer) as session:
            await session.initialize()
            catalog = await session.list_tools()
            assert len(catalog.tools) == 7, [tool.name for tool in catalog.tools]

            async def tool(name, arguments=None, error=False):
                reply = await session.call_tool(name, arguments or {})
                assert bool(reply.isError) == error, (name, reply)
                return reply

            scene = await tool("blender_scene")
            data = scene.structuredContent or json.loads(scene.content[0].text)
            scene_id = data["scene_id"]
            original_file = data["blend_file"]
            operations = json.loads((MODULE / "examples" / "studio.json").read_text())
            batch = await tool("blender_apply_batch", {"scene_id": scene_id, "operations": operations, "label": "Integration demo"})
            batch_data = batch.structuredContent or json.loads(batch.content[0].text)
            assert Path(batch_data["checkpoint"]).exists()
            assert len(batch_data["results"]) == len(operations)
            failed = await tool("blender_apply_batch", {"scene_id": "old-scene", "operations": [{"op": "set_transform", "name": "AI_Product", "location": [99, 99, 99]}]}, error=True)
            assert "SCENE_CHANGED" in str(failed)
            invalid = await tool("blender_apply_batch", {"scene_id": scene_id, "operations": [{"op": "create_object", "name": "ShouldNotExist", "type": "CUBE"}, {"op": "set_transform", "name": "Missing", "location": [0, 0, 0]}]}, error=True)
            assert "NOT_FOUND" in str(invalid)
            scene = await tool("blender_scene")
            after = scene.structuredContent or json.loads(scene.content[0].text)
            assert after["blend_file"] == original_file
            assert "ShouldNotExist" not in [item["name"] for item in after["objects"]]
            assert after["render"]["camera"] == "AI_Camera"
            assert next(item for item in after["objects"] if item["name"] == "AI_Product")["location"][0] == 0
            preview = await tool("blender_preview", {"scene_id": scene_id, "max_size": 384, "samples": 4})
            assert any(item.type == "image" for item in preview.content), str(preview)[:600]
            disabled = await tool("blender_execute_python", {"scene_id": scene_id, "code": "result = 1"}, error=True)
            assert "PYTHON_DISABLED" in str(disabled)
            saved = await tool("blender_save_copy", {"scene_id": scene_id, "label": "demo"})
            saved_data = saved.structuredContent or json.loads(saved.content[0].text)
            assert Path(saved_data["path"]).is_file()
            result_dir = MODULE.parents[1] / "output" / "blender-ai-bridge"
            result_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(saved_data["path"], result_dir / "demo.blend")
            shutil.copy2(next((root / "previews").glob("*.png")), result_dir / "demo.png")
            print(json.dumps({"ok": True, "mcp_tools": len(catalog.tools), "operations": len(operations), "preview": str(result_dir / "demo.png"), "blend": str(result_dir / "demo.blend")}, ensure_ascii=False))


def main():
    blender = os.environ.get("BLENDER_BIN") or shutil.which("blender")
    if not blender:
        raise RuntimeError("Set BLENDER_BIN to Blender executable")
    with tempfile.TemporaryDirectory(prefix="blender-ai-integration-") as temporary:
        root = Path(temporary)
        env = {**os.environ, "BLENDER_AI_BRIDGE_DIR": temporary}
        with (root / "blender.log").open("w") as log:
            process = subprocess.Popen([blender, "--background", "--factory-startup", "--python", str(MODULE / "tests" / "headless_service.py")], env=env, stdout=log, stderr=subprocess.STDOUT)
            try:
                deadline = time.monotonic() + 20
                while not (root / "status.json").exists():
                    if process.poll() is not None or time.monotonic() > deadline:
                        raise RuntimeError((root / "blender.log").read_text())
                    time.sleep(0.05)
                asyncio.run(exercise(root))
            except Exception:
                print((root / "blender.log").read_text()[-7000:], file=sys.stderr)
                raise
            finally:
                (root / "stop-test-service").touch()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.terminate()
                    process.wait(timeout=10)


if __name__ == "__main__":
    main()
