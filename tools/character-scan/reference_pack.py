"""Reference pack -> draft character recipe.

Input: a .zip, a folder or a single image. Images and description text are
treated as data only: nothing from the pack is executed, scripts are listed
as ignored. Output: a draft recipe (character_recipe) where every changed
value records where it came from, plus a report of what could not be read.
"""
import hashlib
import json
import re
import shutil
import zipfile
from pathlib import Path, PurePosixPath

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

import character_recipe as recipe_lib

IMAGE_EXT = {'.png', '.jpg', '.jpeg', '.webp'}
TEXT_EXT = {'.txt', '.md'}
KEEP_EXT = IMAGE_EXT | TEXT_EXT | {'.json', '.glb'}
MAX_FILES = 64
MAX_TOTAL_BYTES = 256*1024*1024
MAX_PIXELS = 40_000_000
ROLES = (('tpose', ('tpose', 't-pose', 't_pose')), ('front', ('front', 'przod')), ('idle', ('idle',)),
         ('run', ('run',)), ('attack', ('attack', 'hit')), ('throw', ('throw',)), ('side', ('side', 'bok')),
         ('back', ('back', 'tyl')))


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def extract(source, dest):
    """Copy usable files of a pack into an empty dest folder. Returns (files, ignored)."""
    source, dest = Path(source), Path(dest)
    dest.mkdir(parents=True, exist_ok=False)
    files, ignored, total = [], [], 0

    def accept(name, size):
        nonlocal total
        base = PurePosixPath(name).name
        suffix = PurePosixPath(base).suffix.lower()
        if not base or base.startswith('.') or suffix not in KEEP_EXT:
            ignored.append(name)
            return None
        if len(files) >= MAX_FILES:
            raise ValueError('Pack has too many files')
        total += size
        if total > MAX_TOTAL_BYTES:
            raise ValueError('Pack is too large')
        target = dest/base
        if target.exists():
            ignored.append(name+' (duplicate name)')
            return None
        return target

    if source.is_file() and zipfile.is_zipfile(source):
        with zipfile.ZipFile(source) as archive:
            for info in archive.infolist():
                if info.is_dir():
                    continue
                name = info.filename
                if name.startswith('/') or '..' in PurePosixPath(name).parts or '__MACOSX' in name:
                    ignored.append(name)
                    continue
                target = accept(name, info.file_size)
                if target is None:
                    continue
                with archive.open(info) as src, open(target, 'wb') as out:
                    copied = shutil.copyfileobj(src, out, 1 << 20)
                if target.stat().st_size != info.file_size:
                    raise ValueError('Archive entry size mismatch: '+name)
                files.append(target)
    elif source.is_dir():
        for path in sorted(p for p in source.rglob('*') if p.is_file()):
            target = accept(path.relative_to(source).as_posix(), path.stat().st_size)
            if target is not None:
                shutil.copyfile(path, target)
                files.append(target)
    elif source.is_file():
        target = accept(source.name, source.stat().st_size)
        if target is None:
            raise ValueError('Unsupported reference file type')
        shutil.copyfile(source, target)
        files.append(target)
    else:
        raise FileNotFoundError(source)
    return files, ignored


def role(name):
    lower = name.lower()
    for key, words in ROLES:
        if any(word in lower for word in words):
            return key
    return 'other'


