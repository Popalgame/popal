#!/usr/bin/env python3
"""Polpal Studio local character engine: reference pack -> recipe -> rigged, animated GLB.

Everything runs on this machine: no accounts, tokens or generation limits.

  python3 engine.py analyze PACK.zip RUNS/<name>        # draft recipe only
  python3 engine.py build RUNS/<name>                     # Blender build + review renders
  python3 engine.py serve --runs RUNS [--port 8790]       # live preview window

The preview server listens on 127.0.0.1 only and follows the Studio server's
rules: Host/Origin checks, safe paths, size limits, no execution of pack files.
"""
import argparse
import json
import mimetypes
import re
import shutil
import subprocess
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

import character_recipe as recipe_lib
import reference_pack

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
WEB = HERE/'studio-web'
VENDOR = {'three.min.js': REPO/'site/three.min.js', 'GLTFLoader.js': REPO/'site/vendor/GLTFLoader.js'}
DEFAULT_BLENDER = Path('/Applications/Blender.app/Contents/MacOS/Blender')
RUN_ID = re.compile(r'^[a-z0-9][a-z0-9-]{2,63}$')
UPLOAD_TYPES = {'application/zip': '.zip', 'application/x-zip-compressed': '.zip', 'image/png': '.png',
                'image/jpeg': '.jpg', 'image/webp': '.webp'}
MAX_UPLOAD = 300*1024*1024
DISCONNECT = (BrokenPipeError, ConnectionResetError, ConnectionAbortedError)


def write_json(path, value):
    tmp = path.with_suffix(path.suffix+'.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')
    tmp.replace(path)


def safe(root, relative):
    root = Path(root).resolve()
    path = (root/relative).resolve()
    if not path.is_relative_to(root):
        raise ValueError('Path outside allowed folder')
    return path


def read_events(path):
    events = []
    if path.is_file():
        for line in path.read_text().splitlines():
            try:
                events.append(json.loads(line))
            except ValueError:
                events.append({'stage': 'unreadable', 'status': 'failed'})
    return events


