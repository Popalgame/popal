"""Visible facial spacing, ear fragments and contrast evidence; no recovered depth."""
import csv
import json

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

from eye_scan import geometry


def measured_geometry(mask, cal):
    g = geometry(mask)
    if g and cal.get('status') == 'supplied':
        s = cal['mm_per_px']; ox, oy = cal['origin_px']
        point = lambda p: [(p[0]-ox)*s, (oy-p[1])*s]
        g['mm'] = {'width': g['width_px']*s, 'height': g['height_px']*s,
                   'area_mm2': g['area_px2']*s*s, 'centroid_xz': point(g['centroid_px']),
                   'contours': [{'points_xz': [point(p) for p in c['points_px']], 'hole': c['hole']}
                                for c in g['contours']]}
    return g


def ear_candidates(skin, valid, roi, centers, regions):
    """Lateral skin islands; reject joined cheeks, retain bounded partial evidence."""
    h, w = skin.shape; separation = centers[1][0]-centers[0][0]
    cx = (centers[0][0]+centers[1][0])/2; ey = sum(p[1] for p in centers)/2
    features = {}; masks = {}
    # Connectivity before lateral cropping prevents a cheek cutout becoming an ear.
    labels, _ = ndi.label(skin & valid)
    for side, sign in (('left', -1), ('right', 1)):
        name = 'ear_'+side
        lo, hi = sorted((cx+sign*.86*separation, cx+sign*1.65*separation))
        bounds = regions.get(name, [max(0, round(lo)), max(0, round(ey-.38*separation)),
                                    min(w, round(hi)), min(h, round(ey+.35*separation))])
        bounds=[max(0,min(w,bounds[0])),max(0,min(h,bounds[1])),
                max(0,min(w,bounds[2])),max(0,min(h,bounds[3]))]
        x0,y0,x1,y1 = bounds
        mask = np.zeros((h,w), bool)
        best = None
        for label in np.unique(labels[y0:y1,x0:x1]):
            if label == 0: continue
            yy,xx = np.nonzero(labels == label)
            if len(xx) < max(8, separation**2*.001): continue
            if xx.min()<x0 or xx.max()>=x1 or yy.min()<y0: continue
            # A lateral island can join the collar below. Keep only the search
            # band as a PARTIAL fragment; never claim its bottom is an ear edge.
            inside=(yy<y1);yy,xx=yy[inside],xx[inside]
            if len(xx)<max(8,separation**2*.001):continue
            width,height = np.ptp(xx)+1,np.ptp(yy)+1
            if not (.06*separation <= height <= .85*separation and width < .42*separation): continue
            if best is None or len(xx)>len(best[0]): best=(yy,xx)
        if best is not None: mask[best] = True
        features[name] = {'kind': 'ear', 'status': 'partial' if mask.any() else 'unknown',
                          'region_px': list(bounds), 'region_source': 'hint' if name in regions else 'lateral-face hypothesis',
                          'method': 'lateral warm-skin island in ear search band; ear identity unverified',
                          'touches_region_boundary':bool(mask[y0:y1,x0:x1].any() and mask[y1-1,x0:x1].any()),
                          'reason': 'Hair, shadow and collar can obscure ear boundaries. Search-band clipping is not an anatomical edge; hidden extent unavailable'}
        masks[name] = mask
    return features,masks


