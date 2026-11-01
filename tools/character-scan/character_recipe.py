"""Character recipe: the parametric description the local engine builds from.

A recipe is plain JSON. Every value may carry provenance (description text,
measured from an image, or default), so a built model can always be traced
back to what the user supplied. The defaults reproduce the current in-game
Aiko built by scripts/build-aiko.py.

Game contract (docs/blender-project-contract.md): one skinned mesh, 22
mixamorig bones, clips idle/walk/run/swim/hit/throw/jump, height 1.8, feet
at 0, facing glTF +Z. Proportions are fractions of that height.
"""
import copy
import json
import re

SCHEMA = 'polpal.character-recipe/1'
GAME_HEIGHT = 1.8
CLIPS = ('idle', 'walk', 'run', 'swim', 'hit', 'throw', 'jump')
HEX = re.compile(r'^#[0-9A-Fa-f]{6}$')

# Template anchors in build coordinates (metres at height 1.8); see engine_blender.py.
TEMPLATE = {'crotch': .52, 'shoulder': .87, 'chin': 1.20, 'top': 1.80, 'shoulder_x': .16,
            'hand_x': .44, 'torso_width': .48}

PROPORTION_LIMITS = {
    'head_ratio': (.22, .45),      # chin to top of head / height
    'crotch_height': (.20, .42),   # floor to crotch / height
    'shoulder_height': (.38, .62), # floor to shoulder joint / height
    'arm_span': (.34, .70),        # hand centre to hand centre / height
    'torso_width': (.18, .36),     # jacket/torso width / height
    'hair_volume': (.7, 1.6),      # scale of hair masses
    # Garment boundaries, fractions of height from the floor.
    'jacket_hem': (.20, .55),
    'top_hem': (.20, .55),
    'waist': (.20, .50),
    'shorts_hem': (.08, .42),
    'sock_top': (.03, .35),
    'boot_top': (.02, .15),
}

# Face layout in units of the eye-line-to-chin distance (template: eyes at 1.52 m,
# chin at 1.20 m). Values come from the Studio face scan when a frontal face is visible.
FACE_UNIT = .32
FACE_LIMITS = {
    'eye_spacing': (.5, 1.4),    # iris centre to iris centre
    'eye_width': (.25, .75),
    'eye_height': (.3, .8),
    'iris_ratio': (.4, .95),     # iris width / eye width
    'brow_height': (.2, .9),     # brow centre above the eye line
    'mouth_drop': (.25, .8),     # mouth below the eye line
}

STYLES = {
    'hair': ('ponytail_high', 'short'),
    'top': ('puffer_jacket_cropped', 'tshirt'),
    'undershirt': ('crop_top', 'none'),
    'bottom': ('shorts_cargo', 'pants'),
    'legwear': ('socks_knee', 'none'),
    'footwear': ('boots', 'shoes'),
    'back': ('backpack', 'none'),
    'weapon': ('hammer', 'none'),
}

PALETTE_SLOTS = ('skin', 'hair_root', 'hair_tip', 'eyes', 'brows', 'mouth', 'jacket', 'fur', 'top',
                 'shorts', 'straps', 'socks', 'boots', 'backpack', 'sphere_primary', 'sphere_secondary',
                 'sphere_tertiary', 'hammer_wood', 'rune_glow')

DEFAULT = {
    'schema': SCHEMA,
    'name': 'Aiko',
    'quality': 'desktop',
    'game': {'height': GAME_HEIGHT, 'clips': list(CLIPS), 'weapon_hand': 'right'},
    'proportions': {
        'head_ratio': round((TEMPLATE['top']-TEMPLATE['chin'])/GAME_HEIGHT, 4),
        'crotch_height': round(TEMPLATE['crotch']/GAME_HEIGHT, 4),
        'shoulder_height': round(TEMPLATE['shoulder']/GAME_HEIGHT, 4),
        'arm_span': round(2*TEMPLATE['hand_x']/GAME_HEIGHT, 4),
        'torso_width': round(TEMPLATE['torso_width']/GAME_HEIGHT, 4),
        'hair_volume': 1.0,
        # Template garments: jacket to .56 m, crop top hidden, shorts over the thighs to .28 m.
        'jacket_hem': round(.56/GAME_HEIGHT, 4), 'top_hem': round(.56/GAME_HEIGHT, 4),
        'waist': round(.62/GAME_HEIGHT, 4), 'shorts_hem': round(.28/GAME_HEIGHT, 4),
        'sock_top': round(.26/GAME_HEIGHT, 4), 'boot_top': round(.10/GAME_HEIGHT, 4),
    },
    'face': {'eye_spacing': .719, 'eye_width': .3625, 'eye_height': .453, 'iris_ratio': .64,
             'brow_height': .359, 'mouth_drop': .453},
    'palette': {
        'skin': '#FFEEDD', 'hair_root': '#F7A8B8', 'hair_tip': '#7ED6DF', 'eyes': '#2DB5B0',
        'brows': '#E88AA0', 'mouth': '#C96A6A', 'jacket': '#2E9CA6', 'fur': '#F5F5F0', 'top': '#FFFFFF',
        'shorts': '#8B6F47', 'straps': '#2B2B2B', 'socks': '#D8C5A5', 'boots': '#6B4F3A',
        'backpack': '#5C4033', 'sphere_primary': '#3A8DDE', 'sphere_secondary': '#FFFFFF',
        'sphere_tertiary': '#D8C5A5', 'hammer_wood': '#8B5A2B', 'rune_glow': '#FF6EC7',
    },
    'parts': {
        'hair': {'style': 'ponytail_high'},
        'top': {'style': 'puffer_jacket_cropped', 'collar': 'fur', 'puff_rows': 2},
        'undershirt': {'style': 'crop_top'},
        'bottom': {'style': 'shorts_cargo'},
        'legwear': {'style': 'socks_knee'},
        'footwear': {'style': 'boots'},
        'back': {'style': 'backpack', 'spheres': 3},
        'weapon': {'style': 'hammer', 'glow': True},
    },
    # 'parametric': built from the parts library; 'sculpted': a registered sculpted
    # base (e.g. Aiko v16) reduced to the game budget by engine_optimize.py.
    'base': {'kind': 'parametric'},
    'provenance': {},
    'references': [],
}


