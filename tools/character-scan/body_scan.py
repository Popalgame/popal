"""Observed foreground proportions; no anatomy is inferred under clothes."""
import math

import numpy as np
from PIL import Image

from scan import background_mask, detect_axis, row_runs


def foreground(path):
    image=Image.open(path).convert('RGBA')
    a=np.asarray(image);rgb=a[...,:3].copy();alpha=a[...,3]
    if (alpha<250).mean()>=.005:
        mask=alpha>127;mode='alpha'
    else:
        corners=np.array([rgb[0,0],rgb[0,-1],rgb[-1,0],rgb[-1,-1]],dtype=float)
        if np.max(np.ptp(corners,axis=0))>24:
            raise ValueError('Background is not uniform; supply a transparent reference')
        mask=background_mask(rgb);mode='uniform-background'
    if not mask.any():raise ValueError('No visible foreground')
    if min(mask.shape)<32:raise ValueError('Reference must be at least 32 pixels per side')
    return rgb,mask,mode


def measure_body(mask,mode,height_mm=1800,registration=None):
    if not math.isfinite(height_mm) or height_mm<=0:raise ValueError('Height must be finite and positive')
    yy,xx=np.nonzero(mask);h,w=mask.shape
    bounds=[int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)]
    x0,y0,x1,y1=bounds;span=y1-y0
    if span<16:raise ValueError('Foreground too short for a character scan')
    axis=detect_axis(mask,y0,span)
    supplied=registration or {}
    if not isinstance(supplied,dict) or set(supplied)-{'axis_x_px','ground_y_px','units_per_px'}:
        raise ValueError('Unknown registration fields')
    reg={'axis_x_px':axis,'ground_y_px':y1-1,'units_per_px':height_mm/1000/span}
    reg.update(supplied)
    if (any(not isinstance(v,(int,float)) or not math.isfinite(v) for v in reg.values())
        or not 0<=reg['axis_x_px']<w or not 0<=reg['ground_y_px']<h or reg['units_per_px']<=0):
        raise ValueError('Invalid image registration')
    reg['source']='user hints' if supplied else 'foreground axis, bottom and assumed height'
    profile=[]
    for y in range(y0,y1):
        runs=row_runs(mask[y])
        if runs:
            profile.append({'y':y,'runs_px':runs,'outer_width_px':runs[-1][1]-runs[0][0]+1,
                            'occupied_width_px':sum(b-a+1 for a,b in runs)})
    sections=[]
    for fraction in (.1,.2,.3,.4,.5,.6,.7,.8,.9):
        y=min(y1-1,y0+round(fraction*(span-1)))
        runs=row_runs(mask[y]);near=[(a,b) for a,b in runs if a<=axis<=b]
        sections.append({'height_fraction':fraction,'y':y,'runs_px':runs,
            'central_run_px':list(near[0]) if near else None,
            'status':'candidate' if runs else 'unknown',
            'meaning':'visible foreground cross-section; includes clothing/equipment'})
    clipped={'left':bool(mask[:,0].any()),'right':bool(mask[:,-1].any()),
             'top':bool(mask[0].any()),'bottom':bool(mask[-1].any())}
    warnings=['Foreground includes hair, clothes and equipment; it is not the naked body contour.',
              'Physical scale is supplied, not recovered from the image.']
    if any(clipped.values()):warnings.append('Foreground touches image edge: affected extents are partial/lower bounds.')
    return {'status':'partial' if any(clipped.values()) else 'candidate','mask_method':mode,
            'bbox_px':bounds,'height_px':span,'width_px':x1-x0,'area_px':int(mask.sum()),
            'clipped':clipped,'cross_sections':sections,'width_profile':profile,'warnings':warnings,
            'scale':{'assumed_height_mm':height_mm,'mm_per_px':reg['units_per_px']*1000,
                     'basis':'explicit registration units' if 'units_per_px' in supplied else 'assumed height / foreground pixel extent'},
            'registration':reg}
