"""Polpal Studio engine — sculpted base -> game-ready GLB (Blender side).

Takes a rigged, high-poly character (.blend with one armature and one skinned
mesh, e.g. Aiko v16) and writes a lighter copy for the game:

  1. split the skinned mesh by material,
  2. share a triangle budget by importance x sqrt(visible area), so large
     plain parts (jacket, backpack, boots) are not starved by dense ones,
  3. decimate each part BEFORE the Armature modifier (the pose is never baked),
  4. join, keep at most 4 deforming influences per vertex, normalise weights,
  5. export GLB with the base's settings and reimport to check the contract.

The source file is never saved. Run:
  Blender --background --factory-startup --disable-autoexec BASE.blend --python engine_optimize.py -- OUT_DIR TARGET_TRIS LABEL [COLOR_ATTRIBUTE [VARIANT.json]]

VARIANT.json (optional, from engine.py) turns the base into a variant:
  {"remove": [material names], "recolor": [{"material", "mode": factor|vertex|gradient|texture,
   "from", "to", ["from2", "to2"], ["emission"], ["ratio"]}]}   colours are linear RGB;
  "ratio" (skin) multiplies each channel, keeping freckles and blush relative to the skin.
"""
import hashlib
import json
import math
import sys
import time
from pathlib import Path

import bpy

args = sys.argv[sys.argv.index('--')+1:]
out, target, label = Path(args[0]), int(args[1]), args[2]
colour_name = args[3] if len(args) > 3 and args[3] else None
variant = json.loads(Path(args[4]).read_text()) if len(args) > 4 else {'remove': [], 'recolor': []}
CLIPS = {'idle', 'walk', 'run', 'swim', 'hit', 'throw', 'jump'}
# Detail priority by material name (lower-case stems); first match wins.
PRIORITY = (('iris', 6), ('pupil', 6), ('catchlight', 6), ('sclera', 5), ('eye', 5), ('eyelashes', 4), ('lash', 4),
            ('brow', 4), ('mouth', 4), ('lip', 4), ('face', 5), ('freckles', 5), ('nose', 5), ('hair', 3), ('fringe', 3), ('pony', 3), ('skin', 3), ('face', 3),
            ('freckles', 3), ('hand', 2.5), ('finger', 2.5), ('nylon', 1.5), ('rune', 1.5),
            # Fine surface detail that reads as texture at game distance:
            ('fibres', .4), ('channels', .5), ('seam', .5), ('piping', .5), ('hardware', .5), ('inset', .5))
THIN = ('fibres',)  # loose fibres are thinned evenly; other parts lose their smallest islands first
FIBRE_KEEP = .33    # fibre parts keep at least a third of their islands
FITTING_KEEP = .5   # parts of many small fittings (rivets, stitches) keep at least half
OVERSHOOT = 1.05  # accept up to 5% above the budget
started = time.time()
out.mkdir(parents=True, exist_ok=True)
glb = out/f'{label}.glb'
if glb.exists():
    raise FileExistsError(glb)
source_file = bpy.data.filepath
scene = bpy.context.scene
if bpy.context.mode != 'OBJECT':
    raise RuntimeError('Expected Object Mode')
arms = [o for o in scene.objects if o.type == 'ARMATURE']
meshes = [o for o in scene.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers)]
if len(arms) != 1 or len(meshes) != 1:
    raise RuntimeError(f'Expected one armature and one skinned mesh, found {len(arms)} and {len(meshes)}')
arm, mesh = arms[0], meshes[0]
source_tris = sum(len(p.vertices)-2 for p in mesh.data.polygons)
bones = {b.name for b in arm.data.bones}

import bmesh  # noqa: E402
import numpy as np  # noqa: E402