def default():
    return copy.deepcopy(DEFAULT)


def hex_to_rgb(value):
    """sRGB hex to linear-ish 0..1 tuple as used by build-aiko (plain division)."""
    value = value.lstrip('#')
    return tuple(int(value[i:i+2], 16)/255 for i in (0, 2, 4))


def rgb_to_hex(rgb):
    return '#'+''.join(f'{max(0, min(255, round(c*255))):02X}' for c in rgb)


def merge(base, update):
    """Deep merge of dictionaries; lists and scalars are replaced."""
    out = copy.deepcopy(base)
    for key, value in (update or {}).items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = merge(out[key], value)
        else:
            out[key] = copy.deepcopy(value)
    return out


def validate(recipe):
    """Raise ValueError on anything the builder could not honour; return the recipe."""
    if recipe.get('schema') != SCHEMA:
        raise ValueError('Unknown recipe schema')
    if recipe.get('quality') not in ('desktop', 'mobile'):
        raise ValueError('quality must be desktop or mobile')
    game = recipe.get('game', {})
    if game.get('height') != GAME_HEIGHT:
        raise ValueError('Game height is fixed at 1.8 by the project contract')
    if tuple(game.get('clips', ())) != CLIPS:
        raise ValueError('Clips must be exactly '+', '.join(CLIPS))
    if game.get('weapon_hand') not in ('left', 'right'):
        raise ValueError('weapon_hand must be left or right')
    p = recipe.get('proportions', {})
    for key, (lo, hi) in PROPORTION_LIMITS.items():
        value = p.get(key)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not lo <= value <= hi:
            raise ValueError(f'proportions.{key} must be in {lo}..{hi}')
    if p['shoulder_height']-p['crotch_height'] < .12:
        raise ValueError('Torso too short: shoulder must be at least 0.12 above crotch')
    if 1-p['head_ratio']-p['shoulder_height'] < .03:
        raise ValueError('Head overlaps shoulders: chin must be above the shoulder joint')
    if p['arm_span']/2 <= p['torso_width']/2:
        raise ValueError('Hands must lie outside the torso')
    if not p['boot_top'] <= p['sock_top'] <= p['shorts_hem'] <= p['crotch_height']+.02:
        raise ValueError('Legwear order must be boot_top <= sock_top <= shorts_hem <= crotch')
    if not (p['crotch_height'] <= p['waist'] and p['top_hem'] <= p['jacket_hem']+1e-9):
        raise ValueError('Torso order must be crotch <= waist and top_hem <= jacket_hem')
    if p['jacket_hem'] > p['shoulder_height']-.08:
        raise ValueError('Jacket hem must lie below the shoulders')
    face = recipe.get('face', {})
    for key, (lo, hi) in FACE_LIMITS.items():
        value = face.get(key)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not lo <= value <= hi:
            raise ValueError(f'face.{key} must be in {lo}..{hi}')
    if face['eye_spacing'] < face['eye_width']*.9:
        raise ValueError('Eyes would overlap: eye_spacing must be at least 0.9 x eye_width')
    base = recipe.get('base', {'kind': 'parametric'})
    if base.get('kind') not in ('parametric', 'sculpted'):
        raise ValueError('base.kind must be parametric or sculpted')
    if base['kind'] == 'sculpted' and not re.match(r'^[a-z0-9][a-z0-9-]{1,40}$', str(base.get('id', ''))):
        raise ValueError('A sculpted base needs a registered base id')
    palette = recipe.get('palette', {})
    for slot in PALETTE_SLOTS:
        if not HEX.match(str(palette.get(slot, ''))):
            raise ValueError(f'palette.{slot} must be #RRGGBB')
    parts = recipe.get('parts', {})
    for part, styles in STYLES.items():
        if parts.get(part, {}).get('style') not in styles:
            raise ValueError(f'parts.{part}.style must be one of '+', '.join(styles))
    spheres = parts['back'].get('spheres', 0)
    if type(spheres) is not int or not 0 <= spheres <= 6:
        raise ValueError('parts.back.spheres must be 0..6')
    return recipe


def load(path):
    with open(path, encoding='utf-8') as handle:
        return validate(json.load(handle))


def dump(recipe, path):
    validate(recipe)
    with open(path, 'w', encoding='utf-8') as handle:
        json.dump(recipe, handle, ensure_ascii=False, indent=2)
        handle.write('\n')
