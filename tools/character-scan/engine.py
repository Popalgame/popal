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
import hashlib
import json
import os
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
DEFAULT_BASES = Path(os.environ.get('POLPAL_ENGINE_BASES', str(REPO/'output/character-engine/bases')))
BUDGET = {'desktop': 40000, 'mobile': 12000}
MATCH_THRESHOLD = .90
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


def thumbnail(path):
    """Figure crop on its own background, 48x96 RGB in 0..1 — for base matching."""
    import numpy as np
    from PIL import Image
    with Image.open(path) as im:
        m, fg = reference_pack.measure(im)
        ys, xs = np.nonzero(fg)
        box = (int(xs.min()), int(ys.min()), int(xs.max())+1, int(ys.max())+1)
        rgb = np.asarray(im.convert('RGB').crop(box).resize((48, 96)), float)/255
        mask = np.asarray(Image.fromarray(fg[box[1]:box[3], box[0]:box[2]].astype('uint8')*255).resize((48, 96))) > 127
    return rgb*mask[..., None], mask


def similarity(a, b):
    """1 = identical figure; silhouette overlap times colour agreement."""
    import numpy as np
    (ra, ma), (rb, mb) = a, b
    overlap = (ma & mb).sum()/max(1, (ma | mb).sum())
    colour = 1-np.abs(ra-rb)[ma & mb].mean() if (ma & mb).any() else 0
    return float(overlap*colour)


def register_base(bases, base_id, blend, reference, label, colour=None):
    """Add a sculpted, rigged base to the library (files are referenced, never copied or changed)."""
    import numpy as np
    if not RUN_ID.match(base_id):
        raise ValueError('Invalid base id')
    folder = safe(Path(bases), base_id)
    folder.mkdir(parents=True, exist_ok=False)
    rgb, mask = thumbnail(reference)
    np.save(folder/'thumbnail.npy', np.concatenate([rgb, mask[..., None]], axis=2))
    entry = {'schema': 'polpal.engine-base/1', 'id': base_id, 'label': label, 'blend': str(Path(blend).resolve()),
             'blend_sha256': hashlib.sha256(Path(blend).read_bytes()).hexdigest(),
             'reference': str(Path(reference).resolve()), 'colour_attribute': colour, 'budgets': BUDGET,
             'palette': recipe_lib.default()['palette']}
    write_json(folder/'base.json', entry)
    return entry


def profile_base(bases, base_id, blender, palette=None):
    """Read the base's materials in Blender and store the region map used for variants."""
    folder = safe(Path(bases), base_id)
    entry = json.loads((folder/'base.json').read_text())
    out = folder/'profile.json'
    command = [str(blender), '--background', '--factory-startup', '--disable-autoexec', entry['blend'],
               '--python-exit-code', '1', '--python', str(HERE/'engine_profile.py'), '--', str(out)]
    if entry.get('colour_attribute'):
        command.append(entry['colour_attribute'])
    subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=1800)
    profile = json.loads(out.read_text())
    entry['regions'] = regions_from_profile(profile)
    entry['profile_materials'] = [{'material': m['name'], 'triangles': m['triangles']} for m in profile['materials']]
    entry['palette'] = palette or entry.get('palette') or recipe_lib.default()['palette']
    write_json(folder/'base.json', entry)
    return entry


# Material name (lower case) -> palette slot of a sculpted base; first match wins.
REGION_RULES = (('hair', 'hair_root'), ('brow', 'brows'), ('iris', 'eyes'), ('jacket', 'jacket'), ('collar', 'fur'),
                ('top', 'top'), ('shorts • saddle', 'shorts'), ('recessed seam', 'shorts'), ('chestnut leather', 'boots'),
                ('linen stitching', 'socks'), ('midnight blue enamel', 'sphere_primary'), ('ivory ceramic', 'sphere_secondary'),
                ('walnut', 'hammer_wood'), ('rune', 'rune_glow'))