def add_layout(report, masks, head_roi=None):
    features = report['features']; cal = report['ocular_metrology']['calibration']
    for name in ('nose','mouth','ear_left','ear_right'):
        f = features[name]
        if f['status'] != 'unknown': f['geometry_2d'] = measured_geometry(masks[name], cal)
    relations = {}
    for name, a, b, axis in (
        ('nose_mouth_vertical','nose','mouth',1),
        ('eyes_horizontal','eye_left','eye_right',0),
        ('brows_horizontal','brow_left','brow_right',0),
        ('brow_eye_left_vertical','brow_left','eye_left',1),
        ('brow_eye_right_vertical','brow_right','eye_right',1)):
        fa,fb = features[a],features[b]
        ga,gb = fa.get('geometry_2d'),fb.get('geometry_2d')
        item = {'features': [a,b], 'axis': 'x right' if axis == 0 else 'y down',
                'definition': 'signed centroid separation and signed projected bounding-edge gap; negative gap means overlap',
                'landmark_note': 'Visible mask boundaries, not anatomical landmarks. Nose/mouth automatic masks are contrast patches.'}
        if not ga or not gb or 'unknown' in (fa['status'],fb['status']):
            item.update(status='unknown', reason='One or both visible features unavailable')
        else:
            ca,cb = ga['centroid_px'],gb['centroid_px']
            item.update(status='partial' if 'partial' in (fa['status'],fb['status']) else 'candidate',
                        centroid_separation_px=cb[axis]-ca[axis],
                        edge_gap_px=gb['bbox_px'][axis]-ga['bbox_px'][axis+2],
                        centroids_px=[ca,cb])
            # Signed projected gap uses pixel CELL edges, hence exclusive bbox ends.
            other = 1-axis
            cross = (ca[other]+cb[other])/2
            start,end = [cross,cross],[cross,cross]
            start[axis] = ga['bbox_px'][axis+2]-.5
            end[axis] = gb['bbox_px'][axis]-.5
            start[other] = end[other] = cross
            item['edge_projection_segment_px'] = [start,end]
            if cal['status']=='supplied':
                for key in ('centroid_separation','edge_gap'): item[key+'_mm']=item[key+'_px']*cal['mm_per_px']
        relations[name] = item
    head = {'status':'unknown','reason':'Supply head_roi for head-relative ratios; face search ROI is not skull size'}
    if head_roi is not None:
        x0,y0,x1,y1 = head_roi
        head = {'status':'candidate','bbox_px':head_roi,'width_px':x1-x0,'height_px':y1-y0,
                'basis':'user supplied head bounding region; may include hair, not recovered skull',
                'source_sha256':report['source_sha256']}
    ears = {}
    reg = report['registration']
    for side in ('left','right'):
        f = features['ear_'+side]; g = f.get('geometry_2d')
        item = {'status':f['status'], 'scope':'visible ear candidate fragment only',
                'head_relative':{'status':'unknown','reason':'Head region or visible ear unavailable'}}
        if g:
            x,y = g['centroid_px']; delta = [x-reg['axis_x_px'],y-reg['eye_line_y_px']]
            item['offset_from_face_axis_eye_line_px'] = delta
            if cal['status']=='supplied':item['offset_from_face_axis_eye_line_xz_mm']=[delta[0]*cal['mm_per_px'],-delta[1]*cal['mm_per_px']]
            if head_roi:
                x0,y0,x1,y1 = head_roi
                item['head_relative'] = {'status':f['status'], 'center_uv':[(x-x0)/(x1-x0),(y-y0)/(y1-y0)],
                                         'width_ratio':g['width_px']/(x1-x0),'height_ratio':g['height_px']/(y1-y0),
                                         'note':'relative to supplied region; coordinates outside 0..1 remain outside'}
        ears[side] = item
    report['facial_layout'] = {'version':'1.2','relations':relations,'head_registration':head,'ears':ears,
                               'calibration':cal, 'depth_status':'unknown from front image'}