# 0) variant: drop whole parts (by material) before anything else
removed = 0
if variant['remove']:
    names = set(variant['remove'])
    drop = {i for i, m in enumerate(mesh.data.materials) if m and m.name in names}
    bm = bmesh.new()
    bm.from_mesh(mesh.data)
    faces = [f for f in bm.faces if f.material_index in drop]
    removed = sum(len(f.verts)-2 for f in faces)
    if faces:
        # Small fittings of the part (bands, wraps, clips) are other materials:
        # drop every mesh island that lies entirely inside the part's bounds.
        pts = np.array([v.co[:] for f in faces for v in f.verts])
        lo, hi = pts.min(axis=0), pts.max(axis=0)
        pad = (hi-lo)*.08+.005
        lo, hi = lo-pad, hi+pad
        bm.faces.ensure_lookup_table()
        seen, extra = set(f.index for f in faces), []
        for f in bm.faces:
            if f.index in seen:
                continue
            island, stack = [], [f]
            seen.add(f.index)
            while stack:
                cur = stack.pop()
                island.append(cur)
                for e in cur.edges:
                    for nb in e.link_faces:
                        if nb.index not in seen:
                            seen.add(nb.index)
                            stack.append(nb)
            co = np.array([v.co[:] for g in island for v in g.verts])
            if len(island) < 20000 and (co >= lo).all() and (co <= hi).all():
                extra += island
        removed += sum(len(f.verts)-2 for f in extra)
        faces += extra
    bmesh.ops.delete(bm, geom=faces, context='FACES_ONLY')
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    bm.to_mesh(mesh.data)
    bm.free()  # unused material slots stay; the exporter skips materials no face uses

# 1) split by material
bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True)
bpy.context.view_layer.objects.active = mesh
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.separate(type='MATERIAL')
bpy.ops.object.mode_set(mode='OBJECT')
parts = [o for o in bpy.context.selected_objects if o.type == 'MESH']