# ---------------------------------------------------------------- description text
KEYWORDS = [  # (slot, stems) — matched against lower-case text before a colour
    ('hair_tip', ('końcówk', 'koncowk', 'tips', 'tip ')),
    ('hair_root', ('włos', 'wlos', 'hair')),
    ('eyes', ('oczy', 'oko', 'eye', 'iris', 'tęczówk')),
    ('brows', ('brwi', 'brew', 'brow')),
    ('skin', ('cera', 'skóra', 'skora', 'skin')),
    ('fur', ('futr', 'fur', 'kołnierz', 'kolnierz', 'collar')),
    ('jacket', ('kurtk', 'jacket')),
    ('top', ('crop top', 'koszul', 'shirt', ' top')),
    ('straps', ('paski', 'pasek', 'strap')),
    ('shorts', ('szort', 'shorts', 'spodn', 'pants')),
    ('socks', ('skarpet', 'sock')),
    ('boots', ('trapery', 'buty', 'boot', 'shoe')),
    ('backpack', ('plecak', 'backpack')),
    ('sphere_primary', ('sphere', 'sfer', 'kul')),
    ('rune_glow', ('run', 'rune', 'emissive')),
    ('hammer_wood', ('młot', 'mlot', 'hammer')),
]
SEQUENCES = {'sphere_primary': 'sphere_secondary', 'sphere_secondary': 'sphere_tertiary', 'hair_root': 'hair_tip'}
COLOUR = re.compile(r'#[0-9A-Fa-f]{6}\b')


def _slot_for(segment):
    """Keyword closest to the end of segment (i.e. nearest before the colour)."""
    best, position = None, -1
    lower = segment.lower()
    for slot, stems in KEYWORDS:
        for stem in stems:
            index = lower.rfind(stem)
            if index > position:
                best, position = slot, index
    return best


def parse_description(text):
    """Colours, styles and proportions stated in a free-form description."""
    palette, provenance, hints = {}, {}, {}
    for line in text.splitlines():
        start, previous = 0, None
        for match in COLOUR.finditer(line):
            segment = line[start:match.start()]
            slot = _slot_for(segment)
            if slot is None and previous in SEQUENCES:
                slot = SEQUENCES[previous]
            if slot is None and start == 0:
                slot = _slot_for(line[:match.start()])
            if slot and slot not in palette:
                palette[slot] = match.group(0).upper()
                provenance['palette.'+slot] = {'source': 'description', 'text': line.strip()[:160]}
            previous, start = slot, match.end()
    lower = text.lower()
    m = re.search(r'proporcj\w*\s*1\s*:\s*(\d+(?:[.,]\d+)?)|proportion\w*\s*1\s*:\s*(\d+(?:[.,]\d+)?)', lower)
    if m:
        heads = float((m.group(1) or m.group(2)).replace(',', '.'))
        if heads > 0:
            hints['proportions.head_ratio'] = (round(1/heads, 4), 'description: proporcje 1:'+str(heads).rstrip('0').rstrip('.'))
    m = re.search(r'(?:oczy|eyes)[^\n]*?(\d{1,2})\s*%\s*(?:twarzy|of (?:the )?face)', lower)
    if m:
        # Template eye white spans ~24% of the face height.
        # Template eye spans ~24% of the face height; scale the eye height accordingly.
        hints['face.eye_height'] = (round(.453*int(m.group(1))/24, 3), f'description: oczy {m.group(1)}% twarzy')
    m = re.search(r'(\d+(?:[.,]\d+)?)\s*k\s*tris', lower)
    if m:
        hints['target_triangles'] = (int(float(m.group(1).replace(',', '.'))*1000), 'description: polycount')
    m = re.search(r'wzrost:?\s*(\d+(?:[.,]\d+)?)\s*m|height:?\s*(\d+(?:[.,]\d+)?)\s*m', lower)
    if m:
        hints['stated_height_m'] = (float((m.group(1) or m.group(2)).replace(',', '.')),
                                    'description; the game normalises every hero to 1.8 units')
    styles = [('parts.hair.style', 'ponytail_high', ('kucyk', 'ponytail')),
              ('parts.top.style', 'puffer_jacket_cropped', ('puchow', 'puffer', 'down jacket')),
              ('parts.top.collar', 'fur', ('futrzany kołnierz', 'fur collar', 'futrzany')),
              ('parts.undershirt.style', 'crop_top', ('crop top',)),
              ('parts.bottom.style', 'shorts_cargo', ('szort', 'shorts')),
              ('parts.legwear.style', 'socks_knee', ('do kolan', 'knee')),
              ('parts.footwear.style', 'boots', ('trapery', 'boots', 'buty')),
              ('parts.back.style', 'backpack', ('plecak', 'backpack')),
              ('parts.weapon.style', 'hammer', ('młot', 'mlot', 'hammer'))]
    for key, value, stems in styles:
        hit = next((s for s in stems if s in lower), None)
        if hit:
            hints[key] = (value, 'description: '+hit)
    m = re.search(r'(\d)\s*x\s*pal\s*spher', lower)
    if m:
        hints['parts.back.spheres_described'] = (int(m.group(1)), 'description')
    return palette, provenance, hints


