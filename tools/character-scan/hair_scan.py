"""Local rose/cool-tip hair candidates; no hidden strands or volume recovery."""
import numpy as np
from scipy import ndimage as ndi


def scan_hair(hsv, valid, bounds, spacing, eye_line, excluded):
    """Grow colour regions from thick rose seeds, excluding observed facial features.

    A separate head ROI prevents similarly coloured equipment from becoming hair.
    Colour connectivity is evidence, not semantic classification.
    """
    hue,sat,val=np.moveaxis(hsv,-1,0)
    region=np.zeros_like(valid)
    x0,y0,x1,y1=bounds;region[y0:y1,x0:x1]=True
    rose=((hue>=225)|(hue<=4))&(sat>=20)&(sat<=235)&(val>=55)
    cool=(hue>=90)&(hue<=170)&(sat>=12)&(val>=65)
    allowed=(rose|cool)&valid&region&~excluded
    # Thin eyebrows cannot seed a hairstyle, even when they share its palette.
    seed=ndi.binary_opening(rose&allowed,structure=np.ones((max(3,int(spacing*.15)),1)))
    seed[max(0,int(eye_line-.25*spacing)):]=False
    labels,count=ndi.label(allowed)
    sizes=np.bincount(labels.ravel())
    ids=np.unique(labels[seed]);ids=ids[ids!=0]
    ids=[int(i) for i in ids if sizes[i]>=max(12,spacing**2*.035)]
    mask=np.isin(labels,ids) if ids else np.zeros_like(valid)
    components=[]
    for index in ids:
        yy,xx=np.nonzero(labels==index)
        components.append({"area_px":int(len(xx)),
            "bbox_px":[int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)]})
    yy,xx=np.nonzero(mask)
    clipped=bool(len(xx) and np.any((xx==x0)|(xx==x1-1)|(yy==y0)|(yy==y1-1)))
    feature={"status":"partial" if clipped else "candidate" if len(xx) else "unknown",
        "kind":"hair","method":"thick rose seeds above eyes + connected rose/cool pixels; facial masks excluded",
        "region_px":bounds,"area_px":int(mask.sum()),"components":components,
        "touches_region_boundary":clipped,
        "limitations":["Palette-specific candidate mask, not learned hair recognition",
                       "Misses dark/neutral strands and disconnected tips; can include same-colour objects",
                       "No strand direction, hidden surface or 3D hair volume is measured"]}
    return feature,mask
