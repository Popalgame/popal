#!/usr/bin/env python3
"""Reproducible synthetic accuracy and source-only annotation evaluation."""
import argparse
import json
from pathlib import Path
import math

import numpy as np
from PIL import Image,ImageDraw
from scipy import ndimage as ndi
from scipy.spatial import ConvexHull,cKDTree

from metrology3d import camera_from_parameters,fit_camera,project,triangulate
from mesh_fit import mesh_digest,render_silhouette,fit_mesh
from deviation import compare_masks,heatmap
import studio_project as studio


def run(out,reference=None,scan=None,annotations=None):
    out=Path(out).resolve();out.mkdir(parents=True,exist_ok=False)
    rng=np.random.default_rng(2026);points=rng.uniform(-25,25,(48,3));heldout=rng.uniform(-25,25,(20,3))
    cameras=[];camera_scores={};k=[[700,0,256],[0,700,256],[0,0,1]]
    for kind,params in [('orthographic',[.15,.5,-.08,math.log(4),256,256]),('perspective',[.15,.5,-.08,2,-3,250])]:
        true=camera_from_parameters(params,kind,k);pixels=project(points,true)
        fit=fit_camera(points,pixels,kind,intrinsics=k)
        noisy=fit_camera(points,pixels+rng.normal(0,.5,pixels.shape),kind,intrinsics=k,sigma_px=np.full(len(points),.5))
        camera_scores[kind]={'exact_heldout_rms_px':float(np.sqrt(np.mean((project(heldout,fit)-project(heldout,true))**2))),
                            'noise_sigma_px':.5,'noisy_heldout_rms_px':float(np.sqrt(np.mean((project(heldout,noisy)-project(heldout,true))**2)))}
    # Known smooth ellipsoid, three calibrated views, bounded width correction.
    vertices=[]
    for z in np.linspace(-.96,.96,13):
        for angle in np.linspace(0,2*math.pi,32,endpoint=False):
            vertices.append([math.sqrt(1-z*z)*math.cos(angle)*20,math.sqrt(1-z*z)*math.sin(angle)*17,z*25])
    vertices=np.array(vertices);triangles=ConvexHull(vertices).simplices.tolist()
    offsets=np.zeros_like(vertices);offsets[:,0]=vertices[:,0]*.08
    target=vertices+offsets
    job={'mesh':{'vertices':vertices.tolist(),'triangles':triangles,'sha256':mesh_digest(vertices.tolist(),triangles)},
         'controls':[{'name':'width','offsets':offsets.tolist(),'min':0,'max':1}],
         'max_displacement':1.61,'iterations':10,'regularization':0,'views':[]}
    studio_root=out/'studio-project';studio.create(studio_root,'Accuracy lab / known geometry')
    landmark_points=points[:12];names=studio.LANDMARKS[:12]
    # All cameras share millimetres; y-down image convention with deliberate head rotation.
    for index,angle in enumerate((0,.7,1.35)):
        c=camera_from_parameters([.1,angle,.08,math.log(4),128,128],'orthographic')
        c.update(status='calibrated',frame_id='benchmark-mm',world_unit='mm');cameras.append(c)
        mask=render_silhouette(target,triangles,c,[256,256]);path=out/f'target-{index}.png';Image.fromarray(mask.astype('uint8')*255).save(path)
        job['views'].append({'name':f'view-{index}','camera':c,'size':[256,256],'mask':str(path),'mask_sha256':studio.digest(path)})
        image=out/f'view-{index}.png';rgb=np.zeros((256,256,3),np.uint8)+32;rgb[mask]=[185,205,160];Image.fromarray(rgb).save(image)
        p=studio.import_view(studio_root,f'view-{index}',image,label=['Front / synthetic','¾ / synthetic','Side / synthetic'][index])
        landmarks={name:{'point_px':xy.tolist(),'point3d':xyz.tolist(),'sigma_px':.5,'visible':True,'origin':'known synthetic fixture'} for name,xy,xyz in zip(names,project(landmark_points,c),landmark_points)}
        p=studio.action(studio_root,{'action':'save','revision':p['revision'],'view':f'view-{index}','landmarks':landmarks})
        p=studio.action(studio_root,{'action':'camera','revision':p['revision'],'view':f'view-{index}','config':{'kind':'orthographic','world_unit':'mm','frame_id':'benchmark-mm'}})
    p=studio.action(studio_root,{'action':'reconstruct','revision':p['revision']})
    trials=[];covered=0
    for point in heldout:
        observations=[{'camera':c,'point_px':(project([point],c)[0]+rng.normal(0,.5,2)).tolist(),'sigma_px':.5} for c in cameras]
        result=triangulate(observations,draws=256)
        trials.append(float(np.linalg.norm(np.array(result['point'])-point)))
        interval=np.array(result['interval_95_xyz']);covered+=int(np.all((interval[0]<=point)&(point<=interval[1])))
    result=fit_mesh(job,out/'bounded-fit')
    studio.write_json(out/'fit-job.json',job)
    # Make the same immutable job available from the lab editor with project-relative targets.
    ui_job=json.loads(json.dumps(job))
    for i,v in enumerate(ui_job['views']):
        destination=studio_root/'views'/f'view-{i}'/'target.png';destination.write_bytes(Path(v['mask']).read_bytes());v['mask']=str(destination.relative_to(studio_root))
    studio.write_json(studio_root/'fit-job.json',ui_job)
    scores={'schema':'polpal.accuracy-benchmark/2','seed':2026,'synthetic':{'camera':camera_scores,
            'triangulation':{'trials':len(trials),'noise_sigma_px':.5,'mean_error_mm':float(np.mean(trials)),'p95_error_mm':float(np.percentile(trials,95)),
                             'joint_xyz_interval_coverage':covered/len(trials),'note':'20 trials; conditional camera-fixed intervals, not calibrated coverage on Aiko'},
            'bounded_fit':{key:result[key] for key in ['accepted_steps','max_displacement','before_scores','after_scores','parameters']},
            'known_mesh_vertex_rms_mm':float(np.sqrt(np.mean((np.array(result['vertices'])-target)**2)))},'reference_evaluation':{'status':'not_supplied'}}
    if reference and scan and annotations:
        annotations=json.loads(Path(annotations).read_text());report=json.loads(Path(scan).read_text())
        if studio.digest(reference)!=annotations['source_sha256'] or report['source_sha256']!=annotations['source_sha256']:raise ValueError('Benchmark source checksum mismatch')
        image=Image.open(reference).convert('RGB');overlay=image.copy();draw=ImageDraw.Draw(overlay);features={}
        for name,polygon in annotations['polygons'].items():
            mask=Image.new('L',image.size);ImageDraw.Draw(mask).polygon([tuple(p) for p in polygon],fill=255)
            candidate=ndi.binary_fill_holes(np.asarray(Image.open(Path(scan).parent/'masks'/(name+'.png')))>127)
            metrics,error=compare_masks(np.asarray(mask)>127,candidate,mm_per_px=report['ocular_metrology']['calibration'].get('mm_per_px'))
            mask.save(out/(name+'-manual.png'));heatmap(image,error,out/(name+'-deviation.png'));features[name]=metrics
            draw.line([tuple(p) for p in polygon]+[tuple(polygon[0])],fill='#d2ff80',width=2)
        for name,line in annotations['polylines'].items():
            draw.line([tuple(p) for p in line],fill='#ffc080',width=2)
            observed=[pt for seg in report['face_shape']['segments'] if seg['region']==name for pt in seg['points_px']]
            if observed:
                dense=np.concatenate([np.linspace(a,b,max(2,int(np.linalg.norm(np.array(b)-a)*2))) for a,b in zip(line,line[1:])])
                d=cKDTree(dense).query(observed)[0]
                features[name]={'status':'partial','candidate_to_annotation_mean_px':float(d.mean()),'candidate_to_annotation_p95_px':float(np.percentile(d,95)),
                                'note':'One-way visible fragment distance; not full contour completeness'}
        overlay.save(out/'independent-annotation-overlay.png')
        scores['reference_evaluation']={'status':'candidate','source_sha256':annotations['source_sha256'],'origin':annotations['origin'],
                                       'review_status':annotations['review_status'],'annotation_sigma_px':annotations['annotation_sigma_px'],'features':features,'scope':annotations['scope']}
    scores['limitations']=['Synthetic validation tests algorithms, not Aiko likeness.','Single annotated source has no verified 3D depth or calibrated metric ground truth.',
                           'Agent annotations are independent of scanner output but are not an independent human accuracy benchmark.']
    studio.write_json(out/'accuracy-report.json',scores);return scores


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--out',type=Path,required=True);p.add_argument('--reference',type=Path)
    p.add_argument('--scan',type=Path);p.add_argument('--annotations',type=Path);a=p.parse_args()
    print(json.dumps(run(a.out,a.reference,a.scan,a.annotations),indent=2))
