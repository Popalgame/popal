"""Automatic semantic correspondences and explicitly constrained camera alignment."""
import copy
import numpy as np
from PIL import Image, ImageDraw

from metrology3d import fit_camera, project


def reference_points(view, scan):
    points=copy.deepcopy(view.get('landmarks',{}))
    # Imported scanner proposals are not manual annotations. Re-evaluate them
    # against the current scan so partial/stale detections cannot bypass guards.
    automatic_origins={'mask centroid candidate','contrast boundary candidate',
                       'scanner visible iris centroid candidate',
                       'scanner supported central lower boundary; chin identity candidate'}
    for name,point in list(points.items()):
        if point.get('origin') in automatic_origins and point.get('visible',True) and point.get('point3d') is None:
            del points[name]
    # Explicitly invisible points veto detector fallback.
    for side in ('left','right'):
        name='iris_center_'+side;feature=scan.get('features',{}).get('iris_'+side,{})
        if name not in points and feature.get('status')=='candidate' and not feature.get('touches_region_boundary') and feature.get('centroid_px'):
            points[name]={'point_px':feature['centroid_px'],'sigma_px':2,'visible':True,
                          'origin':'scanner visible iris centroid candidate'}
    chin=scan.get('face_shape',{}).get('chin_bottom',{})
    if 'chin_bottom' not in points and chin.get('status') in ('candidate','partial') and chin.get('point_px'):
        points['chin_bottom']={'point_px':chin['point_px'],'sigma_px':3,'visible':True,
                               'origin':'scanner supported central lower boundary; chin identity candidate'}
    return points


def correspondences(view, scan, model):
    if scan['source_sha256']!=view['source_sha256']:raise ValueError('Reference scan identity mismatch')
    result=[]
    for name,point in reference_points(view,scan).items():
        if not point.get('visible',True):continue
        anchor=model.get('landmarks',{}).get(name)
        explicit=point.get('point3d')
        if explicit is None and anchor is None:continue
        xyz=explicit if explicit is not None else anchor['point3d']
        if explicit is not None and view['camera_config'].get('frame_id')!=model['frame_id']:
            raise ValueError('Manual model points use a different frame')
        xy=np.asarray(point['point_px'],float);sigma=float(point.get('sigma_px',2))
        if xy.shape!=(2,) or not np.isfinite(xy).all() or np.any(xy<0) or np.any(xy>=[view['width'],view['height']]) or not np.isfinite(sigma) or sigma<=0:
            raise ValueError('Invalid reference landmark: '+name)
        result.append({'name':name,'point3d':xyz,'point_px':xy.tolist(),'sigma_px':sigma,
                       'reference_origin':point.get('origin','project landmark'),
                       'model_origin':{'method':'project 3D point'} if explicit is not None else anchor})
    return result


