"""Polpal Studio engine — sculpted base -> game-ready GLB (Blender side).

Takes a rigged, high-poly character (.blend with one armature and one skinned
mesh, e.g. Aiko v16) and writes a lighter copy for the game:

  1. split the skinned mesh by material,
  2. share a triangle budget by importance (face/eyes keep more detail),
  3. decimate each part BEFORE the Armature modifier (the pose is never baked),
  4. join, keep at most 4 deforming influences per vertex, normalise weights,
  5. export GLB with the base's settings and reimport to check the contract.

The source file is never saved. Run:
  Blender --background --factory-startup --disable-autoexec BASE.blend --python engine_optimize.py -- OUT_DIR TARGET_TRIS LABEL [COLOR_ATTRIBUTE [VARIANT.json]]

VARIANT.json (optional, from engine.py) turns the base into a variant:
  {"remove": [material names], "recolor": [{"material", "mode": factor|vertex|gradient|texture,
   "from", "to", ["from2", "to2"], ["emission"]}]}   colours are linear RGB.
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
PRIORITY = (('iris', 6), ('pupil', 6), ('catchlight', 6), ('sclera', 5), ('eye', 5), ('lash', 4), ('brow', 4),
            ('mouth', 4), ('lip', 4), ('skin', 3), ('face', 3), ('freckle', 3), ('hand', 2.5), ('finger', 2.5),
            ('hair', 1.4), ('fringe', 1.4), ('pony', 1.4), ('rune', 1.5))
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


def priority(obj):
    name = (obj.active_material.name if obj.active_material else obj.name).lower()
    return next((w for stem, w in PRIORITY if stem in name), 1.0)


# 2) share the budget: importance x sqrt(size), never more than the part has
info = [(o, sum(len(p.vertices)-2 for p in o.data.polygons), priority(o)) for o in parts]
score = sum(w*math.sqrt(t) for _, t, w in info if t)
report_parts = []
for obj, tris, weight in info:
    if not tris:
        continue
    budget = max(60, target*weight*math.sqrt(tris)/score)
    ratio = min(1.0, budget/tris)
    if ratio < .999:
        mod = obj.modifiers.new('engine_decimate', 'DECIMATE')
        mod.decimate_type = 'COLLAPSE'
        mod.ratio = ratio
        mod.use_collapse_triangulate = True
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        # 3) before the Armature modifier, so only rest geometry is reduced
        bpy.ops.object.modifier_move_to_index(modifier=mod.name, index=0)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    after = sum(len(p.vertices)-2 for p in obj.data.polygons)
    report_parts.append({'material': obj.active_material.name if obj.active_material else None,
                         'priority': weight, 'triangles_before': tris, 'triangles_after': after})

# 4) join and clean the weights
bpy.ops.object.select_all(action='DESELECT')
for obj, _, _ in info:
    obj.select_set(True)
bpy.context.view_layer.objects.active = info[0][0]
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
            if mode == 'vertex':
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
          'parts': report_parts, 'weights_fixed_vertices': fixed,
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
