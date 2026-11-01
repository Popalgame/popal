"""Calibrated cameras and sparse multi-view metrology (x right, y down, z forward)."""
import math
import numpy as np
from scipy.optimize import least_squares
from scipy.spatial.transform import Rotation


def array(value,shape=None):
    a=np.asarray(value,float)
    if not np.isfinite(a).all() or (shape is not None and a.shape!=shape):raise ValueError('Invalid finite array/shape')
    return a


def projection(camera):
    p=array(camera['P'],(3,4))
    if np.linalg.matrix_rank(p)<3:raise ValueError('Degenerate camera')
    return p


def project(points,camera):
    x=array(points);p=projection(camera)
    q=np.c_[x,np.ones(len(x))]@p.T
    if np.any(q[:,2]<=1e-9):raise ValueError('Points behind camera or on projection plane')
    return q[:,:2]/q[:,2,None]


def camera_from_parameters(parameters,kind,intrinsics=None):
    r=Rotation.from_rotvec(parameters[:3]).as_matrix()
    if kind=='orthographic':
        scale=np.exp(parameters[3]);p=np.zeros((3,4));p[:2,:3]=r[:2]*scale
        p[:2,3]=parameters[4:6];p[2,3]=1
        return {'kind':kind,'P':p.tolist(),'R':r.tolist(),'scale_px_per_unit':float(scale)}
    k=array(intrinsics,(3,3));t=array(parameters[3:6]);p=k@np.c_[r,t]
    return {'kind':kind,'P':p.tolist(),'R':r.tolist(),'t':t.tolist(),'K':k.tolist()}


def fit_camera(points3d,points2d,kind='orthographic',sigma_px=None,intrinsics=None,world_unit='mm',frame_id='model'):
    x=array(points3d);y=array(points2d)
    if x.ndim!=2 or x.shape[1]!=3 or y.shape!=(len(x),2) or len(x)<6:raise ValueError('Camera fit needs at least six shared 3D/2D landmarks')
    if kind not in ('orthographic','perspective'):raise ValueError('Unknown camera projection')
    if np.linalg.matrix_rank(x-x.mean(0))<3:raise ValueError('Camera landmarks must span 3D; coplanar pose is ambiguous')
    sigma=np.ones(len(x)) if sigma_px is None else array(sigma_px,(len(x),))
    if np.any(sigma<=0):raise ValueError('Landmark uncertainty must be positive')
    seeds=[]
    if kind=='orthographic':
        affine=np.linalg.lstsq(np.c_[x,np.ones(len(x))],y,rcond=None)[0]
        scale=max(1e-8,np.mean(np.linalg.norm(affine[:3].T,axis=1)))
        r0=affine[:3].T/scale;r0=np.vstack([r0,np.cross(r0[0],r0[1])])
        u,_,vh=np.linalg.svd(r0);r0=u@vh
        if np.linalg.det(r0)<0:r0[-1]*=-1
        seeds.append(np.r_[Rotation.from_matrix(r0).as_rotvec(),np.log(scale),affine[3]])
    else:
        k=array(intrinsics,(3,3))
        if k[0,0]<=0 or k[1,1]<=0:raise ValueError('Perspective fit requires calibrated positive focal lengths')
        try:
            import cv2
            ok,r,t=cv2.solvePnP(x,y,k,np.zeros(5),flags=cv2.SOLVEPNP_EPNP)
            if ok:seeds.append(np.r_[r.ravel(),t.ravel()])
        except ImportError:pass
        depth=max(np.ptp(x,axis=0).max()*2,k[0,0]*np.ptp(x[:,0])/max(1,np.ptp(y[:,0])))
        seeds.append(np.r_[np.zeros(3),(y.mean(0)-k[:2,2])*depth/[k[0,0],k[1,1]]-x.mean(0)[:2],depth-x.mean(0)[2]])
    def residual(p):
        c=camera_from_parameters(p,kind,intrinsics);q=np.c_[x,np.ones(len(x))]@np.asarray(c['P']).T
        z=np.maximum(q[:,2],1e-6);pred=q[:,:2]/z[:,None]
        return ((pred-y)/sigma[:,None]).ravel()
    fits=[least_squares(residual,p,loss='soft_l1',f_scale=2,max_nfev=1000) for p in seeds]
    fit=min(fits,key=lambda f:np.sum(np.minimum(f.fun**2,25)))
    c=camera_from_parameters(fit.x,kind,intrinsics);pred=project(x,c);errors=np.linalg.norm(pred-y,axis=1)
    rank=int(np.linalg.matrix_rank(fit.jac));condition=float(np.linalg.cond(fit.jac))
    covariance=np.linalg.pinv(fit.jac.T@fit.jac)
    status='candidate' if fit.success and rank==len(fit.x) and condition<1e8 else 'ambiguous'
    if status=='candidate' and np.count_nonzero(errors<=3*sigma)<max(6,math.ceil(.6*len(x))):status='inconsistent'
    c.update(status=status,
             world_unit=world_unit,frame_id=frame_id,parameters=fit.x.tolist(),parameter_covariance=covariance.tolist(),
             reprojection_px=pred.tolist(),errors_px=errors.tolist(),rms_px=float(np.sqrt(np.mean(errors**2))),
             p95_px=float(np.percentile(errors,95)),inliers=(errors<=3*sigma).tolist(),jacobian_rank=rank,
             condition_number=condition,observations=len(x),
             uncertainty_note='Local linear parameter covariance conditional on supplied point sigma and fixed 3D landmarks; excludes model/intrinsic bias')
    return c


