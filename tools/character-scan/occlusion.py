"""Conservative contour eligibility from hair proximity, crop and user exclusions."""
import numpy as np
from scipy import ndimage as ndi

VERSION="hair-contact/1"


def annotate_contour(rows,hair,skin_bounds,spacing,excluded_regions):
    radius=max(2,int(round(spacing*.025)))
    near=ndi.binary_dilation(hair,iterations=radius)
    manual=np.zeros_like(hair)
    for x0,y0,x1,y1 in excluded_regions:manual[y0:y1,x0:x1]=True
    x0,y0,x1,y1=skin_bounds
    rejected={"left":0,"right":0}
    for row in rows:
        checks={}
        for side in ("left","right"):
            x,y=row[side],row["y"];reasons=[]
            if near[y,x]:reasons.append("near_hair_candidate")
            if manual[y,x]:reasons.append("user_excluded_region")
            if x<=x0+2 or x>=x1-3 or y<=y0+2 or y>=y1-3:
                reasons.append("near_crop_boundary")
            checks[side]={"eligible":not reasons,"reasons":reasons}
            rejected[side]+=bool(reasons)
        row["fit_checks"]=checks
    return {"version":VERSION,"proximity_px":radius,"rejected_samples":rejected,
        "excluded_regions_px":excluded_regions,
        "meaning":"eligible = no detected exclusion; not proof of anatomical visibility",
        "limitations":["Undetected hair, skin-coloured occluders and shadows can escape this guard",
                       "No interpolation across rejected contour samples"]},near