# ---------------------------------------------------------------- silhouette measurement
def figure_mask(image):
    """Foreground of a single character on a roughly uniform background."""
    rgb = np.asarray(image.convert('RGB'), float)
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    background = np.median(border, axis=0)
    spread = np.percentile(np.linalg.norm(border-background, axis=1), 90)
    if spread > 40:
        raise ValueError('Background is not uniform enough for automatic measurement')
    fg = np.linalg.norm(rgb-background, axis=2) > max(60., spread*3)
    fg = ndi.binary_opening(fg, iterations=2)
    labels, count = ndi.label(fg)
    if not count:
        raise ValueError('No figure found')
    sizes = ndi.sum(fg, labels, range(1, count+1))
    main = int(np.argmax(sizes))+1
    keep = np.isin(labels, [i+1 for i, s in enumerate(sizes) if s >= .02*sizes[main-1]])
    return keep, background


def _run(row, x):
    if not row[x]:
        return None
    left = x
    while left > 0 and row[left-1]:
        left -= 1
    right = x
    while right < len(row)-1 and row[right+1]:
        right += 1
    return left, right


def measure(image):
    """Fractions of figure height, top = 0. Suited to front T-pose images."""
    fg, background = figure_mask(image)
    ys, xs = np.nonzero(fg)
    top, bottom = int(ys.min()), int(ys.max())
    height = bottom-top
    if height < 200:
        raise ValueError('Figure too small to measure')
    lower = ys > bottom-.35*height
    axis = int(np.median(xs[lower]))
    # Crotch: scanning up from the feet, the first row where the axis meets the
    # body after a real gap between the legs (shadows or soles do not count).
    crotch, gap = None, 0
    for y in range(bottom, top, -1):
        if not fg[y, axis]:
            gap += 1
        elif gap >= .08*height:
            crotch = y
            break
        else:
            gap = 0
    band = slice(top+int(.25*height), top+int(.65*height))
    widths = fg[band].sum(axis=1)
    arm_row = band.start+int(np.argmax(widths))
    row_x = np.flatnonzero(fg[arm_row])
    left_reach, right_reach = axis-row_x.min(), row_x.max()-axis
    torso = _run(fg[top+int(.58*height)], axis)
    result = {'image_size': list(image.size), 'background_rgb': background.round().tolist(),
              'figure_top_px': top, 'figure_bottom_px': bottom, 'axis_x_px': axis,
              'crotch_from_top': None if crotch is None else round((crotch-top)/height, 4),
              'arm_row_from_top': round((arm_row-top)/height, 4),
              'reach_left_px': int(left_reach), 'reach_right_px': int(right_reach),
              'half_span': round(min(left_reach, right_reach)/height, 4),
              'torso_width': None if torso is None else round((torso[1]-torso[0])/height, 4)}
    # The side reaching further usually holds an item; image left is the character's right.
    if max(left_reach, right_reach) > 1.15*min(left_reach, right_reach):
        result['held_item_side'] = 'right' if left_reach > right_reach else 'left'
    return result, fg


