"""Labelled procedural fixtures, independent of detector thresholds and decisions.

Known masks/registration isolate boundary reasoning from upstream segmentation.
These are not independent real-world annotations or a trained semantic dataset.
"""
import hashlib
import numpy as np


KINDS=('chin_neck_contact','outer_boundary','in_surface_shadow','hair_occlusion',
       'missing_contrast','disconnected_shadow','flat_contact')
SPLITS={'development':[3,17,29],'heldout':[103,107,109,127]}


def make_case(kind,seed):
    if kind not in KINDS:raise ValueError(kind)
    rng=np.random.default_rng(seed);sep=int(rng.integers(90,155));w,h=sep*4,sep*3
    cx,ey=2*sep,sep;bottom=ey+sep*.88;half=sep*.84
    yy,xx=np.mgrid[:h,:w];dx=xx-cx
    power=float(rng.uniform(1.8,2.3));depth=sep*float(rng.uniform(.40,.48))
    curve=bottom-depth*(np.abs(dx)/half)**power
    if kind=='flat_contact':curve=np.where(abs(dx)<sep*.36,bottom,curve)
    actual=curve if kind not in ('in_surface_shadow','disconnected_shadow') else curve+sep*.32
    if kind=='in_surface_shadow':actual=np.full_like(curve,bottom+sep*.45)
    face=(abs(dx)<=half)&(yy>=ey-sep*.7)&(yy<=actual)
    neck=(abs(dx)<=sep*float(rng.uniform(.18,.23)))&(yy>actual)&(yy<bottom+sep*.65)
    if kind=='outer_boundary':neck[:]=False
    skin=face|neck;hair=np.zeros((h,w),bool);valid=np.ones_like(skin)
    tone=np.array([230,180,150])*rng.uniform(.85,1.04)
    bg=np.array([25,35,50])*rng.uniform(.80,1.20)
    rgb=np.broadcast_to(bg,(h,w,3)).copy();rgb[face]=tone;rgb[neck]=tone*rng.uniform(.44,.62)
    if kind in ('in_surface_shadow','disconnected_shadow'):
        rgb[face&(yy>curve)]=tone*.52
    if kind=='hair_occlusion':
        hair=(abs(dx)<sep*.075)&(yy>bottom-sep*.16)&(yy<bottom+sep*.16)
        rgb[hair]=[210,95,140];skin[hair]=False
    if kind=='missing_contrast':rgb[abs(dx)<sep*.065]=tone
    rgb=np.uint8(np.clip(rgb+rng.normal(0,.5,rgb.shape),0,255))
    rows=[]
    for y in range(ey,min(h,int(bottom+sep*.3))):
        xs=np.flatnonzero(skin[y])
        if len(xs)>sep*.25:
            rows.append({'y':y,'left':int(xs[0]),'right':int(xs[-1]),
                         'fit_checks':{side:{'eligible':True,'reasons':[]} for side in ('left','right')}})
    report={'source_sha256':hashlib.sha256(rgb.tobytes()).hexdigest(),'image':{'width':w,'height':h},
        'roi_px':[int(cx-sep*1.3),int(ey-sep*.8),int(cx+sep*1.3),int(bottom+sep*.7)],
        'registration':{'axis_x_px':cx,'eye_line_y_px':ey,'eye_spacing_px':sep},
        'ocular_metrology':{'calibration':{'status':'unknown'}},
        'features':{'visible_skin_contour':{'rows':rows}}}
    label={'case':kind,'seed':seed,'expected_supported_chin':kind in ('chin_neck_contact','outer_boundary','flat_contact'),
           'basis':'Procedural surface labels; masks and registration supplied, not inferred by the detector.',
           'notes':'Flat contact intentionally probes a convex-arc prior limitation.' if kind=='flat_contact' else '',
           'true_central_boundary_px':[[x,float(actual[0,x])] for x in range(round(cx-sep*.32),round(cx+sep*.32)+1)]}
    return report,{'skin':skin,'hair':hair},rgb,valid,label
