"""Explicit upright side-view evidence, with its own source and physical scale."""
import hashlib
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from body_scan import foreground
from eye_scan import calibration
from facial_layout import measured_geometry


def analyse_profile(spec):
    if spec is None:
        return {'status':'unknown','reason':'Supply an upright side reference and head region/mask to assess depth; front view is insufficient'}
    allowed={'image','source_sha256','head_roi','mask','scope','calibration','view','status'}
    if not isinstance(spec,dict) or set(spec)-allowed or not {'image','source_sha256','head_roi','scope','view'}<=set(spec):
        raise ValueError('Side profile needs image, source_sha256, head_roi, scope and view')
    if spec['view'] not in ('left-facing','right-facing') or spec['scope'] not in ('head_surface','hair_envelope'):
        raise ValueError('Profile view must be left/right-facing; scope head_surface or hair_envelope')
    status=spec.get('status','partial')
    if status not in ('candidate','partial'):raise ValueError('Invalid side profile status')
    path=Path(spec['image']);digest=hashlib.sha256(path.read_bytes()).hexdigest()
    if digest!=spec['source_sha256']:raise ValueError('Side profile source_sha256 mismatch')
    rgba=np.asarray(Image.open(path).convert('RGBA'));h,w=rgba.shape[:2]
    roi=spec['head_roi']
    if not isinstance(roi,list) or len(roi)!=4 or any(type(v) is not int for v in roi):raise ValueError('Profile head_roi must contain four integers')
    x0,y0,x1,y1=roi
    if not (0<=x0<x1<=w and 0<=y0<y1<=h):raise ValueError('Profile head_roi outside image')
    provenance={'source':str(path.resolve()),'source_sha256':digest,'view':spec['view'],'scope':spec['scope'],'head_roi':roi}
    if spec.get('mask'):
        maskpath=Path(spec['mask']);im=Image.open(maskpath)
        values=np.asarray(im.convert('L'))
        if im.size!=(w,h) or not np.isin(values,[0,255]).all():raise ValueError('Side mask must be binary 0/255 and match source dimensions')
        mask=values>127
        permitted=np.zeros((h,w),bool);permitted[y0:y1,x0:x1]=True
        if (mask&~permitted).any() or (mask&(rgba[...,3]<=127)).any():raise ValueError('Side mask outside head ROI or on transparent pixels')
        provenance['mask']={'path':str(maskpath.resolve()),'sha256':hashlib.sha256(maskpath.read_bytes()).hexdigest()}
    else:
        _,full,mode=foreground(path);mask=np.zeros_like(full);mask[y0:y1,x0:x1]=full[y0:y1,x0:x1]
        provenance['segmentation']=mode+' within supplied ROI'
        # A cropped silhouette cannot establish the anatomical head boundary.
        status='partial'
    if not mask.any():raise ValueError('No visible profile head pixels')
    cal=calibration(spec.get('calibration'),{'width':w,'height':h})
    g=measured_geometry(mask,cal)
    touches=bool(mask[y0,x0:x1].any() or mask[y1-1,x0:x1].any() or mask[y0:y1,x0].any() or mask[y0:y1,x1-1].any())
    if touches:status='partial'
    return {'status':status,**provenance,'calibration':cal,'geometry_2d':g,
            'depth_height_ratio':g['width_px']/g['height_px'],'touches_roi_boundary':touches,
            'flatness_assessment':'unknown until compared with a matching-scope side reference',
            'definition':'horizontal extent / vertical extent of upright side mask; includes nose if mask includes it',
            'limitations':['View orientation is user supplied, not camera-pose verified.',
                           'Hair envelope is not skull depth. Partial extents are not full head proportions.',
                           'Front-image scale is never reused for the side image.']}


def compare_profiles(a,b):
    result={'status':'unknown','reference_status':a.get('status','unknown'),'candidate_status':b.get('status','unknown')}
    if 'depth_height_ratio' not in a or 'depth_height_ratio' not in b:
        result['reason']='Both side profiles are required';return result
    if a['scope']!=b['scope']:
        result['reason']='Profile scopes differ (head surface versus hair envelope)';return result
    result.update(status='partial' if 'partial' in (a['status'],b['status']) else 'candidate',
                  depth_height_ratio_delta=b['depth_height_ratio']-a['depth_height_ratio'],
                  relative_depth_height_ratio=b['depth_height_ratio']/a['depth_height_ratio'],
                  meaning='negative delta means a shallower visible profile relative to its height; not a universal flatness judgement')
    return result


def save_profile(profile,out):
    if profile['status']=='unknown':return
    path=Path(profile['source'])
    if hashlib.sha256(path.read_bytes()).hexdigest()!=profile['source_sha256']:raise ValueError('Side source changed before save')
    im=Image.open(path).convert('RGB');draw=ImageDraw.Draw(im)
    for c in profile['geometry_2d']['contours']:
        points=[tuple(p) for p in c['points_px']];draw.line(points+[points[0]],fill='#60ffca',width=2)
    im.crop(profile['head_roi']).save(out/'head-profile-overlay.png')