def fit_fixed_orientation(pairs, prior, frame_id, source_sha256):
    """Three free parameters: one positive scale and two translations; rotation is supplied."""
    if len(pairs)<3:raise ValueError('Fixed-orientation alignment needs at least three shared points')
    r=np.asarray(prior['R'],float)
    if r.shape!=(3,3) or not np.isfinite(r).all() or not np.allclose(r@r.T,np.eye(3),atol=1e-6) or np.linalg.det(r)<.999999:
        raise ValueError('Orientation prior must be a proper rotation')
    x=np.asarray([p['point3d'] for p in pairs],float);y=np.asarray([p['point_px'] for p in pairs],float)
    sigma=np.asarray([p['sigma_px'] for p in pairs],float)
    if x.shape!=(len(pairs),3) or not np.isfinite(x).all() or not np.isfinite(y).all() or not np.isfinite(sigma).all() or np.any(sigma<=0):raise ValueError('Invalid correspondence data')
    q=x@r[:2].T
    # Centred/scaled coordinates keep millimetre world offsets from destroying conditioning.
    center=q.mean(0);extent=float(np.linalg.norm(np.ptp(q,axis=0)))
    if extent<=1e-9 or np.linalg.matrix_rank(q-center)<2 or np.linalg.matrix_rank(y-y.mean(0))<2:
        raise ValueError('Alignment anchors must span both image axes')
    if np.linalg.svd(q-center,compute_uv=False)[-1]/extent<.04:raise ValueError('Alignment anchors are nearly collinear')
    a=np.zeros((len(q)*2,3));a[::2,0]=(q[:,0]-center[0])/extent;a[1::2,0]=(q[:,1]-center[1])/extent
    a[::2,1]=1;a[1::2,2]=1
    weights=np.repeat(1/sigma,2)
    def solve(keep):
        rows=np.repeat(keep,2);aw=a[rows]*weights[rows,None]
        params,_,rank,_=np.linalg.lstsq(aw,y.ravel()[rows]*weights[rows],rcond=None)
        if rank!=3 or params[0]<=0:raise ValueError('Positive scale cannot be determined')
        return params
    params=solve(np.ones(len(q),bool));scale=params[0]/extent;translation=params[1:]-scale*center
    p=np.zeros((3,4));p[:2,:3]=scale*r[:2];p[:2,3]=translation;p[2,3]=1
    predicted=(a@params).reshape(-1,2);errors=np.linalg.norm(predicted-y,axis=1)
    heldout=[]
    for index in range(len(q)):
        keep=np.arange(len(q))!=index;trial=solve(keep)
        heldout.append(float(np.linalg.norm(a[index*2:index*2+2]@trial-y[index])))
    # An eye-pair-only alignment must also predict the lower-face anchor.
    sep=np.linalg.norm(y.max(0)-y.min(0));limit=max(2.,sep*.02)
    rms=float(np.sqrt(np.mean(errors**2)))
    status='candidate' if rms<=limit and np.all(errors<=3*sigma) and max(heldout)<=max(4.,sep*.04) else 'inconsistent'
    covariance=np.linalg.inv((a*weights[:,None]).T@(a*weights[:,None]))
    return {'kind':'orthographic','method':'fixed_orientation_alignment','status':status,'P':p.tolist(),'R':r.tolist(),
            'scale_px_per_unit':float(scale),'translation_px':translation.tolist(),'rms_px':rms,
            'p95_px':float(np.percentile(errors,95)),'errors_px':errors.tolist(),'reprojection_px':predicted.tolist(),
            'inliers':(errors<=3*sigma).tolist(),'leave_one_out_errors_px':heldout,'observations':len(pairs),
            'jacobian_rank':3,'free_parameters':['scale','translation_x','translation_y'],
            'normalized_parameter_covariance':covariance.tolist(),'orientation_prior':copy.deepcopy(prior),
            'source_sha256':source_sha256,'frame_id':frame_id,'world_unit':'mm','rotation_estimated_from_reference':False,
            'uncertainty_note':'Conditional on fixed base orientation and model anchors; excludes unknown rotation, shape and depth bias.',
            'scope':'Model-to-reference alignment; not recovered physical camera or measured hidden depth'}


def align(view, scan, model, source_mesh_sha256):
    if model.get('world_unit')!='mm':raise ValueError('Model landmarks must use world millimetres')
    pairs=correspondences(view,scan,model)
    report={'schema':'polpal.automatic-camera/1','status':'blocked','pairs':pairs,
            'source_sha256':view['source_sha256'],'source_mesh_sha256':source_mesh_sha256,
            'frame_id':model['frame_id'],'diagnostics':list(model.get('diagnostics',[]))}
    names=[p['name'] for p in pairs]
    try:
        kind=view['camera_config'].get('kind','orthographic')
        if len(pairs)>=6:
            # Do not silently downgrade a failed full-pose solve to fixed pose.
            camera=fit_camera([p['point3d'] for p in pairs],[p['point_px'] for p in pairs],kind=kind,
                sigma_px=[p['sigma_px'] for p in pairs],intrinsics=view['camera_config'].get('K'),
                world_unit='mm',frame_id=model['frame_id'])
            camera['source_sha256']=view['source_sha256'];camera['method']='automatic_full_pose'
        else:
            if kind!='orthographic':raise ValueError('Perspective requires six shared 3D/2D points')
            if not model.get('orientation_prior'):raise ValueError('Insufficient full-pose points and no source orientation prior')
            required={'iris_center_left','iris_center_right','chin_bottom'}
            if not required.issubset(names):raise ValueError('Automatic constrained alignment needs both irises and chin')
            camera=fit_fixed_orientation(pairs,model['orientation_prior'],model['frame_id'],view['source_sha256'])
        camera['landmark_names']=names;camera['source_mesh_sha256']=source_mesh_sha256
        report.update(status=camera['status'],camera=camera)
    except ValueError as error:report['message']=str(error)
    return report


def overlay(image_path, report, output):
    image=Image.open(image_path).convert('RGB');draw=ImageDraw.Draw(image)
    camera=report.get('camera')
    if camera:
        predicted=project([p['point3d'] for p in report['pairs']],camera)
        for pair,q in zip(report['pairs'],predicted):
            x,y=pair['point_px'];u,v=q;draw.line((x,y,u,v),fill='#ffbd66',width=2)
            draw.ellipse((x-4,y-4,x+4,y+4),outline='#8ce08a',width=2)
            draw.line((u-4,v,u+4,v),fill='#ffbd66',width=2);draw.line((u,v-4,u,v+4),fill='#ffbd66',width=2)
            draw.text((x+7,y+7),pair['name'],fill='#58b8ff',stroke_width=1,stroke_fill='black')
    image.save(output)
