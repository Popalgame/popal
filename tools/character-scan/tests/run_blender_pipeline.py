"""Opt-in real Blender integration: known contours, no pre-calibrated Studio camera.

Read Blender_user.md and docs/blender-project-contract.md before invoking.
Uses fresh output directories and isolated Blender processes only.
"""
import argparse
import json
from pathlib import Path
import subprocess
import sys

import numpy as np
from PIL import Image,ImageDraw

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from test_autopilot import fixture
import studio_project as project
from blender_pipeline import Jobs,bind,bridge_permission


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out',type=Path,required=True)
    parser.add_argument('--blender',required=True)
    args=parser.parse_args();bridge_permission()
    root=args.out.resolve();root.mkdir(parents=True,exist_ok=False)
    snapshot,scan,_=fixture();project.write_json(root/'fixture-snapshot.json',snapshot)
    with (root/'fixture.log').open('w') as log:
        subprocess.run([args.blender,'--background','--factory-startup','--disable-autoexec',
            '--python-exit-code','1','--python',str(Path(__file__).with_name('blender_pipeline_fixture.py')),
            '--',str(root)],stdout=log,stderr=subprocess.STDOUT,check=True,timeout=120)
    image=Image.new('RGB',(128,128),(24,27,32));draw=ImageDraw.Draw(image)
    draw.ellipse((26,20,102,108),fill=(235,185,150))
    for x in (45,83):draw.ellipse((x-5,42,x+5,54),fill=(20,150,155))
    image.save(root/'reference.png')
    studio=root/'studio';project.create(studio,'Polpal / automatic camera laboratory')
    p=project.import_view(studio,'front',root/'reference.png');v=p['views']['front']
    v['roi']=[15,20,115,120];v['semantic_roi']=[0,0,128,128]
    v['camera_config']['frame_id']='fixture'
    v['outline']=scan['face_shape']['segments']
    for name,xy in [('iris_center_left',[45,48]),('iris_center_right',[83,48]),('chin_bottom',[64,108])]:
        v['landmarks'][name]={'point_px':xy,'sigma_px':1,'visible':True,'origin':'known synthetic fixture'}
    project.commit(studio,p,p['revision'])
    p=bind(studio,root/'source.blend','Pipeline fixture face','fixture')
    assert p['views']['front']['camera'] is None
    state=Jobs(studio,args.blender).start({'revision':p['revision'],'view':'front'},background=False)
    print(json.dumps(state,indent=2))
    assert state['status']=='target_met',state
    run=studio/'pipeline'/state['id'];camera=json.loads((run/'camera.json').read_text())
    assert camera['method']=='fixed_orientation_alignment'
    assert camera['rotation_estimated_from_reference'] is False
    assert camera['rms_px']<1e-5
    np.testing.assert_allclose(camera['P'],[[1,0,0,0],[0,1,0,0],[0,0,0,1]],atol=1e-5)
    assert project.read(studio)['views']['front']['camera'] is None
    # Attach a source-matched manifest and run the actual worker again to prove
    # that file-level pins are combined with, rather than replacing, SCAN_PROTECT.
    snap=json.loads((run/'snapshot.json').read_text())
    manifest={'schema':'polpal.mesh-protection/1','source_blend_sha256':p['blender_source']['sha256'],
        'source_mesh_sha256':snap['mesh']['sha256'],'object':'Pipeline fixture face','frame_id':'fixture',
        'protected_vertices':[1],'basis':'known synthetic cheek vertex that otherwise moves'}
    project.write_json(root/'protection.json',manifest)
    p=bind(studio,root/'source.blend','Pipeline fixture face','fixture',root/'protection.json')
    protected=Jobs(studio,args.blender).start({'revision':p['revision'],'view':'front'},background=False)
    assert protected['status'] in ('target_met','candidate'),protected
    protected_run=studio/'pipeline'/protected['id']
    protected_snapshot=json.loads((protected_run/'snapshot.json').read_text())
    assert protected_snapshot['protected_vertices']==[0,1]
    result=json.loads((protected_run/'autopilot/fit/fit-result.json').read_text())
    unconstrained=json.loads((run/'autopilot/fit/fit-result.json').read_text())
    assert unconstrained['vertices'][1]!=snap['mesh']['vertices'][1]
    for index in (0,1):assert result['vertices'][index]==protected_snapshot['mesh']['vertices'][index]
    protected_validation=json.loads((protected_run/'render-validation.json').read_text())
    assert protected_validation['raster_agreement_passed']
    assert all(g['no_regression'] for g in protected_validation['regions'].values())
    assert (protected['status']=='target_met')==all(g['within_target'] for g in protected_validation['regions'].values())
    validation=json.loads((run/'render-validation.json').read_text())
    assert validation['raster_agreement_passed']
    for region in ('jaw_left','jaw_right'):
        g=validation['regions'][region]
        assert g['after']['p95_px']<g['before']['p95_px'],g
    # Model a genuinely unavailable cheek: omit its annotation and explicitly
    # exclude its scanner band. Do not replace the missing curve with symmetry.
    p=project.read(studio);v=p['views']['front']
    v['outline']=[s for s in v['outline'] if s['region']!='cheek_right']
    v['base_hints']['exclude_fit_regions']=[[64,40,115,68]]
    p=project.commit(studio,p,p['revision'])
    partial=Jobs(studio,args.blender).start({'revision':p['revision'],'view':'front'},background=False)
    assert partial['status']=='partial_candidate',partial
    partial_run=studio/'pipeline'/partial['id']
    partial_report=json.loads((partial_run/'render-validation.json').read_text())
    assert not partial_report['full_target_met']
    assert partial_report['regions']['cheek_right']['status']=='unknown'
    assert all(g['max_error_px']<=1 for g in partial_report['frozen_outline'].values())
    partial_job=json.loads((partial_run/'autopilot/fit-job.json').read_text())
    partial_result=json.loads((partial_run/'autopilot/fit/fit-result.json').read_text())
    for i in partial_job['protected_vertices']:assert partial_result['vertices'][i]==partial_job['mesh']['vertices'][i]
    assert Jobs(studio,args.blender).states()[0]['status']=='partial_candidate'
    project.write_json(root/'integration-checks.json',{'status':'passed','job':state['id'],
        'candidate_sha256':state['candidate_sha256'],'camera_rms_px':camera['rms_px'],
        'manifest_protection_job':protected['id'],'manifest_fit_status':protected['status'],'protected_vertices':[0,1],
        'partial_job':partial['id'],'partial_frozen_vertices':len(partial_job['protected_vertices']),
        'scope':'Synthetic mechanics with supplied known contours and 2D anchors; not an Aiko likeness test.'})


if __name__=='__main__':main()
