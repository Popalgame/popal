import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import time
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from bridge_client import BridgeClient, BridgeError, atomic_json


class ClientTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.client = BridgeClient(self.directory.name)
        atomic_json(self.client.root / "status.json", {"running": True, "pid": os.getpid(), "updated_at": time.time()})

    def serve_once(self, response, *, claim=True):
        def serve():
            end = time.monotonic() + 2
            while time.monotonic() < end:
                queued = list((self.client.root / "requests").glob("*.json"))
                if queued:
                    path = queued[0]
                    request = json.loads(path.read_text())
                    self.request = request
                    if claim:
                        path.rename(self.client.root / "processing" / path.name)
                    if response is not None:
                        atomic_json(self.client.root / "responses" / path.name, {"id": request["id"], **response})
                    return
                time.sleep(0.001)
        worker = threading.Thread(target=serve)
        worker.start()
        self.addCleanup(worker.join)

    def test_round_trip_preserves_scene_and_parameters(self):
        self.serve_once({"ok": True, "result": {"value": 42}})
        self.assertEqual(self.client.call("apply_batch", {"operations": []}, scene_id="scene-1", timeout=1), {"value": 42})
        self.assertEqual(self.request["scene_id"], "scene-1")
        self.assertEqual(self.request["params"], {"operations": []})
        self.assertGreater(self.request["expires_at"], time.time() - 1)

    def test_structured_error_retains_checkpoint_and_partial_count(self):
        self.serve_once({"ok": False, "error": {"code": "EXECUTION_FAILED", "message": "failed", "details": {"checkpoint": "/copy.blend", "applied_count": 2}}})
        with self.assertRaises(BridgeError) as caught:
            self.client.call("apply_batch", timeout=1)
        self.assertEqual(caught.exception.details["applied_count"], 2)
        self.assertEqual(caught.exception.details["checkpoint"], "/copy.blend")

    def test_unclaimed_timeout_cancels_request(self):
        with self.assertRaises(BridgeError) as caught:
            self.client.call("ping", timeout=0.05)
        self.assertFalse(caught.exception.details["may_have_executed"])
        self.assertEqual(list((self.client.root / "requests").glob("*.json")), [])

    def test_claimed_timeout_is_ambiguous_and_is_never_retried(self):
        self.serve_once(None)
        with self.assertRaises(BridgeError) as caught:
            self.client.call("apply_batch", timeout=0.1)
        self.assertTrue(caught.exception.details["may_have_executed"])
        self.assertEqual(len(list((self.client.root / "processing").glob("*.json"))), 1)
        self.assertEqual(list((self.client.root / "requests").glob("*.json")), [])

    def test_missing_connection_fails_without_queuing(self):
        (self.client.root / "status.json").unlink()
        with self.assertRaises(BridgeError) as caught:
            self.client.call("ping")
        self.assertEqual(caught.exception.code, "not_connected")
        self.assertEqual(list((self.client.root / "requests").glob("*.json")), [])

    def test_nonfinite_and_oversize_requests_are_not_published(self):
        for params in ({"x": float("nan")}, {"code": "x" * (1024 * 1024)}):
            with self.assertRaises((ValueError, BridgeError)):
                self.client.call("execute_python", params, timeout=1)
        self.assertEqual(list((self.client.root / "requests").glob("*.json")), [])


if __name__ == "__main__":
    unittest.main()