def triangulate(observations,draws=128,seed=13):
    if not isinstance(draws,int) or draws<16:raise ValueError('At least 16 uncertainty draws required')
    if len(observations)<2:return {'status':'unknown','reason':'At least two calibrated views required'}
    cameras=[o['camera'] for o in observations]
    if any(c.get('status') not in ('candidate','calibrated') for c in cameras):return {'status':'unknown','reason':'Unresolved camera pose'}
    if len({(c.get('frame_id'),c.get('world_unit')) for c in cameras})!=1:raise ValueError('Camera frames/units differ')
    def solve(points):
        a=[];b=[]
        for xy,o in zip(points,observations):
            p=projection(o['camera']);sigma=float(o.get('sigma_px',1))
            if sigma<=0 or not math.isfinite(sigma):raise ValueError('Invalid observation sigma')
            for axis in (0,1):
                row=(p[axis]-xy[axis]*p[2])/sigma;a.append(row[:3]);b.append(-row[3])
        a=np.asarray(a);b=np.asarray(b)
        return np.linalg.lstsq(a,b,rcond=None)[0],np.linalg.matrix_rank(a),np.linalg.cond(a)
    xy=array([o['point_px'] for o in observations]);point,rank,condition=solve(xy)
    if rank<3 or condition>1e6:return {'status':'unknown','reason':'Insufficient baseline / degenerate rays','rank':int(rank)}
    try:errors=np.array([np.linalg.norm(project([point],c)[0]-p) for p,c in zip(xy,cameras)])
    except ValueError:return {'status':'unknown','reason':'Triangulation behind a camera'}
    sigma=np.array([o.get('sigma_px',1) for o in observations]);rng=np.random.default_rng(seed)
    samples=np.array([solve(xy+rng.normal(size=xy.shape)*sigma[:,None])[0] for _ in range(draws)])
    covariance=np.cov(samples.T);std=np.sqrt(np.diag(covariance))
    return {'status':'candidate' if np.all(errors<=3*sigma) else 'inconsistent',
            'point':point.tolist(),'world_unit':cameras[0]['world_unit'],'frame_id':cameras[0]['frame_id'],
            'reprojection_errors_px':errors.tolist(),'condition_number':float(condition),
            'covariance':covariance.tolist(),'std_xyz':std.tolist(),'interval_95_xyz':np.percentile(samples,[2.5,97.5],axis=0).tolist(),
            'uncertainty_note':'Seeded Monte Carlo of image-point noise, conditional on fixed camera calibration; excludes camera/systematic uncertainty'}


def reconstruct(views):
    names=sorted(set().union(*(set(v.get('landmarks',{})) for v in views)))
    points={}
    for name in names:
        obs=[{'camera':v['camera'],'point_px':v['landmarks'][name]['point_px'],
              'sigma_px':v['landmarks'][name].get('sigma_px',1)} for v in views
             if v.get('camera') and name in v.get('landmarks',{}) and v['landmarks'][name].get('visible',True)]
        points[name]=triangulate(obs)
    measurements={}
    pairs={'iris_spacing':('iris_center_left','iris_center_right'),'inner_eye_spacing':('eye_inner_left','eye_inner_right'),
           'nose_to_upper_lip':('nose_base','upper_lip'),'mouth_width':('mouth_left','mouth_right'),
           'jaw_width':('jaw_left','jaw_right'),'lip_to_chin':('upper_lip','chin_bottom'),
           'ear_height_left':('ear_top_left','ear_bottom_left'),'ear_height_right':('ear_top_right','ear_bottom_right')}
    for name,(a,b) in pairs.items():
        pa,pb=points.get(a,{}),points.get(b,{})
        if pa.get('status')!='candidate' or pb.get('status')!='candidate':measurements[name]={'status':'unknown'};continue
        delta=np.array(pb['point'])-pa['point'];distance=float(np.linalg.norm(delta))
        covariance=np.array(pa['covariance'])+np.array(pb['covariance'])
        sigma=float(np.sqrt(delta@covariance@delta)/distance) if distance>1e-12 else None
        measurements[name]={'status':'candidate','distance':distance,'world_unit':pa['world_unit'],'conditional_sigma':sigma,
                            'landmarks':[a,b],'note':'Euclidean point distance, not skin-surface length; independent image noise and fixed cameras assumed'}
    return {'schema':'polpal.sparse-multiview/1','points':points,'measurements':measurements,'scope':'Shared annotated landmarks only; no hidden dense surface completion'}
