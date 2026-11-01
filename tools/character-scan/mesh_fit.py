"""Bounded multi-view silhouette fitting of an immutable mesh snapshot."""
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

from metrology3d import project
from deviation import compare_masks,heatmap
from mesh_snapshot import mesh_digest,job_digest
from outline_objective import validate_segments,measure_outline,frozen_outline_error,edge_shear


def render_silhouette(vertices,triangles,camera,size):
    import cv2
    width,height=map(int,size)
    if not (16<=width<=4096 and 16<=height<=4096):raise ValueError('Invalid silhouette render size')
    xy=project(vertices,camera)
    if abs(xy).max()>1e7:raise ValueError('Projection outside stable raster range')
    canvas=np.zeros((height,width),np.uint8)
    for triangle in triangles:cv2.fillConvexPoly(canvas,np.rint(xy[triangle]).astype(np.int32),255)
    return canvas>127


def fit_mesh(job,out,root=None):
    out=Path(out)
    if out.exists():raise FileExistsError(out)
    vertices=np.asarray(job['mesh']['vertices'],float);triangles=np.asarray(job['mesh']['triangles'],int)
    if vertices.ndim!=2 or vertices.shape[1]!=3 or not np.isfinite(vertices).all():raise ValueError('Invalid mesh vertices')
    if triangles.ndim!=2 or triangles.shape[1]!=3 or triangles.min()<0 or triangles.max()>=len(vertices):raise ValueError('Invalid triangles')
    expected=mesh_digest(job['mesh']['vertices'],job['mesh']['triangles'])
    if job['mesh'].get('sha256')!=expected:raise ValueError('Source mesh checksum mismatch')
    controls=job.get('controls',[])
    if not controls:raise ValueError('Supply explicit deformation controls')
    if len({c['name'] for c in controls})!=len(controls):raise ValueError('Control names must be unique')
    basis=np.asarray([c['offsets'] for c in controls],float)
    if basis.shape!=(len(controls),len(vertices),3) or not np.isfinite(basis).all():raise ValueError('Invalid control basis')
    low=np.asarray([c.get('min',-1) for c in controls],float);high=np.asarray([c.get('max',1) for c in controls],float)
    if not np.isfinite([low,high]).all() or np.any(low>0) or np.any(high<0) or np.any(low>=high):raise ValueError('Control bounds must contain original shape at zero')
    pins=np.asarray(job.get('protected_vertices',[]),int)
    if pins.size and (pins.min()<0 or pins.max()>=len(vertices)):raise ValueError('Invalid protected vertices')
    basis[:,pins,:]=0
    max_move=float(job.get('max_displacement',1));iterations=int(job.get('iterations',12))
    if not np.isfinite(max_move) or max_move<=0 or not 1<=iterations<=100:raise ValueError('Invalid fitting limits')
    views=job.get('views',[])
    if not views:raise ValueError('At least one measured target view required')
    if len({(v['camera'].get('frame_id'),v['camera'].get('world_unit')) for v in views})!=1:raise ValueError('Fitting camera frames differ')
    if job['mesh'].get('frame_id') and any((v['camera'].get('frame_id'),v['camera'].get('world_unit'))!=(job['mesh']['frame_id'],job['mesh']['world_unit']) for v in views):raise ValueError('Mesh and camera frames differ')
    targets=[]
    for view in views:
        if view['camera'].get('status') not in ('candidate','calibrated'):raise ValueError('Resolve camera before geometry fitting')
        if view.get('target_kind')=='visible_outline':
            validate_segments(view['segments'],view['size'])
            if 'max_edge_shear_px_per_row' in view:
                shear=view['max_edge_shear_px_per_row']
                if 'mutable_outline_intervals_px' not in view or isinstance(shear,bool) or not isinstance(shear,(int,float)) or not np.isfinite(shear) or shear<1:
                    raise ValueError('Edge shear limit needs mutable intervals and a value of at least 1 px/row')
            targets.append(None)
            continue
        p=Path(view['mask'])
        if root is not None:
            p=(Path(root)/p).resolve()
            if not p.is_relative_to(Path(root).resolve()):raise ValueError('Target outside project')
        digest=hashlib.sha256(p.read_bytes()).hexdigest()
        if view.get('mask_sha256')!=digest:raise ValueError('Target mask checksum mismatch')
        mask=np.asarray(Image.open(p).convert('L'))
        if not np.isin(mask,[0,255]).all() or not mask.any():raise ValueError('Target must be a nonempty binary mask')
        if mask.shape!=(view['size'][1],view['size'][0]):raise ValueError('Target dimensions differ from camera grid')
        targets.append(mask>127)
    a,b,c=triangles.T
    source_normals=np.cross(vertices[b]-vertices[a],vertices[c]-vertices[a])
    regularization=float(job.get('regularization',.001))
    if not np.isfinite(regularization) or regularization<0:raise ValueError('Invalid regularization')
    frozen_baselines=[render_silhouette(vertices,triangles,v['camera'],v['size']) if 'mutable_outline_intervals_px' in v else None for v in views]
    rejection=None
    def reject(reason):
        nonlocal rejection
        rejection=reason
        return None
    def evaluate(parameters):
        nonlocal rejection
        rejection=None
        proposal=vertices+np.einsum('c,cnk->nk',parameters,basis)
        if np.linalg.norm(proposal-vertices,axis=1).max()>max_move+1e-9:return reject('displacement_limit')
        normals=np.cross(proposal[b]-proposal[a],proposal[c]-proposal[a])
        meaningful=np.linalg.norm(source_normals,axis=1)>1e-12
        if np.any(np.sum(normals[meaningful]*source_normals[meaningful],axis=1)<=1e-12):return reject('triangle_orientation')
        masks=[render_silhouette(proposal,triangles,v['camera'],v['size']) for v in views]
        for mask,baseline,view in zip(masks,frozen_baselines,views):
            if baseline is not None and any(g['max_error_px']>0 for g in frozen_outline_error(baseline,mask,view['mutable_outline_intervals_px']).values()):return reject('unobserved_outline_motion')
            if baseline is not None and 'max_edge_shear_px_per_row' in view and max(edge_shear(baseline,mask).values())>view['max_edge_shear_px_per_row']:return reject('edge_shear')
        scores=[]
        for mask,target,view in zip(masks,targets,views):
            if not mask.any():return reject('empty_projection')
            if target is None:
                metrics=measure_outline(mask,view['segments'])
                scores.extend((m['mean_px']+m['p95_px'])*.5/max(mask.shape) for m in metrics.values())
                continue
            ba=target&~ndi.binary_erosion(target);bb=mask&~ndi.binary_erosion(mask)
            distance=(ndi.distance_transform_edt(~ba)[bb].mean()+ndi.distance_transform_edt(~bb)[ba].mean())/2
            iou=(target&mask).sum()/max(1,(target|mask).sum())
            scores.append(float(1-iou+distance/max(target.shape)))
        penalty=regularization*float(np.mean(parameters**2))
        return proposal,masks,scores,float(np.mean(scores)+penalty)
    out.mkdir(parents=True,exist_ok=False);parameters=np.zeros(len(controls));best=evaluate(parameters)
    if best is None:raise ValueError('Initial mesh does not project into target views')
    initial_scores=best[2][:];history=[];accepted=0;step=float(job.get('initial_step',.5))
    if not 0<step<=2:raise ValueError('Invalid initial step')
    tolerance=float(job.get('per_view_regression_tolerance',0))
    if tolerance<0 or tolerance>.02:raise ValueError('Per-view regression tolerance outside 0..0.02')
    def snapshot(label,state):
        for index,(mask,target,view) in enumerate(zip(state[1],targets,views)):
            Image.fromarray(mask.astype(np.uint8)*255).save(out/f'{label}-view-{index}.png')
            if target is None:
                from PIL import ImageDraw
                image=Image.fromarray(np.repeat((mask.astype(np.uint8)*130)[:,:,None],3,axis=2))
                draw=ImageDraw.Draw(image)
                for segment in view['segments']:draw.line([tuple(p) for p in segment['points_px']],fill='#ffbd66',width=1)
                image.save(out/f'{label}-outline-{index}.png')
                continue
            _,error=compare_masks(target,mask)
            rgb=np.repeat((target.astype(np.uint8)*170)[:,:,None],3,axis=2)
            heatmap(rgb,error,out/f'{label}-deviation-{index}.png')
    snapshot('before',best)
    for iteration in range(iterations):
        improvement=False
        for i in range(len(controls)):
            winner=None
            for direction in (-1,1):
                p=parameters.copy();p[i]=np.clip(p[i]+direction*step,low[i],high[i])
                if np.array_equal(p,parameters):continue
                trial=evaluate(p)
                admissible=trial is not None and all(a<=min(b,initial)+tolerance+1e-12 for a,b,initial in zip(trial[2],best[2],initial_scores))
                better=admissible and trial[3]<best[3]-1e-7
                history.append({'iteration':iteration,'control':controls[i]['name'],'parameters':p.tolist(),
                                'reason':rejection or ('region_regression' if not admissible else 'improving_trial' if better else 'no_objective_improvement'),
                                'scores':trial[2] if trial else None,'admissible':admissible,'improves':better})
                if better and (winner is None or trial[3]<winner[1][3]):winner=(p,trial)
            if winner:
                parameters,best=winner;improvement=True;accepted+=1
                snapshot(f'accepted-{accepted:03}',best)
        if not improvement:step*=.5
        if step<.005:break
    snapshot('after',best)
    result={'schema':'polpal.bounded-fit/1','status':'candidate' if accepted else 'no_improvement','source_mesh_sha256':expected,'job_sha256':job_digest(job),
            'source_object':job['mesh'].get('source_object'),'vertices':best[0].tolist(),'triangles':job['mesh']['triangles'],
            'parameters':{c['name']:float(p) for c,p in zip(controls,parameters)},'accepted_steps':accepted,
            'max_displacement':float(np.linalg.norm(best[0]-vertices,axis=1).max()),'displacement_limit':max_move,
            'before_scores':initial_scores,'after_scores':best[2],'history':history,
             'protected_vertices':pins.tolist(),'views':[{'name':v.get('name'),'camera':v['camera'],
                 **({'outline_sha256':job_digest(v['segments']),'source_sha256':v['source_sha256']} if v.get('target_kind')=='visible_outline' else {'mask_sha256':v['mask_sha256']})} for v in views],
             'scope':'Fixed-camera silhouette objective only. Appearance, topology quality and 3D anatomy require inspection.'}
    from collections import Counter
    result['search_diagnostics']={'stop_reason':'step_resolution_limit' if step<.005 else 'iteration_limit',
        'final_step':step,'iterations_completed':iteration+1,'trial_reasons':dict(Counter(t['reason'] for t in history)),
        'controls_at_bounds':[c['name'] for c,p,lo,hi in zip(controls,parameters,low,high) if min(abs(p-lo),abs(p-hi))<1e-9],
        'scope':'Observed search outcomes, not a proof of global optimum or anatomical cause.'}
    (out/'fit-result.json').write_text(json.dumps(result,indent=2,allow_nan=False)+'\n');return result


if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser();p.add_argument('job',type=Path);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
    print(json.dumps({k:v for k,v in fit_mesh(json.loads(a.job.read_text()),a.out,root=a.job.resolve().parent).items() if k not in ('vertices','triangles','history')},indent=2))