class Engine:
    """One build at a time; each run lives in its own folder under runs/."""

    def __init__(self, runs, blender=None, bridge_check=True):
        self.runs = Path(runs).resolve()
        self.runs.mkdir(parents=True, exist_ok=True)
        self.blender = Path(blender) if blender else (DEFAULT_BLENDER if DEFAULT_BLENDER.exists() else None)
        self.bridge_check = bridge_check
        self.lock = threading.Lock()
        self.busy = False

    def run_dir(self, run_id):
        if not RUN_ID.match(run_id):
            raise ValueError('Invalid run id')
        return safe(self.runs, run_id)

    def state(self, run_id):
        folder = self.run_dir(run_id)
        path = folder/'state.json'
        if not path.is_file():
            raise FileNotFoundError(run_id)
        state = json.loads(path.read_text())
        build = folder/state['build'] if state.get('build') else None
        state['events'] = read_events(build/'events.jsonl') if build else []
        for name in ('recipe.json', 'reference-report.json'):
            file = folder/name
            state[name.split('.')[0].replace('-', '_')] = json.loads(file.read_text()) if file.is_file() else None
        if build and (build/'build-report.json').is_file():
            state['build_report'] = json.loads((build/'build-report.json').read_text())
        renders = build/'renders' if build else None
        state['renders'] = sorted(f'{state["build"]}/renders/{p.name}' for p in renders.glob('*.png')) if renders and renders.is_dir() else []
        return state

    def list(self):
        out = []
        for folder in sorted(self.runs.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
            if (folder/'state.json').is_file():
                s = json.loads((folder/'state.json').read_text())
                out.append({k: s.get(k) for k in ('id', 'name', 'status', 'created', 'message')})
        return out

    def set_state(self, folder, **values):
        path = folder/'state.json'
        state = json.loads(path.read_text()) if path.is_file() else {}
        state.update(values)
        write_json(path, state)
        return state

    # ------------------------------------------------------------ steps
    def analyse(self, source, run_id, name=None):
        folder = self.run_dir(run_id)
        if folder.exists():
            raise FileExistsError(run_id)
        folder.mkdir(parents=True)
        self.set_state(folder, id=run_id, name=name or run_id, status='analysing', created=time.time(), builds=0)
        try:
            recipe, report = reference_pack.analyse(source, folder, name=name)
        except Exception as error:
            self.set_state(folder, status='failed', stage='analyse', message=str(error)[:400])
            raise
        self.set_state(folder, status='analysed', message=f'{len(report["warnings"])} warnings')
        return recipe, report

    def build(self, run_id, recipe=None):
        """Blender build into a new build-N folder, then review renders."""
        folder = self.run_dir(run_id)
        if self.blender is None or not self.blender.exists():
            self.set_state(folder, status='failed', message='Blender not found; pass --blender')
            raise ValueError('Blender not found; pass --blender')
        if recipe is not None:
            recipe_lib.validate(recipe)
        with self.lock:
            if self.busy:
                raise ValueError('Another build is running')
            self.busy = True
        try:
            if self.bridge_check:
                from blender_pipeline import bridge_permission
                bridge_permission()
            state = self.set_state(folder)
            number = state.get('builds', 0)+1
            build = folder/f'build-{number}'
            build.mkdir()
            recipe_path = build/'recipe.json'
            if recipe is None:
                shutil.copyfile(folder/'recipe.json', recipe_path)
            else:
                recipe_lib.dump(recipe, recipe_path)
            self.set_state(folder, status='building', builds=number, build=build.name, message=None)
            for script, args, log in (('engine_blender.py', [recipe_path, build], 'build.log'),
                                      ('engine_render.py', [build/'character.glb', build/'renders'], 'render.log')):
                command = [str(self.blender), '--background', '--factory-startup', '--disable-autoexec',
                           '--python-exit-code', '1', '--python', str(HERE/script), '--', *map(str, args)]
                with (build/log).open('w') as handle:
                    code = subprocess.run(command, stdout=handle, stderr=subprocess.STDOUT, timeout=1800).returncode
                if code:
                    raise RuntimeError(f'{script} failed ({code}); see {build.name}/{log}')
            report = json.loads((build/'build-report.json').read_text())
            self.set_state(folder, status=report['status'], message='Built locally; appearance not yet approved')
            return report
        except Exception as error:
            self.set_state(folder, status='failed', message=str(error)[:400])
            raise
        finally:
            self.busy = False

    def start(self, source, name=None):
        run_id = re.sub(r'[^a-z0-9-]+', '-', (name or 'character').lower()).strip('-')[:40] or 'character'
        run_id = f'{run_id}-{uuid.uuid4().hex[:6]}'
        self.analyse(source, run_id, name=name)

        def work():
            try:
                self.build(run_id)
            except Exception:
                pass  # state.json carries the error for the preview
        threading.Thread(target=work, daemon=True).start()
        return run_id


def send_file(handler, file):
    if not file.is_file():
        raise FileNotFoundError(file.name)
    data = file.read_bytes()
    kind = 'model/gltf-binary' if file.suffix == '.glb' else mimetypes.guess_type(str(file))[0] or 'application/octet-stream'
    handler.send_response(200)
    handler.send_header('Content-Type', kind)
    handler.send_header('Content-Length', str(len(data)))
    handler.send_header('Cache-Control', 'no-cache')
    handler.send_header('X-Content-Type-Options', 'nosniff')
    handler.end_headers()
    handler.wfile.write(data)


def route_get(handler, engine, path):
    """Engine pages and API; path is relative to the mount point ('/' or '/engine/')."""
    if path in ('/', '/engine.html'):
        return send_file(handler, WEB/'engine.html')
    if path == '/engine.js':
        return send_file(handler, WEB/'engine.js')
    if path.startswith('/vendor/') and path[8:] in VENDOR:
        return send_file(handler, VENDOR[path[8:]])
    if path == '/api/runs':
        return handler.respond({'runs': engine.list(), 'blender': bool(engine.blender), 'busy': engine.busy})
    m = re.match(r'^/api/runs/([^/]+)$', path)
    if m:
        return handler.respond(engine.state(m.group(1)))
    m = re.match(r'^/runs/([^/]+)/(.+)$', path)
    if m:
        return send_file(handler, safe(engine.run_dir(m.group(1)), m.group(2)))
    raise FileNotFoundError(path)


def route_post(handler, engine, path):
    # A custom header forces a CORS preflight, so other sites cannot post here.
    if handler.headers.get('X-Polpal-Engine') != '1':
        raise ValueError('Engine header required')
    length = int(handler.headers.get('Content-Length', 0))
    if not 0 < length <= MAX_UPLOAD:
        raise ValueError('Upload size outside limit')
    if path == '/api/runs':
        kind = handler.headers.get('Content-Type', '').split(';')[0]
        if kind not in UPLOAD_TYPES:
            raise ValueError('Upload a .zip, .png, .jpg or .webp')
        name = re.sub(r'[^\w .-]+', '', unquote(handler.headers.get('X-Pack-Name', 'character')))[:60] or 'character'
        # Keep the original (sanitised) file name: image roles come from it.
        incoming = engine.runs/'.incoming'/uuid.uuid4().hex
        incoming.mkdir(parents=True)
        stem = re.sub(r'[^\w-]+', '_', Path(name).stem)[:50] or 'reference'
        upload = incoming/(stem+UPLOAD_TYPES[kind])
        try:
            upload.write_bytes(handler.rfile.read(length))
            run_id = engine.start(upload, name=Path(name).stem)
        finally:
            shutil.rmtree(incoming, ignore_errors=True)
        return handler.respond({'id': run_id}, 202)
    m = re.match(r'^/api/runs/([^/]+)/build$', path)
    if m:
        if handler.headers.get('Content-Type', '').split(';')[0] != 'application/json':
            raise ValueError('JSON required')
        payload = json.loads(handler.rfile.read(length))
        recipe = recipe_lib.validate(payload['recipe'])
        run_id = m.group(1)
        engine.state(run_id)
        threading.Thread(target=lambda: _quiet(engine.build, run_id, recipe), daemon=True).start()
        return handler.respond({'id': run_id, 'status': 'building'}, 202)
    raise FileNotFoundError(path)


class Server(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, engine):
        super().__init__(address, Handler)
        self.engine = engine


class Handler(BaseHTTPRequestHandler):
    """Standalone preview server (the same routes are mounted in studio.py under /engine/)."""

    def log_message(self, *args):
        pass

    def respond(self, value, status=200):
        data = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(data)

    def fail(self, error):
        if isinstance(error, DISCONNECT):
            return
        status = 404 if isinstance(error, FileNotFoundError) else 409 if isinstance(error, FileExistsError) else \
            400 if isinstance(error, ValueError) else 500
        try:
            self.respond({'error': str(error)}, status)
        except DISCONNECT:
            pass

    def local_request(self):
        port = self.server.server_port
        allowed = {f'127.0.0.1:{port}', f'localhost:{port}'}
        if self.headers.get('Host', '') not in allowed:
            raise ValueError('Local host required')
        origin = self.headers.get('Origin')
        if origin and origin not in {'http://'+a for a in allowed}:
            raise ValueError('Same-origin requests only')

    def do_GET(self):
        try:
            self.local_request()
            route_get(self, self.server.engine, unquote(urlparse(self.path).path))
        except Exception as error:
            self.fail(error)

    def do_POST(self):
        try:
            self.local_request()
            route_post(self, self.server.engine, urlparse(self.path).path)
        except Exception as error:
            self.fail(error)


def _quiet(fn, *args):
    try:
        fn(*args)
    except Exception:
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='command', required=True)
    a = sub.add_parser('analyze')
    a.add_argument('pack', type=Path)
    a.add_argument('run', type=Path)
    a.add_argument('--name')
    b = sub.add_parser('build')
    b.add_argument('run', type=Path)
    s = sub.add_parser('serve')
    s.add_argument('--runs', type=Path, required=True)
    s.add_argument('--port', type=int, default=8790)
    for p in (b, s):
        p.add_argument('--blender', type=Path)
        p.add_argument('--skip-bridge-check', action='store_true',
                       help='do not ask the Blender AI Bridge whether Python is enabled')
    args = parser.parse_args()
    if args.command == 'analyze':
        recipe, report = reference_pack.analyse(args.pack, args.run, name=args.name)
        print(json.dumps({'recipe': str(args.run/'recipe.json'), 'warnings': report['warnings']}, ensure_ascii=False, indent=2))
    elif args.command == 'build':
        engine = Engine(args.run.parent, args.blender, not args.skip_bridge_check)
        if not (args.run/'state.json').exists():
            engine.set_state(args.run.resolve(), id=args.run.name, name=args.run.name, status='analysed', builds=0)
        print(json.dumps(engine.build(args.run.name), indent=2))
    else:
        engine = Engine(args.runs, args.blender, not args.skip_bridge_check)
        server = Server(('127.0.0.1', args.port), engine)
        print(f'Polpal engine preview: http://127.0.0.1:{args.port}/  (runs: {engine.runs})')
        server.serve_forever()


if __name__ == '__main__':
    main()