# Optional parts a variant may drop, by material name stems.
PART_RULES = {'weapon': ('hammer',), 'collar': ('collar',), 'spheres': ('capsule',)}


def srgb_hex_to_linear(value):
    return [c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in recipe_lib.hex_to_rgb(value)]


def lum(rgb):
    return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]


def scaled(rgb, k):
    """Colour times k, kept within 0..1 by lowering brightness rather than clipping hue."""
    out = [c*k for c in rgb]
    peak = max(out)
    return [c/peak for c in out] if peak > 1 else out


def regions_from_profile(profile):
    """Which palette slot each material carries, and how its colour is stored."""
    regions = []
    for m in profile['materials']:
        name = (m['name'] or '').lower()
        slot = next((s for stem, s in REGION_RULES if re.search(r'\b'+re.escape(stem)+r'\b', name)), None)
        if slot is None or not m['triangles']:
            continue
        if m['images'] and slot == 'eyes':
            mode = 'texture'
        elif slot == 'hair_root' and m.get('spread', 0) > .2:
            mode = 'gradient'
        elif not m['factor_linked']:
            mode = 'factor'
        else:
            mode = 'vertex'
        regions.append({'material': m['name'], 'slot': slot, 'mode': mode, 'factor': m['factor'],
                        'median': m.get('median'), 'ends': m.get('ends')})
    return regions


def variant_spec(entry, recipe):
    """Recolour and part-removal instructions for engine_optimize.py (linear RGB)."""
    # Bases registered without a palette are described by the default recipe (Aiko).
    base_palette, palette = entry.get('palette') or recipe_lib.default()['palette'], recipe['palette']
    spec = {'remove': [], 'recolor': []}
    names = [r['material'] for r in entry.get('profile_materials', [])]
    parts = recipe['parts']
    drop = []
    if parts['weapon']['style'] == 'none':
        drop.append('weapon')
    if parts['top'].get('collar') != 'fur':
        drop.append('collar')
    if parts['back'].get('spheres', 0) == 0:
        drop.append('spheres')
    for part in drop:
        spec['remove'] += [n for n in names if any(stem in n.lower() for stem in PART_RULES[part])]
    for region in entry.get('regions', []):
        slot = region['slot']
        if slot not in base_palette or region['material'] in spec['remove']:
            continue
        changed = palette[slot].upper() != base_palette[slot].upper()
        if region['mode'] == 'gradient' and slot == 'hair_root':
            changed = changed or palette['hair_tip'].upper() != base_palette['hair_tip'].upper()
        if not changed:
            continue
        target = srgb_hex_to_linear(palette[slot])
        base = srgb_hex_to_linear(base_palette[slot])
        item = {'material': region['material'], 'mode': region['mode'], 'slot': slot}
        # New hue from the palette; brightness relation of this material to its slot kept,
        # per-corner shading kept by the optimiser (colour x luminance ratio).
        if region['mode'] == 'factor':
            item['to'] = scaled(target, lum(region['factor'])/max(lum(base), 1e-4))
            item['emission'] = slot == 'rune_glow'
        elif region['mode'] == 'gradient':
            ends = region['ends']
            root_ref, tip_ref = srgb_hex_to_linear(base_palette['hair_root']), srgb_hex_to_linear(base_palette['hair_tip'])
            d = [sum((a-b)**2 for a, b in zip(e, root_ref)) for e in ends]
            root, tip = (ends[0], ends[1]) if d[0] <= d[1] else (ends[1], ends[0])
            item.update(**{'from': root, 'from2': tip,
                           'to': scaled(target, lum(root)/max(lum(root_ref), 1e-4)),
                           'to2': scaled(srgb_hex_to_linear(palette['hair_tip']), lum(tip)/max(lum(tip_ref), 1e-4))})
        elif region['mode'] == 'vertex':
            median = region['median']
            item.update(**{'from': median, 'to': scaled(target, lum(median)/max(lum(base), 1e-4))})
        else:  # texture: same rule, the optimiser measures the texture's own median
            item.update(to=target, slot_base=base)
        spec['recolor'].append(item)
    return spec