def decimate(obj, ratio):
    mod = obj.modifiers.new('engine_decimate', 'DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.ratio = ratio
    mod.use_collapse_triangulate = True
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    # before the Armature modifier, so only rest geometry is reduced
    bpy.ops.object.modifier_move_to_index(modifier=mod.name, index=0)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def thin(obj, keep, smallest=False):
    """Keep about `keep` of a part's triangles by removing whole loose islands.

    Fibres lose an even spread of islands; other parts (rivets, stitches) lose
    their smallest islands first, which are the first to vanish at game distance.
    """
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    seen, islands = set(), []
    for f in bm.faces:
        if f.index in seen:
            continue
        island, stack = [], [f]
        seen.add(f.index)
        while stack:
            cur = stack.pop()
            island.append(cur)
            for e in cur.edges:
                for nb in e.link_faces:
                    if nb.index not in seen:
                        seen.add(nb.index)
                        stack.append(nb)
        islands.append(island)
    if len(islands) < 20:
        bm.free()
        return False
    if smallest:
        drop, total = [], sum(len(f.verts)-2 for f in bm.faces)
        allowed = total*(1-keep)
        for island in sorted(islands, key=lambda isl: sum(f.calc_area() for f in isl)):
            size = sum(len(f.verts)-2 for f in island)
            if size > allowed:
                break
            drop += island
            allowed -= size
    else:
        golden = .6180339887
        drop = [f for i, island in enumerate(islands) if (i*golden) % 1 >= keep for f in island]
    bmesh.ops.delete(bm, geom=drop, context='FACES')
    bm.to_mesh(obj.data)
    bm.free()
    return True


def area(obj):
    return sum(p.area for p in obj.data.polygons)*max(obj.scale)**2


def count(obj):
    return sum(len(p.vertices)-2 for p in obj.data.polygons)


def priority(obj):
    import re
    name = (obj.active_material.name if obj.active_material else obj.name).lower()
    # Whole words only: "brown" must not read as "brow".
    return next((w for stem, w in PRIORITY if re.search(r'\b'+re.escape(stem)+r'\b', name)), 1.0)


# 2) plan the budget before touching anything. Each part's share is
# importance x sqrt(visible area) — area, not triangle count, so a dense collar
# cannot outweigh a large plain backpack. Some parts cannot reach their share
# (open tubes, tiny rings, thousands of fibre islands), so first measure the
# smallest count each part can reach, then water-fill: stuck parts keep that
# floor and the rest of the budget is shared again among the others.
def islands_of(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    seen, n = set(), 0
    for f in bm.faces:
        if f.index in seen:
            continue
        n += 1
        stack = [f]
        seen.add(f.index)
        while stack:
            cur = stack.pop()
            for e in cur.edges:
                for nb in e.link_faces:
                    if nb.index not in seen:
                        seen.add(nb.index)
                        stack.append(nb)
    bm.free()
    return n


def reachable(obj, tris):
    """Smallest triangle count collapse decimation reaches, measured on the evaluated mesh only."""
    mod = obj.modifiers.new('engine_probe', 'DECIMATE')
    mod.decimate_type, mod.ratio, mod.use_collapse_triangulate = 'COLLAPSE', min(1.0, 60/tris), True
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_move_to_index(modifier=mod.name, index=0)
    for m in obj.modifiers:
        if m.type == 'ARMATURE':
            m.show_viewport = False
    ev = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    reached = sum(len(p.vertices)-2 for p in ev.to_mesh().polygons)
    ev.to_mesh_clear()
    for m in obj.modifiers:
        if m.type == 'ARMATURE':
            m.show_viewport = True
    obj.modifiers.remove(mod)
    return max(60, reached)


plan = []
for obj in parts:
    tris = count(obj)
    if not tris:
        continue
    name = (obj.active_material.name if obj.active_material else obj.name).lower()
    islands = islands_of(obj) if tris > 60 else 1
    thinnable = islands >= 20
    floor = reachable(obj, tris) if tris > 60 else tris
    if thinnable:  # fibres may keep a third of their islands, fittings half
        floor = max(60, int(floor*(FIBRE_KEEP if any(stem in name for stem in THIN) else FITTING_KEEP)))
    plan.append({'object': obj, 'tris': tris, 'priority': priority(obj), 'weight': priority(obj)*math.sqrt(area(obj)),
                 'floor': floor, 'islands': islands, 'thinnable': thinnable,
                 'fibres': any(stem in name for stem in THIN)})
free, left = list(plan), target
while free:
    share = sum(p['weight'] for p in free)
    pinned = []
    for p in free:
        alloc = max(60, left*p['weight']/share)
        if p['tris'] <= alloc:      # small part: keep it whole
            p['budget'] = p['tris']
        elif p['floor'] > alloc:    # cannot get that small: keep its floor
            p['budget'] = p['floor']
        else:
            continue
        pinned.append(p)
    if not pinned:
        for p in free:
            p['budget'] = int(max(60, left*p['weight']/share))
        break
    for p in pinned:
        left -= p['budget']
        free.remove(p)

report_parts = []
for p in plan:
    obj, tris, budget = p['object'], p['tris'], p['budget']
    if budget < tris:
        decimate(obj, min(1.0, budget/tris))
        have = count(obj)
        if have > budget*OVERSHOOT and p['thinnable']:
            p['thinned'] = thin(obj, budget/have, smallest=not p['fibres'])
    entry = {'material': obj.active_material.name if obj.active_material else None, 'priority': p['priority'],
             'triangles_before': tris, 'budget': budget, 'floor': p['floor'], 'islands': p['islands'],
             'triangles_after': count(obj)}
    if p.get('thinned'):
        entry['thinned'] = True
    report_parts.append(entry)

# 4) join and clean the weights
bpy.ops.object.select_all(action='DESELECT')
for p in plan:
    p['object'].select_set(True)
bpy.context.view_layer.objects.active = plan[0]['object']
bpy.ops.object.join()
mesh = bpy.context.view_layer.objects.active
mesh.name = f'{label} skinned character'
group_names = {g.index: g.name for g in mesh.vertex_groups}
fixed = 0
for v in mesh.data.vertices:
    deform = [(g.group, g.weight) for g in v.groups if group_names[g.group] in bones and g.weight > 0]
    keep = sorted(deform, key=lambda x: -x[1])[:4]
    total = sum(w for _, w in keep)
    if len(deform) > 4 or abs(total-1) > 1e-4:
        fixed += 1
    for gi, _ in deform:
        if gi not in {k for k, _ in keep}:
            mesh.vertex_groups[gi].remove([v.index])
    for gi, w in keep:
        mesh.vertex_groups[gi].add([v.index], w/total if total else 0, 'REPLACE')
tris = sum(len(p.vertices)-2 for p in mesh.data.polygons)


# 4b) variant: recolour, keeping the shading and gradients of the base
def luma(c):
    return c[..., 0]*.2126+c[..., 1]*.7152+c[..., 2]*.0722


def to_srgb(c):
    return np.where(c <= .0031308, c*12.92, 1.055*np.power(np.clip(c, 0, None), 1/2.4)-.055)


def to_linear(c):
    return np.where(c <= .04045, c/12.92, np.power((c+.055)/1.055, 2.4))


recoloured = []
me = mesh.data
index_of = {m.name: i for i, m in enumerate(me.materials) if m}
attr = me.color_attributes.get(colour_name) if colour_name else None
if variant['recolor']:
    poly_mat = np.empty(len(me.polygons), np.int32)
    me.polygons.foreach_get('material_index', poly_mat)
    totals = np.empty(len(me.polygons), np.int32)
    me.polygons.foreach_get('loop_total', totals)
    loop_mat = np.repeat(poly_mat, totals)
    colours = None
    if attr is not None:
        colours = np.empty(len(attr.data)*4, np.float32)
        attr.data.foreach_get('color', colours)
        colours = colours.reshape(-1, 4)
        if attr.domain == 'POINT':
            raise RuntimeError('Point-domain colour attributes are not supported for variants')
    for item in variant['recolor']:
        index = index_of.get(item['material'])
        if index is None:
            continue
        mat = me.materials[index]
        to = np.array(item['to'], float)
        mode = item['mode']
        if mode == 'factor':
            bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
            bsdf.inputs['Base Color'].default_value = (*np.clip(to, 0, 1), 1)
            if item.get('emission') and not bsdf.inputs['Emission Color'].is_linked:
                bsdf.inputs['Emission Color'].default_value = (*np.clip(to, 0, 1), 1)
        elif mode in ('vertex', 'gradient') and colours is not None:
            sel = loop_mat == index
            c = colours[sel, :3]
            if mode == 'vertex' and 'ratio' in item:
                c = c*np.array(item['ratio'], float)
            elif mode == 'vertex':
                c = to*(luma(c)/max(float(luma(np.array(item['from']))), 1e-4))[:, None]
            else:
                a, b = np.array(item['from'], float), np.array(item['from2'], float)
                axis = b-a
                t = np.clip(((c-a)@axis)/max(float(axis@axis), 1e-8), 0, 1)[:, None]
                base = a+(b-a)*t
                new = to+(np.array(item['to2'], float)-to)*t
                c = new*(luma(c)/np.maximum(luma(base), 1e-4))[:, None]
            colours[sel, :3] = np.clip(c, 0, 1)
            # A light sheen tint (hair) would wash a darker colour out; follow the new colour.
            bsdf = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if mat.use_nodes else None
            if bsdf is not None and 'Sheen Tint' in bsdf.inputs and not bsdf.inputs['Sheen Tint'].is_linked:
                tint = np.clip(np.array(item['to'], float), 0, 1)
                bsdf.inputs['Sheen Tint'].default_value = (*tint, 1)
        elif mode == 'texture':
            for node in mat.node_tree.nodes:
                if node.type != 'TEX_IMAGE' or node.image is None:
                    continue
                image = node.image
                px = np.empty(len(image.pixels), np.float32)
                image.pixels.foreach_get(px)
                px = px.reshape(-1, 4)
                rgb = to_linear(px[:, :3]) if image.colorspace_settings.name == 'sRGB' else px[:, :3]
                mask = (px[:, 3] > .5) & (rgb.max(axis=1) > .02)
                if not mask.any():
                    continue
                if 'ratio' in item:  # skin: shift every channel, freckles stay freckles
                    rgb = np.clip(rgb*np.array(item['ratio'], float), 0, 1)
                else:
                    median = np.median(rgb[mask], axis=0)
                    target = to*float(luma(median))/max(float(luma(np.array(item['slot_base']))), 1e-4)
                    rgb = np.clip(target*(luma(rgb)/max(float(luma(median)), 1e-4))[:, None], 0, 1)
                px[:, :3] = to_srgb(rgb) if image.colorspace_settings.name == 'sRGB' else rgb
                image.pixels.foreach_set(px.ravel())
                image.update()
                image.pack()
        recoloured.append({'material': item['material'], 'mode': mode})
    if colours is not None:
        attr.data.foreach_set('color', colours.ravel())

# 5) export with the base's settings, then reimport
blend = out/f'{label}.blend'
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(blend), copy=True)
bpy.ops.object.select_all(action='DESELECT')
arm.select_set(True)
mesh.select_set(True)
bpy.context.view_layer.objects.active = arm
settings = dict(filepath=str(glb), export_format='GLB', use_selection=True, use_active_scene=True, export_skins=True,
                export_all_influences=False, export_animations=True, export_animation_mode='NLA_TRACKS',
                export_force_sampling=True, export_apply=False, export_yup=True, export_cameras=False, export_lights=False,
                export_active_vertex_color_when_no_material=False)
if colour_name:
    settings.update(export_all_vertex_colors=False, export_vertex_color='NAME', export_vertex_color_name=colour_name)
bpy.ops.export_scene.gltf(**settings)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(glb))
r_arms = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
r_meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and r_arms and o.find_armature() == r_arms[0]]
zs = [(o.matrix_world @ v.co).z for o in r_meshes for v in o.data.vertices]
influences = max((sum(1 for g in v.groups if g.weight > 0) for o in r_meshes for v in o.data.vertices), default=0)
clips = sorted(set(a.name for a in bpy.data.actions) & CLIPS)
ok = len(r_arms) == 1 and len(r_meshes) == 1 and len(r_arms[0].data.bones) == 22 and set(clips) == CLIPS and influences <= 4
report = {'schema': 'polpal.engine-optimize/1', 'status': 'built' if ok else 'failed', 'label': label,
          'source': source_file, 'source_triangles': source_tris, 'target_triangles': target, 'triangles': tris,
          'parts': report_parts, 'weights_fixed_vertices': fixed, 'budget_left_for_free_parts': int(left),
          'over_budget': tris > target*OVERSHOOT,
          'variant': {'removed_materials': variant['remove'], 'removed_triangles': removed, 'recoloured': recoloured}, 'glb': glb.name, 'glb_bytes': glb.stat().st_size,
          'glb_sha256': hashlib.sha256(glb.read_bytes()).hexdigest(), 'blend': blend.name,
          'reimport': {'armatures': len(r_arms), 'skinned_meshes': len(r_meshes),
                       'bones': len(r_arms[0].data.bones) if r_arms else 0, 'clips': clips,
                       'max_influences': influences, 'height': round(max(zs)-min(zs), 4) if zs else None},
          'seconds': round(time.time()-started, 1), 'blender_version': bpy.app.version_string,
          'likeness_approved': False, 'game_integration': False,
          'scope': 'Decimated copy of a sculpted base; appearance and deformation need review.'}
(out/f'{label}-report.json').write_text(json.dumps(report, indent=2, default=lambda o: o.tolist() if hasattr(o, 'tolist') else str(o))+'\n')
if not ok:
    raise RuntimeError('Optimised GLB does not meet the game contract')