def add_details(report, masks, rgb, valid):
    """Multi-scale dark contrast on skin, excluding known features and boundaries."""
    sep = report['registration']['eye_spacing_px']; cal = report['ocular_metrology']['calibration']
    lum = rgb.astype(float) @ np.array([.2126,.7152,.0722])
    support = ndi.binary_erosion(masks['skin'] & valid, iterations=max(2,round(sep*.015)))
    # The connected skin mask may extend into the neck; keep detail evidence facial.
    cx=report['registration']['axis_x_px'];ey=report['registration']['eye_line_y_px']
    yy,xx=np.indices(valid.shape)
    support &= (abs(xx-cx)<sep*1.05)&(yy>ey-sep*.9)&(yy<ey+sep*.8)
    excluded = np.zeros_like(valid)
    for name in ('hair','nose','mouth','freckles')+tuple(k+'_'+s for k in ('eye','iris','pupil','brow','lash','ear') for s in ('left','right')):
        excluded |= masks[name]
    support &= ~ndi.binary_dilation(excluded, iterations=max(2,round(sep*.025)))
    # Do not label an unresolved eye as a crease when aperture segmentation fails.
    for side in ('left','right'):
        f=report['features']['eye_'+side]
        if f['status']=='unknown':
            x0,y0,x1,y1=f['region_px'];support[y0:y1,x0:x1]=False
    observations=[]; union=np.zeros_like(valid)
    for scale, factor, threshold in (('fine_line',.012,4),('broad_shadow',.055,5)):
        residual=ndi.gaussian_filter(lum,max(.8,sep*factor))-lum
        labels,_=ndi.label((residual>threshold)&support)
        for index,sl in enumerate(ndi.find_objects(labels),1):
            if sl is None:continue
            local=labels[sl]==index;area=int(local.sum());sy,sx=sl
            width,height=sx.stop-sx.start,sy.stop-sy.start
            if area<max(4,sep**2*.00025) or max(width,height)<sep*.045:continue
            if scale=='fine_line' and max(width,height)/max(1,min(width,height))<1.7:continue
            mask=np.zeros_like(valid);mask[sl]=local
            g=measured_geometry(mask,cal);x,y=g['centroid_px']
            zone='face_surface'
            for side in ('left','right'):
                eye=report['features']['eye_'+side].get('geometry_2d')
                if not eye:continue
                a,b,c,d=eye['bbox_px']
                if a-sep*.12<=x<=c+sep*.12 and d<=y<=d+sep*.30:zone='under_eye_'+side
                elif a-sep*.12<=x<=c+sep*.12 and b-sep*.15<=y<=d:zone='orbital_surround_'+side
            observations.append({'id':len(observations)+1,'status':'candidate','scale':scale,'zone':zone,
                                 'geometry_2d':g,'mean_dark_contrast':float(residual[mask].mean()),
                                 'interpretation':'possible crease/orbital line' if scale=='fine_line' else 'possible depression shadow',
                                 'depth_status':'unknown','alternatives':['lighting','texture','pigment','compression']})
            union|=mask
    report['facial_details']={'status':'candidate' if observations else 'unknown','observations':observations,
                              'method':'two-scale dark local contrast on eroded visible skin',
                              'scope':'Contrast evidence only; neither wrinkles nor concavity is established. No detections does not establish absence.'}
    return union


