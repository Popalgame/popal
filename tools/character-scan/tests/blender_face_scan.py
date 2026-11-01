"""Integration on an opened unrigged study; writes only a separate output.

blender -b source.blend --python-exit-code 1 --python THIS -- --report scan.json --out NEW_DIR
"""
import argparse
import hashlib
import importlib.util
import json
import runpy
from pathlib import Path
import sys

import bpy

parser=argparse.ArgumentParser()
parser.add_argument('--report',type=Path,required=True)
parser.add_argument('--out',type=Path,required=True)
parser.add_argument('--render',action='store_true')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
args.out.mkdir(parents=True,exist_ok=False)
source=Path(bpy.data.filepath);source_hash=hashlib.sha256(source.read_bytes()).hexdigest()
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('face_scan_test_addon',root/'blender_face_scan.py')
addon=importlib.util.module_from_spec(spec);sys.modules[spec.name]=addon;spec.loader.exec_module(addon)
addon.register()
s=bpy.context.scene.face_scan;s.scanner=str(root/'face_scan.py')
addon.adopt_report(s,args.report.resolve())
# The existing Aiko source was modelled with this explicit pixel registration.
s.units=1.8/1773;s.axis=580;s.ground=1973;s.depth=-.26
s.fit_top=825;s.fit_bottom=880;s.max_step=7;s.offset=.65
original=bpy.data.objects['Face - clean cheek and jaw surface']
original_vertices=[tuple(v.co) for v in original.data.vertices]
original_objects=set(bpy.data.objects.keys())
assert bpy.ops.face_scan.guides()=={'FINISHED'}
assert bpy.ops.face_scan.brows()=={'FINISHED'}
assert bpy.ops.face_scan.hair_guide()=={'FINISHED'}
assert 'Excluded contour samples' in s.occlusion_status
for ob in bpy.context.selected_objects:ob.select_set(False)
original.select_set(True);bpy.context.view_layer.objects.active=original
assert bpy.ops.face_scan.fit_copy()=={'FINISHED'}
fitted=bpy.context.active_object
assert fitted!=original and fitted.data!=original.data
assert original_vertices==[tuple(v.co) for v in original.data.vertices]
assert original_objects<=set(bpy.data.objects.keys())
stats=json.loads(fitted['face_scan_fit'])
assert stats['moved_vertices']>0 and stats['maximum_step_px']<=7.0001
# Remove presentation offset and verify all world depth/height values survive.
bpy.context.view_layer.update()
max_error=0
for a,b in zip(original.data.vertices,fitted.data.vertices):
    old=original.matrix_world@a.co;new=fitted.matrix_world@b.co
    max_error=max(max_error,abs(old.y-new.y),abs(old.z-new.z))
assert max_error<1e-6,max_error
# At rejected image rows the affected side must retain the source x as well.
scan_report=addon.read_report(s)
rows={r['y']:r for r in scan_report['features']['visible_skin_contour']['rows']}
checked_hidden=0
for a,b in zip(original.data.vertices,fitted.data.vertices):
    old=original.matrix_world@a.co;new=fitted.matrix_world@b.co
    py=s.ground-old.z/s.units;side='left' if old.x<0 else 'right'
    row=rows.get(round(py))
    if row and not row['fit_checks'][side]['eligible'] and s.fit_top<py<s.fit_bottom:
        assert abs(old.x-(new.x-s.offset))<1e-6
        checked_hidden+=1
assert checked_hidden>0
created=[o for o in bpy.data.objects if o.name not in original_objects]
assert all(any(c.name.startswith('Face Scan') for c in o.users_collection) for o in created)
assert all(c in bpy.data.collections['AI_Work'].children.values() for o in created for c in o.users_collection)
assert hashlib.sha256(source.read_bytes()).hexdigest()==source_hash
# Save the diagnostic comparison separately, never into the source study.
bpy.ops.wm.save_as_mainfile(filepath=str(args.out/'face-scan-integration.blend'))
report={'source':str(source),'source_sha256':source_hash,'blender':bpy.app.version_string,
        'created_objects':len(created),'fit':stats,'source_mesh_preserved':True,
        'depth_height_max_error':max_error,'occlusion_preserved_vertices':checked_hidden,
        'checks':['guide/reference creation','observed brow ribbon generation','bounded copy-only face fitting',
                  'source object/mesh preservation','AI_Work collection placement','depth/height preservation',
                  'hair evidence image','occluded-side x preservation'],
        'scope':'technical integration, not visual certification of the fitted anatomy'}
(args.out/'integration-report.json').write_text(json.dumps(report,indent=2)+'\n')
addon.unregister()
assert not hasattr(bpy.types.Scene,'face_scan')
if args.render:
    script=Path(__file__).with_name('render_face_scan.py')
    sys.argv=[str(script),'--','--out',str(args.out/'renders')]
    runpy.run_path(str(script),run_name='__main__')
print(json.dumps(report),flush=True)
