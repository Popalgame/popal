"""Boundary deviations, known coverage and explicitly conditional uncertainty."""
import math
import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def compare_masks(reference,candidate,valid=None,mm_per_px=None,segmentation_sigma_px=None,camera_sigma_px=None,scale_relative_sigma=None):
    a=np.asarray(reference,bool);b=np.asarray(candidate,bool)
    if a.shape!=b.shape:raise ValueError('Masks must share a registered pixel grid')
    valid=np.ones_like(a) if valid is None else np.asarray(valid,bool)
    if valid.shape!=a.shape:raise ValueError('Invalid coverage mask')
    # Compute true boundaries before cropping coverage; coverage edges are not anatomy.
    ba=a&~ndi.binary_erosion(a);bb=b&~ndi.binary_erosion(b)
    ba &= valid;bb &= valid
    if not ba.any() or not bb.any():return {'status':'unknown','reason':'No mutually observable boundary'},np.zeros(a.shape)
    da=ndi.distance_transform_edt(~ba);db=ndi.distance_transform_edt(~bb)
    distances=np.r_[da[bb],db[ba]];union=((a|b)&valid).sum()
    signed=np.where(a,-np.maximum(ndi.distance_transform_edt(a)-1,0),ndi.distance_transform_edt(~a))
    error=np.where(bb,signed,0)
    result={'status':'partial' if not valid.all() else 'candidate','coverage_fraction':float(valid.mean()),
            'iou_observed':float((a&b&valid).sum()/union) if union else None,
            'boundary_mean_px':float(distances.mean()),'boundary_p95_px':float(np.percentile(distances,95)),
            'boundary_max_px':float(distances.max()),'candidate_outward_mean_px':float(np.maximum(signed[bb],0).mean()),
            'candidate_inward_mean_px':float(np.maximum(-signed[bb],0).mean()),
            'coverage_scope':'Valid comparison pixels, not verified anatomical visibility',
            'accuracy_100_percent_verified':False}
    if mm_per_px is not None:
        if not math.isfinite(mm_per_px) or mm_per_px<=0:raise ValueError('Invalid physical scale')
        for key in ('mean','p95','max'):result['boundary_'+key+'_mm']=result['boundary_'+key+'_px']*mm_per_px
    terms={'segmentation_sigma_px':segmentation_sigma_px,'camera_sigma_px':camera_sigma_px,'scale_relative_sigma':scale_relative_sigma}
    for v in terms.values():
        if v is not None and (not math.isfinite(v) or v<0):raise ValueError('Invalid uncertainty')
    result['uncertainty']={'status':'unknown' if any(v is None for v in terms.values()) else 'conditional',**terms,
                           'note':'Independent Gaussian approximation; does not include unmodelled systematic bias. Softmax is not calibrated confidence.'}
    if result['uncertainty']['status']=='conditional':
        sigma=math.sqrt(segmentation_sigma_px**2+camera_sigma_px**2+1/6+(result['boundary_mean_px']*scale_relative_sigma)**2)
        result['uncertainty']['combined_sigma_px']=sigma;result['uncertainty']['approx_95_half_width_px']=1.96*sigma
    return result,error


def heatmap(rgb,error,path,limit_px=10):
    pixels=np.asarray(rgb).copy();m=error!=0;t=np.minimum(abs(error)/limit_px,1)
    color=np.zeros_like(pixels);color[:,:,0]=255;color[:,:,1]=(220*(1-t)).astype(np.uint8)
    color[error<0]=[80,160,255];pixels[m]=(pixels[m]*.2+color[m]*.8).astype(np.uint8)
    Image.fromarray(pixels).save(path)


def align_similarity(source,target):
    a=np.asarray(source,float);b=np.asarray(target,float)
    if a.shape!=b.shape or a.ndim!=2 or a.shape[1]!=2 or len(a)<3 or not np.isfinite([a,b]).all():raise ValueError('At least three corresponding finite landmarks required')
    ac=a-a.mean(0);bc=b-b.mean(0)
    if np.linalg.matrix_rank(ac)<2:raise ValueError('Alignment landmarks are collinear')
    u,s,vt=np.linalg.svd(ac.T@bc);r=u@vt
    if np.linalg.det(r)<0:u[:,-1]*=-1;r=u@vt
    scale=np.sum((ac@r)*bc)/np.sum(ac**2)
    if scale<=0:raise ValueError('Invalid similarity transform')
    t=b.mean(0)-a.mean(0)@r*scale
    matrix=np.c_[r.T*scale,t]
    return {'matrix':matrix.tolist(),'rms_px':float(np.sqrt(np.mean(np.sum((a@r*scale+t-b)**2,axis=1)))),
            'scope':'2D similarity only, not perspective camera calibration or shape warping'}
