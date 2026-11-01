"""Inspectable palette/region candidates for clothing, exposed skin and equipment."""
import re

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

from face_scan import box,colour


# Search priors for the Aiko front reference, NOT measured anatomical landmarks.
# X is relative to the foreground axis in units of foreground height; Y is height fraction.
AIKO_PARTS={
    'jacket':('clothing',[-.28,.40,.28,.59],'teal'),
    'fur_collar':('clothing',[-.15,.36,.15,.49],'light'),
    'top':('clothing',[-.055,.46,.055,.565],'light'),
    'shorts':('clothing',[-.14,.60,.14,.70],'brown'),
    'socks':('clothing',[-.14,.82,.14,.90],'warm'),
    'boots':('clothing',[-.15,.90,.15,1.0],'brown'),
    'skin_hands':('body',[-.33,.43,.33,.52],'skin'),
    'skin_midriff':('body',[-.075,.565,.075,.62],'skin'),
    'skin_legs':('body',[-.14,.70,.14,.82],'skin'),
    'held_equipment':('equipment',[-.36,.32,-.23,.52],'object'),
    'hip_equipment_left':('equipment',[-.16,.59,-.075,.70],'object'),
    'hip_equipment_right':('equipment',[.07,.52,.17,.70],'object'),
}


def analyse_parts(rgb,foreground,body,hair=None,hints=None,profile='aiko-front'):
    h,w=foreground.shape;hints=hints or {}
    if profile not in ('aiko-front','silhouette-only'):raise ValueError('Unsupported profile')
    hsv=np.asarray(Image.fromarray(rgb).convert('HSV')).astype(float)
    hue,sat,val=np.moveaxis(hsv,-1,0)
    selectors={
        'teal':(hue>=80)&(hue<=155)&(sat>=55)&(val>=30),
        'light':(sat<=85)&(val>=135)&((hue<=45)|(sat<=20)),
        'brown':(hue>=3)&(hue<=35)&(sat>=35)&(val>=25)&(val<=175),
        'warm':(hue>=7)&(hue<=45)&(sat>=25)&(sat<=180)&(val>=60)&(val<=240),
        'skin':(hue>=5)&(hue<=32)&(sat>=55)&(sat<=165)&(val>=145),
        'object':np.ones_like(foreground),
    }
    if not isinstance(hints,dict):raise ValueError('parts hints must be an object')
    definitions={}
    axis=body['registration']['axis_x_px'];top=body['bbox_px'][1];span=body['height_px']
    for name,(group,bounds,palette) in (AIKO_PARTS.items() if profile=='aiko-front' else []):
        a,b,c,d=bounds
        bounds=[max(0,round(axis+a*span)),max(0,round(top+b*span)),
                min(w,round(axis+c*span)),min(h,round(top+d*span))]
        definitions[name]={'group':group,'region_px':bounds,'palette':palette,'origin':'aiko-front search prior'}
    for name,definition in hints.items():
        if not re.fullmatch(r'[a-z][a-z0-9_]{0,63}',name):raise ValueError('Invalid part name')
        if not isinstance(definition,dict) or set(definition)-{'group','region_px','polygon_px','palette','disabled'}:
            raise ValueError('Unknown part hint fields')
        merged={**definitions.get(name,{}),**definition,'origin':'input hint'}
        if 'polygon_px' in definition:merged.pop('region_px',None)
        if 'region_px' in definition:merged.pop('polygon_px',None)
        definitions[name]=merged
    masks={};features={}
    for name,definition in definitions.items():
        group=definition.get('group')
        if group not in ('body','clothing','equipment'):raise ValueError('Invalid part group')
        if type(definition.get('disabled',False)) is not bool:raise ValueError('disabled must be boolean')
        if definition.get('disabled'):
            features[name]={'status':'unknown','group':group,'reason':'Disabled by input hint','origin':'input hint'}
            masks[name]=np.zeros_like(foreground);continue
        palette=definition.get('palette')
        if palette not in selectors:raise ValueError('Unknown part palette')
        region=np.zeros_like(foreground)
        if 'polygon_px' in definition:
            pts=definition['polygon_px']
            if not isinstance(pts,list) or not 3<=len(pts)<=1000:raise ValueError('Polygon requires 3..1000 points')
            for p in pts:
                if len(p)!=2 or not all(isinstance(v,(int,float)) and np.isfinite(v) for v in p) or not (0<=p[0]<w and 0<=p[1]<h):
                    raise ValueError('Polygon point outside image')
            plate=Image.new('1',(w,h));ImageDraw.Draw(plate).polygon([tuple(p) for p in pts],fill=1)
            region=np.asarray(plate,dtype=bool)
        else:
            values=definition.get('region_px',[])
            # An automatic search window can fall outside a narrow crop.
            if definition['origin']!='input hint' and len(values)==4 and (values[0]>=values[2] or values[1]>=values[3]):
                features[name]={'status':'unknown','group':group,'reason':'Search region outside image','origin':definition['origin']}
                masks[name]=region;continue
            a,b,c,d=box(values,w,h);region[b:d,a:c]=True
        selected=foreground&region&selectors[palette]
        if hair is not None:selected &= ~hair
        labels,count=ndi.label(selected)
        sizes=np.bincount(labels.ravel());keep=sizes>=max(3,round(span**2*.000008));keep[0]=False
        selected=keep[labels]
        masks[name]=selected
        features[name]={'status':'candidate' if selected.any() else 'unknown','group':group,
            'origin':definition['origin'],'search':definition,'palette':palette,
            'method':'regional palette pixels; semantic label is a search hypothesis',
            'touches_search_boundary':bool((selected&~ndi.binary_erosion(region)).any())}
    # Conflicting semantic labels are NOT resolved by an arbitrary priority order.
    count=np.zeros_like(foreground,dtype=np.uint16)
    for mask in masks.values():count+=mask
    ambiguous=count>1
    for name,mask in masks.items():
        feature=features[name];feature['ambiguous_area_px']=int((mask&ambiguous).sum())
        mask &= ~ambiguous
        yy,xx=np.nonzero(mask);feature['area_px']=int(len(xx));feature['colour']=colour(rgb,mask)
        if len(xx):
            feature['bbox_px']=[int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)]
            feature['centroid_px']=[float(xx.mean()),float(yy.mean())]
            feature['width_px']=int(xx.max()-xx.min()+1);feature['height_px']=int(yy.max()-yy.min()+1)
            feature['status']='partial'  # palette fragments cannot establish full garment/object boundaries
        else:
            feature['status']='unknown';feature.setdefault('reason','No unambiguous matching pixels')
    return features,masks,ambiguous