def load_bases(bases):
    import numpy as np
    out = []
    for path in sorted(Path(bases).glob('*/base.json')) if Path(bases).is_dir() else []:
        entry = json.loads(path.read_text())
        thumb = np.load(path.parent/'thumbnail.npy')
        out.append((entry, (thumb[..., :3], thumb[..., 3] > .5)))
    return out


class Engine:
    """One build at a time; each run lives in its own folder under runs/."""

    def __init__(self, runs, blender=None, bridge_check=True, bases=None):
        self.bases = Path(bases or DEFAULT_BASES)
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
        recipe = self.match_base(folder, recipe)
        base = recipe['base']
        note = f'baza {base["id"]} ({base["score"]:.2f})' if base['kind'] == 'sculpted' else 'baza parametryczna'
        self.set_state(folder, status='analysed', message=f'{len(report["warnings"])} warnings · {note}')
        return recipe, report

    def match_base(self, folder, recipe):
        """Use a registered sculpted base when the primary reference shows that character."""
        primary = next((r for r in recipe['references'] if r.get('primary')), None)
        bases = load_bases(self.bases)
        if not primary or not bases:
            return recipe
        try:
            thumb = thumbnail(folder/'reference'/primary['file'])
        except ValueError:
            return recipe
        scores = sorted(((similarity(thumb, t), e) for e, t in bases), key=lambda x: -x[0])
        recipe['base_candidates'] = [{'id': e['id'], 'label': e['label'], 'score': round(sc, 4)} for sc, e in scores]
        best, entry = scores[0]
        if best >= MATCH_THRESHOLD:
            recipe['base'] = {'kind': 'sculpted', 'id': entry['id'], 'label': entry['label'], 'score': round(best, 4)}
            recipe['provenance']['base'] = {'source': 'image', 'file': primary['file'],
                                            'detail': f'figure similarity {best:.3f} >= {MATCH_THRESHOLD}'}
        recipe_lib.dump(recipe, folder/'recipe.json')
        return recipe

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
            used = recipe_lib.load(recipe_path)
            if used['base']['kind'] == 'sculpted':
                return self.build_sculpted(folder, build, used)
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

    def blender_run(self, blend, script, args, log):
        command = [str(self.blender), '--background', '--factory-startup', '--disable-autoexec']
        command += [str(blend)] if blend else []
        command += ['--python-exit-code', '1', '--python', str(HERE/script), '--', *map(str, args)]
        with log.open('w') as handle:
            code = subprocess.run(command, stdout=handle, stderr=subprocess.STDOUT, timeout=3600).returncode
        if code:
            raise RuntimeError(f'{script} failed ({code}); see {log.parent.name}/{log.name}')

    def build_sculpted(self, folder, build, recipe):
        """Reduce a registered sculpted base to the game budget; the base file is never changed."""
        entry = json.loads(safe(self.bases, recipe['base']['id']).joinpath('base.json').read_text())
        blend = Path(entry['blend'])
        if hashlib.sha256(blend.read_bytes()).hexdigest() != entry['blend_sha256']:
            raise ValueError('Registered base file changed; register it again')
        started = time.time()

        def event(stage, status='done', **extra):
            with (build/'events.jsonl').open('a') as handle:
                handle.write(json.dumps({'stage': stage, 'status': status, 't': round(time.time()-started, 2), **extra})+'\n')
        event('start', base=entry['id'])
        event('base', label=entry['label'])
        target = BUDGET[recipe['quality']]
        spec = variant_spec(entry, recipe)
        write_json(build/'variant.json', spec)
        if spec['remove'] or spec['recolor']:
            event('variant', recoloured=len(spec['recolor']), removed=len(spec['remove']))
        args = [build, target, 'character', entry.get('colour_attribute') or '', build/'variant.json']
        self.blender_run(blend, 'engine_optimize.py', args, build/'optimize.log')
        opt = json.loads((build/'character-report.json').read_text())
        event('optimize', triangles=opt['triangles'], source_triangles=opt['source_triangles'])
        event('reimport', bones=opt['reimport']['bones'], clips=opt['reimport']['clips'])
        report = {'schema': 'polpal.engine-build/1', 'status': opt['status'], 'base': entry['id'],
                  'blender_version': opt['blender_version'], 'glb': 'character.glb', 'glb_sha256': opt['glb_sha256'],
                  'triangles': opt['triangles'], 'source_triangles': opt['source_triangles'], 'bones': opt['reimport']['bones'],
                  'clips': opt['reimport']['clips'], 'height': opt['reimport']['height'], 'likeness_approved': False,
                  'game_integration': False, 'scope': 'Game-budget copy of a registered sculpted base; review renders before use.'}
        write_json(build/'build-report.json', report)
        event('done', glb='character.glb', triangles=opt['triangles'])
        self.blender_run(None, 'engine_compare.py', [build/'character.glb', build/'renders', 'view'], build/'render.log')
        self.set_state(folder, status=report['status'], message=f'Baza {entry["label"]}; appearance not yet approved')
        return report

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
        if engine.busy:
            raise ValueError('Another build is running')
        # Visible at once, so the preview keeps polling until the new build is done.
        engine.set_state(engine.run_dir(run_id), status='queued', message=None)
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
    ab = sub.add_parser('add-base', help='register a sculpted, rigged base character')
    ab.add_argument('--id', required=True)
    ab.add_argument('--blend', type=Path, required=True)
    ab.add_argument('--reference', type=Path, required=True)
    ab.add_argument('--label', required=True)
    ab.add_argument('--colour-attribute')
    ab.add_argument('--bases', type=Path)
    pb = sub.add_parser('profile-base', help='read a registered base\'s materials for variants (Blender)')
    pb.add_argument('--id', required=True)
    pb.add_argument('--bases', type=Path)
    pb.add_argument('--blender', type=Path, default=DEFAULT_BLENDER)
    s = sub.add_parser('serve')
    s.add_argument('--runs', type=Path, required=True)
    s.add_argument('--port', type=int, default=8790)
    s.add_argument('--bases', type=Path)
    for p in (b, s):
        p.add_argument('--blender', type=Path)
        p.add_argument('--skip-bridge-check', action='store_true',
                       help='do not ask the Blender AI Bridge whether Python is enabled')
    args = parser.parse_args()
    if args.command == 'add-base':
        print(json.dumps(register_base(args.bases or DEFAULT_BASES, args.id, args.blend, args.reference, args.label,
                                       args.colour_attribute), indent=2))
    elif args.command == 'profile-base':
        entry = profile_base(args.bases or DEFAULT_BASES, args.id, args.blender)
        print(json.dumps({'regions': [(r['material'], r['slot'], r['mode']) for r in entry['regions']]}, ensure_ascii=False, indent=1))
    elif args.command == 'analyze':
        recipe, report = reference_pack.analyse(args.pack, args.run, name=args.name)
        print(json.dumps({'recipe': str(args.run/'recipe.json'), 'warnings': report['warnings']}, ensure_ascii=False, indent=2))
    elif args.command == 'build':
        engine = Engine(args.run.parent, args.blender, not args.skip_bridge_check)
        if not (args.run/'state.json').exists():
            engine.set_state(args.run.resolve(), id=args.run.name, name=args.run.name, status='analysed', builds=0)
        print(json.dumps(engine.build(args.run.name), indent=2))
    else:
        engine = Engine(args.runs, args.blender, not args.skip_bridge_check, args.bases)
        server = Server(('127.0.0.1', args.port), engine)
        print(f'Polpal engine preview: http://127.0.0.1:{args.port}/  (runs: {engine.runs})')
        server.serve_forever()


if __name__ == '__main__':
    main()