def sample_colours(image, fg, m):
    """Median colour of the figure in a few body bands near the axis (observations only)."""
    rgb = np.asarray(image.convert('RGB'))
    top, bottom, axis = m['figure_top_px'], m['figure_bottom_px'], m['axis_x_px']
    height = bottom-top
    bands = {'hair_root': (.03, .10, .35), 'shorts': (.64, .70, .10), 'socks': (.80, .86, .16),
             'boots': (.93, .99, .16)}
    out = {}
    for slot, (a, b, half) in bands.items():
        y0, y1 = top+int(a*height), top+int(b*height)
        x0, x1 = max(0, axis-int(half*height)), min(rgb.shape[1], axis+int(half*height))
        mask = fg[y0:y1, x0:x1]
        if mask.sum() < 50:
            continue
        pixels = rgb[y0:y1, x0:x1][mask]
        out[slot] = recipe_lib.rgb_to_hex(np.median(pixels, axis=0)/255)
    return out


def colour_distance(a, b):
    return float(np.linalg.norm(np.subtract(recipe_lib.hex_to_rgb(a), recipe_lib.hex_to_rgb(b)))*255)


def lab(rgb255):
    """sRGB 0..255 -> CIE Lab (D65)."""
    c = np.asarray(rgb255, float)/255
    c = np.where(c > .04045, ((c+.055)/1.055)**2.4, c/12.92)
    xyz = c@np.array([[.4124, .3576, .1805], [.2126, .7152, .0722], [.0193, .1192, .9505]]).T/np.array([.9505, 1, 1.089])
    f = np.where(xyz > .008856, np.cbrt(xyz), 7.787*xyz+16/116)
    return np.stack([116*f[..., 1]-16, 500*(f[..., 0]-f[..., 1]), 200*(f[..., 1]-f[..., 2])], -1)


LIGHTNESS_WEIGHT = .3  # shading changes lightness far more than hue


def ordered_segments(colours, references, minimum):
    """Split rows into consecutive segments, one per reference colour, in order.

    colours: rows x 3 (sRGB 0..255); references: segments x 3. Dynamic
    programming over boundaries minimises the summed Lab distance, so single
    mislabelled rows cannot break the known garment order.
    """
    w = np.array([LIGHTNESS_WEIGHT, 1, 1])
    cost = np.linalg.norm(lab(colours)[:, None]*w-lab(references)[None]*w, axis=2)
    n, k = cost.shape
    if n < minimum*k:
        raise ValueError('Too few rows for the requested segments')
    cumulative = np.vstack([np.zeros(k), np.cumsum(cost, axis=0)])
    best = np.full((n+1, k+1), np.inf)
    best[0, 0] = 0
    start = np.zeros((n+1, k+1), int)
    for j in range(1, k+1):
        for i in range(minimum*j, n+1):
            s = np.arange(minimum*(j-1), i-minimum+1)
            c = best[s, j-1]+cumulative[i, j-1]-cumulative[s, j-1]
            a = int(np.argmin(c))
            best[i, j], start[i, j] = c[a], s[a]
    bounds, i = [], n
    for j in range(k, 0, -1):
        bounds.append((int(start[i, j]), i))
        i = start[i, j]
    return bounds[::-1]


def _strip(rgb, fg, rows, columns):
    ys, colours = [], []
    for y in rows:
        cols = [c for c in columns(y) if 0 <= c < rgb.shape[1]]
        px = rgb[y, cols][fg[y, cols]] if cols else []
        if len(px) >= 3:
            ys.append(y)
            colours.append(np.median(px, axis=0))
    return np.asarray(ys), np.asarray(colours)