def save_layout(report, masks, rgb, out, details):
    layout=report['facial_layout']; roi=report['roi_px']
    ear_boxes=[report['features']['ear_'+s]['region_px'] for s in ('left','right')]
    roi=[min([roi[0]]+[b[0] for b in ear_boxes]),min([roi[1]]+[b[1] for b in ear_boxes]),
         max([roi[2]]+[b[2] for b in ear_boxes]),max([roi[3]]+[b[3] for b in ear_boxes])]
    base=Image.fromarray(rgb);draw=ImageDraw.Draw(base)
    colors={'nose':'#ffae64','mouth':'#ff6699','ear_left':'#42e8df','ear_right':'#42e8df'}
    for name,color in colors.items():
        g=report['features'][name].get('geometry_2d')
        if not g:continue
        for c in g['contours']:draw.line([tuple(p) for p in c['points_px']]+[tuple(c['points_px'][0])],fill=color,width=1)
        x,y=g['centroid_px'];draw.text((x+4,y),name,fill=color)
    for i,(name,r) in enumerate(layout['relations'].items(),1):
        if 'edge_gap_px' not in r:continue
        points=[tuple(p) for p in r['edge_projection_segment_px']]
        draw.line(points,fill='#88ff78',width=2)
        x,y=points[0];draw.text((x+3,y-10),str(i),fill='white')
    base=base.crop(roi);base=base.resize((base.width*2,base.height*2))
    sheet=Image.new('RGB',(max(900,base.width),base.height+170),(25,31,38));sheet.paste(base,(0,0));draw=ImageDraw.Draw(sheet)
    for i,(name,r) in enumerate(layout['relations'].items(),1):
        text=f"{i}. {name}: {r['status']}"
        if 'edge_gap_px' in r:text+=f" | gap {r['edge_gap_px']:.2f} px | centres {r['centroid_separation_px']:.2f} px"
        if 'edge_gap_mm' in r:text+=f" | gap {r['edge_gap_mm']:.2f} mm"
        draw.text((12,base.height+10+i*23),text,fill='white')
    sheet.save(out/'facial-layout-overlay.png')
    pixels=rgb.copy();pixels[details]=[255,117,220]
    Image.fromarray(pixels).crop(roi).resize(base.size).save(out/'facial-details-overlay.png')
    Image.fromarray(details.astype(np.uint8)*255).save(out/'masks/facial-details.png')
    with (out/'facial-spacing.csv').open('w',newline='') as stream:
        writer=csv.writer(stream);keys=['status','centroid_separation_px','edge_gap_px','centroid_separation_mm','edge_gap_mm']
        writer.writerow(['relation']+keys)
        for name,r in layout['relations'].items():writer.writerow([name]+[r.get(k) for k in keys])
    with (out/'ear-measurements.csv').open('w',newline='') as stream:
        writer=csv.writer(stream)
        writer.writerow(['side','status','width_px','height_px','width_mm','height_mm','center_x_px','center_y_px',
                         'offset_axis_x_px','offset_eye_line_y_px','head_center_u','head_center_v','head_width_ratio','head_height_ratio'])
        for side,item in layout['ears'].items():
            g=report['features']['ear_'+side].get('geometry_2d',{});mm=g.get('mm',{});head=item['head_relative']
            writer.writerow([side,item['status'],g.get('width_px'),g.get('height_px'),mm.get('width'),mm.get('height'),
                             *g.get('centroid_px',[None,None]),*item.get('offset_from_face_axis_eye_line_px',[None,None]),
                             *head.get('center_uv',[None,None]),head.get('width_ratio'),head.get('height_ratio')])
    lines=['# Facial layout / ears / detail candidates','',
           'Gaps are signed projected pixel-cell bounds; centres are visible-mask centroids.',
           'Nose/mouth automatic detections are contrast patches, not verified anatomical landmarks.',
           'Ear dimensions describe visible fragments. Head-relative ratios require a supplied head region.',
           'Contrast lines/shadows are candidates; wrinkles and depression depth are not verified.','',
           '```json',json.dumps({'layout':layout,'head_profile':report['head_profile'],
                               'detail_candidates':len(report['facial_details']['observations'])},indent=2),'```']
    (out/'facial-layout-report.md').write_text('\n'.join(lines)+'\n')


def compare_layout(a,b):
    result={}
    for name,ra in a.get('facial_layout',{}).get('relations',{}).items():
        rb=b.get('facial_layout',{}).get('relations',{}).get(name,{})
        item={'reference_status':ra['status'],'candidate_status':rb.get('status','unknown'),
              'scope':'visible-mask spacing; partial features remain partial'}
        if 'edge_gap_px' in ra and 'edge_gap_px' in rb:
            for key in ('edge_gap','centroid_separation'):
                item[key+'_delta_eye_units']=rb[key+'_px']/b['registration']['eye_spacing_px']-ra[key+'_px']/a['registration']['eye_spacing_px']
                if key+'_mm' in ra and key+'_mm' in rb:item[key+'_delta_mm']=rb[key+'_mm']-ra[key+'_mm']
        result[name]=item
    return result
