"""Polpal Studio engine — read-only profile of a sculpted base (Blender side).

For every material of the skinned mesh: triangle count, image textures and the
colour of the export colour attribute (median and the two ends of its main
colour axis, so gradients such as pink-to-blue hair are visible). Saves nothing.

Run: Blender --background --factory-startup --disable-autoexec BASE.blend --python engine_profile.py -- OUT.json [COLOUR_ATTRIBUTE]
"""
import json
import sys
from pathlib import Path

import bpy
import numpy as np

args = sys.argv[sys.argv.index('--')+1:]
out = Path(args[0])
colour_name = args[1] if len(args) > 1 else None
mesh = next(o for o in bpy.context.scene.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers))
me = mesh.data
attr = me.color_attributes.get(colour_name) if colour_name else None
colours = None
if attr is not None:
    data = np.empty(len(attr.data)*4, np.float32)
    attr.data.foreach_get('color', data)
    colours = data.reshape(-1, 4)[:, :3]
poly_mat = np.empty(len(me.polygons), np.int32)
me.polygons.foreach_get('material_index', poly_mat)
loop_start = np.empty(len(me.polygons), np.int32)
me.polygons.foreach_get('loop_start', loop_start)
loop_total = np.empty(len(me.polygons), np.int32)
me.polygons.foreach_get('loop_total', loop_total)
loop_mat = np.repeat(poly_mat, loop_total)
if attr is not None and attr.domain == 'POINT':
    verts = np.empty(len(me.loops), np.int32)
    me.loops.foreach_get('vertex_index', verts)
    colours = colours[verts]
materials = []
for index, m in enumerate(me.materials):
    tris = int((loop_total[poly_mat == index]-2).sum())
    images = []
    if m and m.use_nodes:
        images = sorted({n.image.name for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image})
    entry = {'index': index, 'name': m.name if m else None, 'triangles': tris, 'images': images}
    bsdf = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if m and m.use_nodes else None
    if bsdf is not None:
        socket = bsdf.inputs['Base Color']
        entry['factor'] = [round(v, 5) for v in socket.default_value[:3]]
        entry['factor_linked'] = socket.is_linked
    else:
        entry['factor'], entry['factor_linked'] = [1.0, 1.0, 1.0], True
    if colours is not None:
        c = colours[loop_mat == index]
        if len(c):
            median = np.median(c, axis=0)
            centred = c-c.mean(axis=0)
            axis = np.linalg.svd(centred[::max(1, len(c)//20000)], full_matrices=False)[2][0]
            t = centred@axis
            lo, hi = np.percentile(t, [5, 95])
            ends = [c[np.argmin(abs(t-lo))], c[np.argmin(abs(t-hi))]]
            if ends[0].sum() > ends[1].sum():  # darker end first is arbitrary; keep lighter last
                ends = ends[::-1]
            entry.update(median=median.round(4).tolist(), ends=[e.round(4).tolist() for e in ends],
                         spread=float(hi-lo))
    materials.append(entry)
out.write_text(json.dumps({'mesh': mesh.name, 'colour_attribute': colour_name,
                           'colour_domain': attr.domain if attr is not None else None,
                           'materials': materials, 'blender': bpy.app.version_string}, indent=2))