def garment_bands(image, fg, m, palette):
    """Garment boundaries along the torso centre, torso sides and legs (fractions from the top).

    Only for a front T-pose with a jacket over a top, exposed belly and bare
    thighs above socks and boots; each band is reported with the colours used.
    """
    rgb = np.asarray(image.convert('RGB'), float)
    top, bottom, axis = m['figure_top_px'], m['figure_bottom_px'], m['axis_x_px']
    height = bottom-top
    if m.get('crotch_from_top') is None:
        raise ValueError('Leg gap not found')
    crotch = top+int(m['crotch_from_top']*height)
    shoulder = top+int(m['arm_row_from_top']*height)
    ref = {k: np.array(recipe_lib.hex_to_rgb(v))*255 for k, v in palette.items()}
    step = max(1, height//600)
    frac = lambda y: round((y-top)/height, 4)  # noqa: E731
    out = {}
    centre = lambda y: range(axis-int(.03*height), axis+int(.03*height))  # noqa: E731
    ys, cols = _strip(rgb, fg, range(shoulder, crotch, step), centre)
    seg = ordered_segments(cols, [ref['top'], ref['skin'], ref['shorts']], 5)
    out['top_hem'], out['waist'] = frac(ys[seg[0][1]-1]), frac(ys[seg[1][1]-1])
    skin = np.median(cols[seg[1][0]:seg[1][1]], axis=0)
    out['observed_skin'] = recipe_lib.rgb_to_hex(skin/255)
    sides = lambda y: list(range(axis-int(.12*height), axis-int(.08*height)))+list(range(axis+int(.08*height), axis+int(.12*height)))  # noqa: E731
    ys, cols = _strip(rgb, fg, range(shoulder, crotch, step), sides)
    seg = ordered_segments(cols, [ref['jacket'], ref['shorts']], 5)
    out['jacket_hem'] = frac(ys[seg[0][1]-1])

    def legs(y):
        span = fg[y, axis-int(.25*height):axis+int(.25*height)]
        xs = np.flatnonzero(span)+axis-int(.25*height)
        cols = []
        for side in (xs[xs < axis], xs[xs > axis]):
            if len(side):
                c = int(np.median(side))
                cols += list(range(c-int(.012*height), c+int(.012*height)))
        return cols
    ys, cols = _strip(rgb, fg, range(crotch, bottom, step), legs)
    seg = ordered_segments(cols, [skin, ref['socks'], ref['boots']], 6)
    out['sock_top'], out['boot_top'] = frac(ys[seg[1][0]]), frac(ys[seg[2][0]])
    out['shorts_hem'] = m['crotch_from_top']
    return out


def face_layout(path, m):
    """Eyes, brows and mouth from the Studio face scanner, relative to eye line -> chin."""
    from face_scan import scan_face
    top, height, axis = m['figure_top_px'], m['figure_bottom_px']-m['figure_top_px'], m['axis_x_px']
    roi = [axis-int(.17*height), top+int(.08*height), axis+int(.17*height), top+int(.40*height)]
    result, _, _ = scan_face(str(path), hints={'roi': roi})
    f = result.get('features', {})
    need = ('iris_left', 'iris_right', 'eye_left', 'eye_right')
    if any(f.get(k, {}).get('status') != 'candidate' or f[k].get('touches_region_boundary') for k in need):
        raise ValueError('eyes not found as clean candidates')
    chin = result.get('face_shape', {}).get('chin_bottom', {}).get('point_px')
    if not chin:
        raise ValueError('chin not found')
    eye_line = (f['iris_left']['centroid_px'][1]+f['iris_right']['centroid_px'][1])/2
    unit = chin[1]-eye_line
    if unit <= 10:
        raise ValueError('eye line not above the chin')
    width = lambda k: f[k]['bbox_px'][2]-f[k]['bbox_px'][0]+1  # noqa: E731
    tall = lambda k: f[k]['bbox_px'][3]-f[k]['bbox_px'][1]+1  # noqa: E731
    values = {'eye_spacing': abs(f['iris_right']['centroid_px'][0]-f['iris_left']['centroid_px'][0])/unit,
              'eye_width': (width('eye_left')+width('eye_right'))/2/unit,
              'eye_height': (tall('eye_left')+tall('eye_right'))/2/unit,
              'iris_ratio': (width('iris_left')+width('iris_right'))/(width('eye_left')+width('eye_right'))}
    brows = [f[k]['centroid_px'][1] for k in ('brow_left', 'brow_right') if f.get(k, {}).get('centroid_px')]
    if brows:
        values['brow_height'] = (eye_line-sum(brows)/len(brows))/unit
    if f.get('mouth', {}).get('centroid_px'):
        values['mouth_drop'] = (f['mouth']['centroid_px'][1]-eye_line)/unit
    return {'roi_px': roi, 'eye_line_px': eye_line, 'chin_px': chin, 'unit_px': unit, 'values': values,
            'scope': 'Visible 2D features of one frontal image; depth and hidden parts are not measured.'}


# ---------------------------------------------------------------- draft recipe
def draft(pack_dir, name=None):
    pack_dir = Path(pack_dir)
    recipe = recipe_lib.default()
    recipe['name'] = name or 'Character'
    recipe['provenance'] = {}
    report = {'schema': 'polpal.reference-report/1', 'warnings': [], 'measurements': None,
              'observed_colours': {}, 'description_used': None}
    images = sorted(p for p in pack_dir.iterdir() if p.suffix.lower() in IMAGE_EXT)
    texts = sorted(p for p in pack_dir.iterdir() if p.suffix.lower() in TEXT_EXT)
    recipe['references'] = [{'file': p.name, 'sha256': sha256(p), 'role': role(p.name)} for p in images]
    for item in recipe['references']:
        with Image.open(pack_dir/item['file']) as im:
            if im.width*im.height > MAX_PIXELS:
                raise ValueError('Reference image too large: '+item['file'])
            item['size'] = list(im.size)
    if not images:
        raise ValueError('Pack contains no images')
    # Description: prefer Markdown, then plain text; duplicates add nothing.
    if texts:
        text_file = next((p for p in texts if p.suffix.lower() == '.md'), texts[0])
        text = text_file.read_text(encoding='utf-8', errors='replace')
        report['description_used'] = text_file.name
        palette, provenance, hints = parse_description(text)
        recipe['palette'].update(palette)
        recipe['provenance'].update(provenance)
        for key, (value, source) in hints.items():
            path = key.split('.')
            if path[0] == 'proportions' and path[1] in recipe['proportions']:
                lo, hi = recipe_lib.PROPORTION_LIMITS[path[1]]
                if lo <= value <= hi:
                    recipe['proportions'][path[1]] = value
                    recipe['provenance'][key] = {'source': 'description', 'text': source}
                else:
                    report['warnings'].append(f'{key}={value} outside supported range; default kept')
            elif path[0] == 'face':
                lo, hi = recipe_lib.FACE_LIMITS[path[1]]
                if lo <= value <= hi:
                    recipe['face'][path[1]] = value
                    recipe['provenance'][key] = {'source': 'description', 'text': source}
            elif path[0] == 'parts' and path[2] in ('style', 'collar'):
                recipe['parts'][path[1]][path[2]] = value
                recipe['provenance'][key] = {'source': 'description', 'text': source}
            else:
                report.setdefault('description_hints', {})[key] = {'value': value, 'note': source}
        if 'parts.back.spheres_described' in hints:
            described = hints['parts.back.spheres_described'][0]
            recipe['parts']['back']['spheres'] = min(described, 6)
            recipe['provenance']['parts.back.spheres'] = {'source': 'description', 'text': f'{described}x Pal Spheres'}
    else:
        report['warnings'].append('No description text; palette from defaults and image samples only')
    # Silhouette: the most frontal neutral pose available.
    order = ('tpose', 'front', 'idle')
    primary = next((r for key in order for r in recipe['references'] if r['role'] == key), recipe['references'][0])
    primary['primary'] = True
    with Image.open(pack_dir/primary['file']) as im:
        try:
            m, fg = measure(im)
        except ValueError as error:
            report['warnings'].append(f'Silhouette not measured ({primary["file"]}): {error}')
            m = None
        if m:
            report['measurements'] = {'image': primary['file'], **m}
            props = recipe['proportions']
            def take(key, value, detail):
                lo, hi = recipe_lib.PROPORTION_LIMITS[key]
                if value is None:
                    return
                if lo <= value <= hi:
                    props[key] = round(value, 4)
                    recipe['provenance']['proportions.'+key] = {'source': 'image', 'file': primary['file'], 'detail': detail}
                else:
                    report['warnings'].append(f'Measured {key}={value:.3f} outside {lo}..{hi}; not used')
            if m['crotch_from_top'] is not None:
                take('crotch_height', 1-m['crotch_from_top'], 'axis meets body above the leg gap')
            if primary['role'] == 'tpose':
                # In a T-pose the arm line sits just below the shoulder joint.
                take('shoulder_height', 1-m['arm_row_from_top']+.02, 'widest row of the T-pose arms')
                take('arm_span', 2*m['half_span']*.92, 'shorter arm reach, hand centre ~8% inside fingertips')
                if m.get('held_item_side'):
                    recipe['game']['weapon_hand'] = m['held_item_side']
                    recipe['provenance']['game.weapon_hand'] = {'source': 'image', 'file': primary['file'],
                                                                'detail': 'side with the longer reach holds an item'}
            else:
                report['warnings'].append('No T-pose image: shoulders and arm span keep defaults')
            take('torso_width', m['torso_width'], 'body width at 58% of height')
            styles = recipe['parts']
            if (primary['role'] == 'tpose' and styles['top']['style'] == 'puffer_jacket_cropped'
                    and styles['legwear']['style'] == 'socks_knee' and styles['footwear']['style'] == 'boots'):
                try:
                    bands = garment_bands(im, fg, m, recipe['palette'])
                except ValueError as error:
                    report['warnings'].append(f'Garment bands not measured: {error}')
                    bands = None
                if bands:
                    report['garment_bands'] = bands
                    for key in ('jacket_hem', 'top_hem', 'waist', 'shorts_hem', 'sock_top', 'boot_top'):
                        take(key, 1-bands[key], 'ordered colour segmentation (Lab), skin calibrated on the belly')
            else:
                report['warnings'].append('Garment lengths keep defaults (bands need a T-pose with jacket, socks and boots)')
            try:
                face = face_layout(pack_dir/primary['file'], m)
            except Exception as error:  # scanner is heuristic; a miss keeps defaults/description
                report['warnings'].append(f'Face scan not used: {error}')
                face = None
            if face:
                report['face_scan'] = face
                for key, value in face['values'].items():
                    lo, hi = recipe_lib.FACE_LIMITS[key]
                    if lo <= value <= hi:
                        recipe['face'][key] = round(value, 4)
                        recipe['provenance']['face.'+key] = {'source': 'scan', 'file': primary['file'],
                                                             'detail': 'Studio face_scan, unit = eye line to chin'}
                    else:
                        report['warnings'].append(f'Scanned face.{key}={value:.3f} outside {lo}..{hi}; not used')
            observed = sample_colours(im, fg, m)
            report['observed_colours'] = observed
            for slot, value in observed.items():
                if 'palette.'+slot not in recipe['provenance']:
                    recipe['palette'][slot] = value
                    recipe['provenance']['palette.'+slot] = {'source': 'image', 'file': primary['file']}
                elif colour_distance(value, recipe['palette'][slot]) > 90:
                    report['warnings'].append(f'palette.{slot}: description {recipe["palette"][slot]} differs from image {value}')
    # Keep the head/shoulder relation buildable.
    p = recipe['proportions']
    if 1-p['head_ratio']-p['shoulder_height'] < .03:
        p['shoulder_height'] = round(1-p['head_ratio']-.03, 4)
        report['warnings'].append('Shoulder lowered to stay below the chin')
    recipe_lib.validate(recipe)
    return recipe, report


def analyse(source, run_dir, name=None):
    """Extract a pack into run_dir/reference, write recipe.json and reference-report.json."""
    run_dir = Path(run_dir)
    files, ignored = extract(source, run_dir/'reference')
    recipe, report = draft(run_dir/'reference', name=name)
    report['ignored_files'] = ignored
    report['source'] = {'name': Path(source).name, 'sha256': sha256(source) if Path(source).is_file() else None}
    recipe_lib.dump(recipe, run_dir/'recipe.json')
    (run_dir/'reference-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    return recipe, report
